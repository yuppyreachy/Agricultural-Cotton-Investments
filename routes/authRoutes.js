// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const path = require("path");
const multer = require("multer");
const pool = require("../dbPostgres");
const sendEmail = require("../utils/emailService");
const axios = require("axios");
// ===== Multer setup =====
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "../uploads/")),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

// ===== REGISTER =====
// ===== REGISTER =====
router.post(
  "/register",
  upload.fields([
    { name: "id_card", maxCount: 1 },
    { name: "passport_photo", maxCount: 1 }
  ]),
  async (req, res) => {
    try {

      const {
        fullname,
        dob,
        email,
        phone,
        gender,
        marital_status,
        pin,
        farmer,
        investor,
        password,
        confirm_password
      } = req.body;

      if (
        !fullname || !dob || !email || !phone || !gender ||
        !marital_status || !pin || !password || !confirm_password
      ) {
        return res.status(400).send("All fields are required!");
      }

      if (password !== confirm_password) {
        return res.status(400).send("Passwords do not match!");
      }

      const idCard = req.files?.id_card?.[0]?.filename || null;
      const passportPhoto = req.files?.passport_photo?.[0]?.filename || null;

      // check existing email
      const existing = await pool.query(
        "SELECT id FROM users WHERE email=$1",
        [email]
      );

      if (existing.rows.length > 0) {
        return res.status(400).send("Email already registered!");
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const uid = `UID${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // INSERT USER
      await pool.query(
        `
        INSERT INTO users
        (uid, fullname, dob, email, phone, gender, marital_status,
        pin, farmer, investor, password, id_card, passport_photo)
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `,
        [
          uid,
          fullname,
          dob,
          email,
          phone,
          gender,
          marital_status,
          pin,
          farmer === "true" || farmer === "on",
          investor === "true" || investor === "on",
          hashedPassword,
          idCard,
          passportPhoto
        ]
      );

      // ===== EMAIL NOTIFICATION =====
await sendEmail(
  email,
  "Registration Successful",
  `
  <h2>Welcome ${fullname}</h2>
  <p>Your account was created successfully.</p>
  <p><b>UID:</b> ${uid}</p>
  <p>You can now login to your dashboard.</p>
  `
);

      // ===== TELEGRAM NOTIFICATION =====
      const telegramMessage = `
New User Registered

Name: ${fullname}
Email: ${email}
Phone: ${phone}
UID: ${uid}
`;

      // ===== SUCCESS PAGE =====
      res.redirect("/success.html");

    } catch (err) {
      console.error("Register Error:", err);
      res.status(500).send("Server error");
    }
  }
);

// ===== LOGIN =====
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send("Email and password required");
    }

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(400).send("Invalid email or password");
    }

    // ===== Password check for old + new users =====
    let passwordMatch = false;

    // If password is hashed (new user)
    if (user.password.startsWith("$2b$")) {
      passwordMatch = await bcrypt.compare(password, user.password);
    }
    // If password is plain text (old user)
    else {
      passwordMatch = password === user.password;

      // ✅ Upgrade old password to hashed automatically
      if (passwordMatch) {
        const newHash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE users SET password=$1 WHERE id=$2", [newHash, user.id]);
      }
    }

    if (!passwordMatch) {
      return res.status(400).send("Invalid email or password");
    }

    // ===== Login success =====
    req.session.user = {
      id: user.id,
      email: user.email,
      fullname: user.fullname
    };

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error");
  }
});

// ===== LOGIN PAGE =====
router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

// ===== LOGOUT =====
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ===== FORGOT PASSWORD =====
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Email not registered");
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    req.session.otp = otp;
    req.session.otpEmail = email;

    console.log("OTP:", otp);

    res.redirect(`/verify-otp.html?email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ===== VERIFY OTP =====
router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (
    req.session.otp &&
    req.session.otpEmail === email &&
    req.session.otp == otp
  ) {
    delete req.session.otp;
    delete req.session.otpEmail;

    res.redirect(`/reset-password.html?email=${encodeURIComponent(email)}`);
  } else {
    res.status(400).send("Invalid OTP");
  }
});

// ===== RESET PASSWORD =====
router.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      "UPDATE users SET password=$1 WHERE email=$2",
      [hashed, email]
    );

    res.send("Password reset successful. <a href='/login'>Login</a>");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
