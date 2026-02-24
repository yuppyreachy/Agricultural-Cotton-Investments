require('dotenv').config();
const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

// ===== Configure Gmail SMTP =====
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your Gmail
    pass: process.env.EMAIL_PASS  // use App Password
  }
});

// ===== SHOW FORGOT PASSWORD PAGE =====
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/forgot-password.html'));
});

// ===== HANDLE FORGOT PASSWORD REQUEST & SEND OTP =====
router.post('/', (req, res) => {
  const { user_identity } = req.body;
  if (!user_identity) return res.send("Please enter your email.");

  db.get("SELECT * FROM users WHERE email=?", [user_identity], (err, user) => {
    if (err) return res.send("Database error.");
    if (!user) return res.send("User not found.");

    // Store user in session
    req.session.tempUser = user.email;

    // Generate 6-digit OTP
    const generatedOTP = Math.floor(100000 + Math.random() * 900000);
    req.session.generatedOTP = generatedOTP;
    req.session.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 mins

    console.log("Generated OTP:", generatedOTP);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: '🔐 Cotton Investment Password Reset OTP',
      html: `
        <div style="font-family: Arial; padding: 20px; background:#f4f6f9;">
          <div style="max-width:500px; margin:auto; background:white; padding:30px; border-radius:10px;">
            <h2 style="text-align:center; color:#2c3e50;">Cotton Investment</h2>
            <p>You requested to reset your password. Enter the OTP below:</p>
            <div style="text-align:center; margin:30px 0;">
              <span style="font-size:28px; font-weight:bold; color:#27ae60; letter-spacing:5px;">
                ${generatedOTP}
              </span>
            </div>
            <p>This OTP will expire in <strong>10 minutes</strong>.</p>
            <hr>
            <p style="font-size:12px; color:gray; text-align:center;">© 2026 Cotton Investment</p>
          </div>
        </div>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return res.send("Error sending OTP email.");
      }

      console.log("OTP email sent:", info.response);
      res.sendFile(path.join(__dirname, '../public/otp.html'));
    });
  });
});

// ===== VERIFY OTP =====
router.post('/verify-otp', (req, res) => {
  const { otp } = req.body;
  const { generatedOTP, otpExpiry } = req.session;

  if (!generatedOTP || !otpExpiry) return res.send("OTP session expired. Request new OTP.");
  if (Date.now() > otpExpiry) {
    req.session.generatedOTP = null;
    req.session.otpExpiry = null;
    return res.send("OTP expired. Please request a new one.");
  }

  if (parseInt(otp) === generatedOTP) {
    return res.sendFile(path.join(__dirname, '../public/reset-password.html'));
  } else {
    return res.send("Invalid OTP.");
  }
});

// ===== RESET PASSWORD =====
router.post('/reset-password', async (req, res) => {
  const { new_password, confirm_password } = req.body;

  if (!new_password || !confirm_password) return res.send("Password fields cannot be empty.");
  if (new_password !== confirm_password) return res.send("Passwords do not match.");

  const hashedPassword = await bcrypt.hash(new_password, 10);
  const tempUser = req.session.tempUser;

  db.run("UPDATE users SET password=? WHERE email=?", [hashedPassword, tempUser], function(err) {
    if (err) return res.send("Error updating password.");

    // Clear session
    req.session.tempUser = null;
    req.session.generatedOTP = null;
    req.session.otpExpiry = null;

    res.sendFile(path.join(__dirname, '../public/reset-success.html'));
  });
});

module.exports = router;
