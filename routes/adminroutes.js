// routes/adminRoutes.js
const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const db = require("../dbPostgres"); // PostgreSQL helpers

/* ===============================
   ADMIN AUTH MIDDLEWARE
================================ */

function isAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect("/admin/login");
}

/* ===============================
   LOGIN
================================ */

router.post("/login", async (req, res) => {

  if (!req.body) {
    return res.render("admin/login", { error: "Form not submitted correctly ❌" });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.render("admin/login", { error: "Missing credentials ❌" });
  }

  try {
    const admin = await db.getAdminByUsername(username);

    if (!admin) {
      return res.render("admin/login", { error: "Invalid login ❌" });
    }

    const match = await bcrypt.compare(password, admin.password);

    if (!match) {
      return res.render("admin/login", { error: "Invalid login ❌" });
    }

    req.session.admin = {
      id: admin.id,
      username: admin.username
    };

    res.redirect("/admin/dashboard");

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.render("admin/login", { error: "Login error ❌" });
  }

});

/* ===============================
   DASHBOARD
================================ */

router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    const users = (await db.pool.query("SELECT * FROM users ORDER BY id DESC")).rows;
    const deposits = (await db.pool.query(
      "SELECT d.*, u.email FROM deposits d JOIN users u ON d.user_id = u.id ORDER BY d.created_at DESC"
    )).rows;
    const withdrawals = (await db.pool.query(
      "SELECT w.*, u.email FROM withdrawals w JOIN users u ON w.user_id = u.id ORDER BY w.created_at DESC"
    )).rows;

    res.render("admin/dashboard", {
      admin: req.session.admin,
      users,
      deposits,
      withdrawals
    });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.send("Dashboard error ❌");
  }
});

/* ===============================
   APPROVE / DECLINE REQUEST
================================ */

async function processRequest(table, id, action, balanceSign = 1) {
  const allowed = ["deposits", "withdrawals"];
  if (!allowed.includes(table)) throw "Invalid table";

  const request = (await db.pool.query(`SELECT * FROM ${table} WHERE id=$1`, [Number(id)])).rows[0];
  if (!request) throw "Request not found";
  if (request.status !== "pending") throw "Already processed";

  const status = action === "approve" ? "approved" : "declined";

  try {
    await db.pool.query("BEGIN");

    await db.pool.query(`UPDATE ${table} SET status=$1 WHERE id=$2`, [status, Number(id)]);

    if (status === "approved") {
      await db.pool.query(
        "UPDATE users SET balance = balance + $1 WHERE id=$2",
        [Number(request.amount) * balanceSign, Number(request.user_id)]
      );
    }

    await db.pool.query("COMMIT");
  } catch (err) {
    await db.pool.query("ROLLBACK");
    console.error("PROCESS ERROR:", err);
    throw err;
  }
}

/* ===============================
   DEPOSIT ROUTES
================================ */

router.post("/deposit/:id/:action", isAdmin, async (req, res) => {
  try {
    await processRequest("deposits", req.params.id, req.params.action, 1);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

/* ===============================
   WITHDRAW ROUTES
================================ */

router.post("/withdraw/:id/:action", isAdmin, async (req, res) => {
  try {
    await processRequest("withdrawals", req.params.id, req.params.action, -1);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

/* ===============================
   MANUAL BALANCE UPDATE
================================ */

router.post("/balance/:id", isAdmin, async (req, res) => {
  const amount = Number(req.body.amount);

  if (isNaN(amount)) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    const updatedUser = await db.updateBalance(Number(req.params.id), amount);
    res.json({ success: true, newBalance: updatedUser.balance });
  } catch (err) {
    console.error("BALANCE ERROR:", err);
    res.status(500).json({ error: "Balance update failed" });
  }
});

/* ===============================
   CHAT
================================ */

router.get("/chat/:userId", isAdmin, async (req, res) => {
  try {
    const messages = (await db.pool.query(
      "SELECT * FROM messages WHERE user_id=$1 ORDER BY created_at ASC",
      [Number(req.params.userId)]
    )).rows;

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Chat fetch failed" });
  }
});

router.post("/chat/:userId", isAdmin, async (req, res) => {
  const { message } = req.body;

  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    await db.pool.query(
      "INSERT INTO messages (user_id, sender, message, created_at) VALUES ($1, 'admin', $2, NOW())",
      [Number(req.params.userId), message]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Chat send failed" });
  }
});

/* ===============================
   STATS ROUTE
================================ */

router.get("/stats", isAdmin, async (req, res) => {
  try {
    const users = (await db.pool.query("SELECT * FROM users")).rows;
    const deposits = (await db.pool.query("SELECT * FROM deposits WHERE status='approved'")).rows;
    const withdrawals = (await db.pool.query("SELECT * FROM withdrawals WHERE status='approved'")).rows;

    const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const revenue = totalDeposits - totalWithdrawals;

    res.json({
      totalUsers: users.length,
      totalDeposits,
      totalWithdrawals,
      revenue
    });
  } catch (err) {
    console.error("STATS ERROR:", err);
    res.status(500).json({ error: "Stats fetch failed" });
  }
});

/* ===============================
   LOGOUT
================================ */

router.post("/logout", isAdmin, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("Could not log out");
    res.send("✅ Logged out successfully");
  });
});

module.exports = router;
