require('dotenv').config(); // load your .env
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "********" : "MISSING");

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify connection
transporter.verify((error, success) => {
  if (error) console.log("SMTP Error:", error);
  else console.log("SMTP ready to send emails");
});

// Send a test email
transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: "justusalways33@gmail.com.com", // replace with your personal email
  subject: "Test Email from Node.js",
  text: "Hello! This is a test email to check Nodemailer setup."
}, (err, info) => {
  if (err) console.log("Error sending test email:", err);
  else console.log("Test email sent successfully:", info.response);
});
