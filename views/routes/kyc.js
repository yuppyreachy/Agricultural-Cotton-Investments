const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const axios = require("axios");
const fs = require("fs");

// Database helpers
const { dbRun, dbGet } = require("../db"); // adjust according to your setup

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/kyc");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname.replace(/\s+/g, "_"));
  }
});

const upload = multer({ storage });

// KYC Route
router.post(
  "/kyc",
  upload.fields([
    { name: "id_front", maxCount: 1 },
    { name: "id_back", maxCount: 1 },
    { name: "ssn_proof", maxCount: 1 },
    { name: "proof_address", maxCount: 1 },
    { name: "signature", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.redirect("/login");

      const {
        fullname,
        email,
        address,
        marital_status,
        kids,
        pin,
        verification_type
      } = req.body;

      // Validation
      if (!fullname || !email || !address || !marital_status || !kids || !pin || !verification_type) {
        return res.status(400).send("All fields are required!");
      }

      // File uploads
      const idFront = req.files["id_front"]?.[0]?.filename;
      const idBack = req.files["id_back"]?.[0]?.filename;
      const ssnProof = req.files["ssn_proof"]?.[0]?.filename;
      const proofAddress = req.files["proof_address"]?.[0]?.filename;
      const signature = req.files["signature"]?.[0]?.filename;

      if (!idFront || !idBack || !ssnProof || !proofAddress || !signature) {
        return res.status(400).send("All documents must be uploaded!");
      }

      // Update user KYC data
      await dbRun(
        `UPDATE users SET
          fullname = ?,
          email = ?,
          address = ?,
          marital_status = ?,
          kids = ?,
          pin = ?,
          kyc_status = ?,
          id_front = ?,
          id_back = ?,
          ssn_proof = ?,
          proof_address = ?,
          signature = ?
         WHERE id = ?`,
        [
          fullname,
          email,
          address,
          marital_status,
          kids,
          pin,
          "Pending",
          idFront,
          idBack,
          ssnProof,
          proofAddress,
          signature,
          userId
        ]
      );

      // Telegram notification to admin
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        const message = `
📌 New KYC Submitted
👤 User: ${fullname}
📧 Email: ${email}
🗂 Uploaded Documents: ID, SSN, Proof of Address, Signature
        `;
        axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML"
        }).catch(err => console.error("Telegram error:", err));
      }

      // Welcome / confirmation email
      if (req.app.locals.transporter) {
        req.app.locals.transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "KYC Submitted - Pending Approval",
          html: `
            <h3>Hi ${fullname},</h3>
            <p>Your KYC has been successfully submitted and is pending verification.</p>
            <p>Once approved, you will have full access to deposits, withdrawals, and loan features.</p>
            <p>Thank you for securing your account!</p>
          `
        }).catch(err => console.error("Email error:", err));
      }

      console.log(`✅ KYC submitted: ${email}`);
      res.redirect("/dashboard");

    } catch (e) {
      console.error("❌ KYC submission error:", e);
      res.status(500).send("Server error while submitting KYC");
    }
  }
);

module.exports = router;
