// utils/emailService.js
const { Resend } = require("resend");

// Make sure your Render environment variable is named exactly RESEND_API_KEY
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * sendEmail - sends an email via Resend
 * @param {string} to - recipient email
 * @param {string} subject - email subject
 * @param {string} htmlContent - HTML content of the email
 */
async function sendEmail(to, subject, htmlContent) {
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev", // works immediately for testing
      to: to,
      subject: subject,
      html: htmlContent,
    });
    console.log(`✅ Email sent to ${to} successfully!`);
  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
}

module.exports = sendEmail;