// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const path = require("path");
const multer = require("multer");
const { promisify } = require("util");
const axios = require("axios");
const db = require("../db");

// ----- Multer setup for KYC uploads -----
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "../uploads/")),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ----- Promisified DB functions -----
const dbGet = promisify(db.get.bind(db));
const dbRun = promisify(db.run.bind(db));

// ===== REGISTER ROUTE =====
router.post(
  "/register",
  upload.fields([
    { name: "id_card", maxCount: 1 },
    { name: "passport_photo", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        fullname, dob, email, phone, gender, marital_status,
        pin, farmer, investor, password, confirm_password, source
      } = req.body;

      // ====== Basic Validation ======
      if (!fullname || !dob || !email || !phone || !gender ||
          !marital_status || !pin || !farmer || !investor ||
          !password || !confirm_password || !source) {
        return res.status(400).send("All fields are required!");
      }

      if (password !== confirm_password) {
        return res.status(400).send("Passwords do not match!");
      }

      // ====== Uploaded Files ======
      const idCard = req.files["id_card"]?.[0]?.filename;
      const passportPhoto = req.files["passport_photo"]?.[0]?.filename;

      if (!idCard || !passportPhoto) {
        return res.status(400).send("Please upload both ID and passport photo!");
      }

      // ====== Check if user exists ======
      const userExists = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
      if (userExists) return res.status(400).send("Email already registered!");

      // ====== Hash Password ======
      let hashedPassword;
      try {
        hashedPassword = await bcrypt.hash(password, 10);
      } catch (e) {
        console.error("Password hashing failed:", e);
        return res.status(500).send("Server error during password hashing");
      }

      // ====== Generate UID ======
      const uid = `UID${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // ====== Insert into DB ======
      await dbRun(`
        INSERT INTO users
        (uid, fullname, dob, email, phone, gender, marital_status,
         pin, farmer, investor, password,
         id_card, passport_photo, source,
         balance, kyc_status, role, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
      `, [
        uid, fullname, dob, email, phone, gender, marital_status,
        pin, farmer, investor, hashedPassword,
        idCard, passportPhoto, source,
        100, "Pending", "user"
      ]);

      // ====== Telegram Notification ======
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        const message = `
✅ New User Registered
👤 Name: ${fullname}
📧 Email: ${email}
💰 Initial Balance: $100
        `;
        axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message
        }).catch(err => console.error("Telegram error:", err));
      }

      // ====== Welcome Email ======
      const transporter = req.app.locals.transporter;
      if (transporter) {
        transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Welcome to Elite Platform 🎉",
          html: `<h2>Welcome, ${fullname}!</h2>
                 <p>Your initial balance of $100 has been credited.</p>
                 <p>💼 <b>Your Login Email:</b> ${email}</p>`
        }).catch(err => console.error("Email error:", err));
      }

      console.log(`✅ New user registered: ${email}`);
      res.redirect("/success.html");

    } catch (err) {
      console.error("❌ Register error:", err);
      res.status(500).send("Server error");
    }
  }
);

// ----- LOGIN -----
router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.send("❌ Fill all fields");

  const admin = await dbGet("SELECT * FROM admin WHERE username = ?", [username]);
  if(!admin) return res.send("❌ Admin not found");

  const match = await bcrypt.compare(password, admin.password);
  if(!match) return res.send("❌ Wrong password");

  req.session.adminId = admin.id;
  res.redirect("/admin/dashboard");
});

// ----- LOGOUT -----
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ----- FORGOT PASSWORD -----
router.get("/forgot-password", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/forgot-password.html"));
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send("Email required");

    const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) return res.status(404).send("Email not registered");

    const otp = Math.floor(100000 + Math.random() * 900000);
    req.session.otp = otp;
    req.session.otpEmail = email;

    if (req.app.locals.transporter) {
      req.app.locals.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "OTP for Password Reset",
        text: `Your OTP is ${otp}`
      });
    }

    res.redirect(`/verify-otp.html?email=${encodeURIComponent(email)}`);

  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).send("Server error");
  }
});

// ----- VERIFY OTP -----
router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).send("All fields required");

  if (req.session.otp && req.session.otpEmail === email && req.session.otp == otp) {
    delete req.session.otp;
    delete req.session.otpEmail;
    res.redirect(`/reset-password.html?email=${encodeURIComponent(email)}`);
  } else {
    return res.status(400).send("Invalid OTP");
  }
});

// ----- RESET PASSWORD -----
router.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send("All fields required");

    const hashed = await bcrypt.hash(password, 10);
    await dbRun("UPDATE users SET password=? WHERE email=?", [hashed, email]);

    res.send("✅ Password reset successful! <a href='/login'>Login</a>");
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).send("Server error");
  }
});

// ----- GET LOGIN PAGE -----
router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

module.exports = router;