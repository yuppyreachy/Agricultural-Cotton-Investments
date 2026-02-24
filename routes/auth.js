const express = require("express");
const router = express.Router();
module.exports = router;


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