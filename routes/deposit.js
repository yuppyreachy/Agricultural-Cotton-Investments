const express = require("express");
const router = express.Router();
const db = require("../db/database");
const multer = require("multer");
const path = require("path");
const axios = require("axios");

// ================= UPLOAD CONFIG =================
const storage = multer.diskStorage({
  destination: "public/proofs",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ================= DEPOSIT PAGE =================
router.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  db.all(
    "SELECT * FROM deposits WHERE user_id=? ORDER BY id DESC",
    [req.session.user.id],
    (err, deposits) => {
      if (err) {
        console.error(err);
        deposits = [];
      }
      res.render("deposit", { deposits });
    }
  );
});

// ================= CRYPTO DEPOSIT =================
router.post("/crypto", (req, res) => {
  const { amount } = req.body;
  const userId = req.session.user.id;

  if (!amount || parseFloat(amount) < 10) {
    return res.status(400).send("Invalid deposit amount. Minimum $10.");
  }

  // Insert deposit as pending
  db.run(
    "INSERT INTO deposits (user_id, method, amount, status, created_at) VALUES (?,?,?,?,datetime('now'))",
    [userId, "crypto", amount, "pending"],
    function (err) {
      if (err) {
        console.error("Crypto deposit error:", err);
        return res.status(500).send("Server error");
      }

      const depositId = this.lastID;

      // Notify admin via Telegram
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        const message = `💰 New Crypto Deposit Pending
User: ${req.session.user.fullname}
Amount: $${amount}
Deposit ID: ${depositId}`;
        axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          { chat_id: process.env.TELEGRAM_CHAT_ID, text: message }
        ).catch(console.error);
      }

      // Notify admin via email
      const transporter = req.app.locals.transporter;
      if (transporter && process.env.ADMIN_EMAIL) {
        transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.ADMIN_EMAIL,
          subject: "New Crypto Deposit Pending",
          html: `<h3>New Crypto Deposit Pending</h3>
                 <p>User: ${req.session.user.fullname}</p>
                 <p>Amount: $${amount}</p>
                 <p>Deposit ID: ${depositId}</p>`
        }, (errMail) => { if(errMail) console.error("Mail error:", errMail); });
      }

      // Redirect to pending page
      res.redirect(`/deposit/pending/${depositId}`);
    }
  );
});

// ================= PENDING PAGE =================
router.get("/pending/:id", (req, res) => {
  const depositId = req.params.id;
  if (!req.session.user) return res.redirect("/login");

  db.get("SELECT * FROM deposits WHERE id=? AND user_id=?", [depositId, req.session.user.id], (err, deposit) => {
    if (err || !deposit) return res.redirect("/deposit");

    res.sendFile(path.join(__dirname, "../views/pending.html"));
  });
});

// ================= CHECK DEPOSIT STATUS (AJAX) =================
router.get("/status/:id", (req, res) => {
  const depositId = req.params.id;
  db.get("SELECT status FROM deposits WHERE id=?", [depositId], (err, row) => {
    if (err || !row) return res.json({ status: "error" });
    res.json({ status: row.status });
  });
});

// ================= CONFIRM PAYMENT (Admin Action) =================
router.post("/confirm/:id", async (req, res) => {
  try {
    const depositId = req.params.id;

    // Get deposit
    const deposit = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM deposits WHERE id=?", [depositId], (err, row) => (err ? reject(err) : resolve(row)));
    });

    if (!deposit) return res.status(404).send("Deposit not found");
    if (deposit.status === "confirmed") return res.send("Already confirmed");

    // Update deposit to confirmed
    await new Promise((resolve, reject) => {
      db.run("UPDATE deposits SET status='confirmed' WHERE id=?", [depositId], (err) => (err ? reject(err) : resolve()));
    });

    // Update user balance
    await new Promise((resolve, reject) => {
      db.run("UPDATE users SET balance = balance + ? WHERE id=?", [deposit.amount, deposit.user_id], (err) => (err ? reject(err) : resolve()));
    });

    res.send(`✅ Deposit ${depositId} confirmed and balance updated`);
  } catch (err) {
    console.error("Confirm deposit error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;