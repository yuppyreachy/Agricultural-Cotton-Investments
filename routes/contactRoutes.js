const express = require("express");
const router = express.Router();

// Service / Contact page
router.get("/contact", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Center</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Poppins', sans-serif;
        background: #f4f6f9;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
      }

      .container {
        background: #ffffff;
        padding: 40px;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        text-align: center;
        transition: transform 0.3s;
      }

      .container:hover {
        transform: translateY(-5px);
      }

      h2 {
        color: #222;
        margin-bottom: 25px;
      }

      .contact-btn {
        display: block;
        margin: 15px 0;
        padding: 14px 0;
        background: linear-gradient(135deg, #0088cc, #00bfff);
        color: #fff;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.3s;
      }

      .contact-btn:hover {
        background: linear-gradient(135deg, #006fa3, #0095d1);
        transform: translateY(-3px);
      }

      .email-link {
        display: inline-block;
        margin-top: 25px;
        color: #0088cc;
        text-decoration: none;
        font-weight: 500;
      }

      .email-link:hover {
        text-decoration: underline;
      }

      /* Contact form styling */
      form {
        margin-top: 30px;
        display: flex;
        flex-direction: column;
      }

      input, textarea {
        padding: 12px;
        margin-bottom: 15px;
        border-radius: 6px;
        border: 1px solid #ccc;
        font-size: 14px;
      }

      button {
        padding: 14px;
        background: linear-gradient(135deg, #00bfff, #0088cc);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
      }

      button:hover {
        background: linear-gradient(135deg, #0095d1, #006fa3);
        transform: translateY(-3px);
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Service Center</h2>

      <a class="contact-btn" href="https://t.me/YourManagerUsername" target="_blank" rel="noopener noreferrer">
        👨‍💼 Chat with Manager
      </a>

      <a class="contact-btn" href="https://t.me/YourAccountOfficer" target="_blank" rel="noopener noreferrer">
        📊 Chat with Account Officer
      </a>

      <a class="contact-btn" href="https://t.me/YourCustomerService" target="_blank" rel="noopener noreferrer">
        🎧 Customer Service (Telegram)
      </a>

      <a class="email-link" href="mailto:servicecenteragriculturalfoundation@gmail.com">
        📧 servicecenteragriculturalfoundation@gmail.com
      </a>

      <!-- Optional contact form -->
      <form method="POST" action="/contact/send">
        <input type="text" name="name" placeholder="Your Name" required />
        <input type="email" name="email" placeholder="Your Email" required />
        <textarea name="message" rows="4" placeholder="Your Message" required></textarea>
        <button type="submit">Send Message</button>
      </form>
    </div>
  </body>
  </html>
  `);
});

module.exports = router;