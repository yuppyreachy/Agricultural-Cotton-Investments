const express = require("express");
const router = express.Router();
const db = require("../database");

// ===============================
// GET ALL INVESTMENT PLANS
// ===============================
router.get("/plans", (req,res) => {
    db.all("SELECT * FROM investment_plans", [], (err, plans) => {
        if(err) return res.send("Database error");
        res.render("plans", { plans }); // Send plans to frontend
    });
});


// ===============================
// CREATE INVESTMENT
// ===============================
router.post("/", (req, res) => {
  const user = req.session.user;
  const { plan, amount } = req.body;

  if (!user) return res.status(401).send("Login required");
  if (!plan || !amount || amount <= 0) return res.send("Invalid data");

  // choose profit %
  const daily_profit =
    plan === "Basic" ? 1 :
    plan === "Silver" ? 2 :
    plan === "Gold" ? 3 : 0;

  if (daily_profit === 0) return res.send("Invalid plan");

  // check user balance first
  db.get("SELECT balance FROM users WHERE id=?", [user.id], (err, row) => {
    if (err) return res.send("Database error");
    if (!row) return res.send("User not found");

    if (row.balance < amount)
      return res.send("Insufficient balance");

    // deduct balance
    db.run(
      "UPDATE users SET balance = balance - ? WHERE id=?",
      [amount, user.id],
      err => {
        if (err) return res.send("Balance update failed");

        // insert investment
        db.run(
          "INSERT INTO investments (user_id, plan, amount, daily_profit, created_at) VALUES (?,?,?,?,datetime('now'))",
          [user.id, plan, amount, daily_profit],
          err => {
            if (err) return res.send("Investment failed");
            res.send("Investment created successfully");
          }
        );
      }
    );
  });
});

module.exports = router;
