const express = require("express");
const router = express.Router();

// Service / Contact page
router.get("/contact", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Service Center</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f4f6f9;
          padding: 40px;
          text-align: center;
        }
        .box {
          background: white;
          max-width: 500px;
          margin: auto;
          padding: 30px;
          border-radius: 8px;
        }
        a {
          display: block;
          margin: 15px 0;
          padding: 12px;
          background: #0088cc;
          color: white;
          text-decoration: none;
          border-radius: 6px;
        }
        a:hover {
          background: #006fa3;
        }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>Service Center</h2>

        <a href="https://t.me/YourManagerUsername" target="_blank">
          👨‍💼 Chat with Manager
        </a>

        <a href="https://t.me/YourAccountOfficer" target="_blank">
          📊 Chat with Account Officer
        </a>

        
        <a href="https://t.me/YourAccountOfficer" target="_blank">
          📊 Chat with Account Officer
        </a>

        <a href="https://t.me/YourCustomerService" target="_blank">
          🎧 Customer Service (Telegram)
        </a>

        <p style="margin-top:20px;">
          📧 servicecenteragriculturalfoundation@gmail.com
        </p>
      </div>
    </body>
    </html>
  `);
});

module.exports = router;
