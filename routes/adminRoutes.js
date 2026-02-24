const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const db = require("../database");

// ===============================
// ADMIN LOGIN PAGE
// ===============================
router.get("/login", (req, res) => {
  res.render("admin/login");
});

// ===============================
// ADMIN LOGIN PROCESS
// ===============================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM admins WHERE email = ?", [email], async (err, admin) => {
    if (err || !admin) return res.send("Invalid admin login ❌");

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.send("Invalid admin login ❌");

    req.session.admin = { id: admin.id, email: admin.email };
    res.redirect("/admin/dashboard");
  });
});

// ===============================
// ADMIN LOGOUT
// ===============================
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

// ===============================
// ADMIN AUTH MIDDLEWARE
// ===============================
function isAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.redirect("/admin/login");
}

// ===============================
// DASHBOARD
// ===============================
router.get("/dashboard", isAdmin, (req, res) => {
  db.all("SELECT * FROM users ORDER BY id DESC", [], (err, users) => {
    if (err) return res.status(500).json({ error: "Server error" });

    res.render("admin/dashboard", {
      admin: req.session.admin,
      users
    });
  });
});

// ===============================
// GET SINGLE USER
// ===============================
router.get("/user/:id", isAdmin, (req, res) => {
  db.get("SELECT * FROM users WHERE id = ?", [req.params.id], (err, user) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });
});

// ===============================
// ADD / SUBTRACT BALANCE
// ===============================
router.post("/balance/:id", isAdmin, (req, res) => {
  const userId = req.params.id;
  const amount = Number(req.body.amount);

  if (isNaN(amount))
    return res.status(400).json({ error: "Invalid amount" });

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
      if (err || !user) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: "User not found" });
      }

      const newBalance = user.balance + amount;
      if (newBalance < 0) {
        db.run("ROLLBACK");
        return res.status(400).json({ error: "Insufficient balance" });
      }

      db.run(
        "UPDATE users SET balance = ? WHERE id = ?",
        [newBalance, userId],
        (err) => {
          if (err) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: "Update failed" });
          }
          db.run("COMMIT");
          res.json({ success: true, balance: newBalance });
        }
      );
    });
  });
});

// ===============================
// DEPOSIT APPROVAL
// ===============================
router.post("/deposit/:id/:action", isAdmin, (req, res) => {
  const { id, action } = req.params;

  db.serialize(() => {
    db.get("SELECT * FROM deposits WHERE id = ?", [id], (err, deposit) => {
      if (err || !deposit) return res.status(404).json({ error: "Deposit not found" });
      if (deposit.status !== "pending") return res.status(400).json({ error: "Already processed" });

      const newStatus = action === "approve" ? "approved" : "declined";

      db.run("BEGIN TRANSACTION");

      db.run(
        "UPDATE deposits SET status = ? WHERE id = ?",
        [newStatus, id],
        (err) => {
          if (err) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: "Update failed" });
          }

          if (newStatus === "approved") {
            db.run(
              "UPDATE users SET balance = balance + ? WHERE id = ?",
              [deposit.amount, deposit.userId],
              (err) => {
                if (err) {
                  db.run("ROLLBACK");
                  return res.status(500).json({ error: "Balance update failed" });
                }
                db.run("COMMIT");
                res.json({ success: true });
              }
            );
          } else {
            db.run("COMMIT");
            res.json({ success: true });
          }
        }
      );
    });
  });
});

// ===============================
// WITHDRAWAL APPROVAL
// ===============================
router.post("/withdraw/:id/:action", isAdmin, (req, res) => {
  const { id, action } = req.params;

  db.serialize(() => {
    db.get("SELECT * FROM withdrawals WHERE id = ?", [id], (err, w) => {
      if (err || !w) return res.status(404).json({ error: "Withdrawal not found" });
      if (w.status !== "pending") return res.status(400).json({ error: "Already processed" });

      const newStatus = action === "approve" ? "approved" : "declined";

      db.run("BEGIN TRANSACTION");

      db.get("SELECT * FROM users WHERE id = ?", [w.userId], (err, user) => {
        if (err || !user) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: "User not found" });
        }

        if (action === "approve" && user.balance < w.amount) {
          db.run("ROLLBACK");
          return res.status(400).json({ error: "Insufficient balance" });
        }

        db.run(
          "UPDATE withdrawals SET status = ? WHERE id = ?",
          [newStatus, id],
          (err) => {
            if (err) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: "Update failed" });
            }

            if (newStatus === "approved") {
              db.run(
                "UPDATE users SET balance = balance - ? WHERE id = ?",
                [w.amount, w.userId],
                (err) => {
                  if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: "Balance update failed" });
                  }
                  db.run("COMMIT");
                  res.json({ success: true });
                }
              );
            } else {
              db.run("COMMIT");
              res.json({ success: true });
            }
          }
        );
      });
    });
  });
});

// ===============================
// LOAN APPROVAL
// ===============================
router.post("/loan/:id/:action", isAdmin, (req, res) => {
  const { id, action } = req.params;

  db.get("SELECT * FROM loans WHERE id = ?", [id], (err, loan) => {
    if (err || !loan) return res.status(404).json({ error: "Loan not found" });
    if (loan.status !== "pending") return res.status(400).json({ error: "Already processed" });

    const newStatus = action === "approve" ? "approved" : "declined";

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      db.run(
        "UPDATE loans SET status = ? WHERE id = ?",
        [newStatus, id],
        (err) => {
          if (err) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: "Update failed" });
          }

          if (newStatus === "approved") {
            db.run(
              "UPDATE users SET balance = balance + ? WHERE id = ?",
              [loan.amount, loan.userId],
              (err) => {
                if (err) {
                  db.run("ROLLBACK");
                  return res.status(500).json({ error: "Balance update failed" });
                }
                db.run("COMMIT");
                res.json({ success: true });
              }
            );
          } else {
            db.run("COMMIT");
            res.json({ success: true });
          }
        }
      );
    });
  });
});

// ===============================
// KYC APPROVAL
// ===============================
router.post("/kyc/:id/:action", isAdmin, (req, res) => {
  const { id, action } = req.params;
  const newStatus = action === "approve" ? "approved" : "declined";

  db.run("UPDATE kyc SET status = ? WHERE id = ?", [newStatus, id], function (err) {
    if (err) return res.status(500).json({ error: "Update failed" });
    res.json({ success: true });
  });
});

// ===============================
// ADMIN ↔ USER CHAT
// ===============================
router.get("/chat/:userId", isAdmin, (req, res) => {
  db.all(
    "SELECT * FROM messages WHERE userId = ? ORDER BY created_at ASC",
    [req.params.userId],
    (err, messages) => {
      if (err) return res.status(500).json({ error: "Server error" });
      res.json(messages);
    }
  );
});

router.post("/chat/:userId", isAdmin, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  db.run(
    "INSERT INTO messages (userId, sender, message, created_at) VALUES (?, 'admin', ?, datetime('now'))",
    [req.params.userId, message],
    function (err) {
      if (err) return res.status(500).json({ error: "Failed to send message" });
      res.json({ success: true });
    }
  );
});

module.exports = router;
