const nodemailer = require("nodemailer");

// Create transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,    // set in .env
    pass: process.env.EMAIL_PASS
  }
});

/**
 * sendMail - send email
 * @param {string} to - recipient
 * @param {string} subject - subject
 * @param {string} html - HTML content
 */
const sendMail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"Elite Investment" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log("✅ Email sent to:", to);
  } catch (err) {
    console.error("❌ Email error:", err);
  }
};

module.exports = sendMail;
