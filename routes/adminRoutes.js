const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const db = require("../database");

/* ===============================
   HELPER PROMISE WRAPPERS
================================ */
const dbGet = (query, params = []) =>
  new Promise((resolve, reject) =>
    db.get(query, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

const dbAll = (query, params = []) =>
  new Promise((resolve, reject) =>
    db.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

const dbRun = (query, params = []) =>
  new Promise((resolve, reject) =>
    db.run(query, params, function (err) {
      err ? reject(err) : resolve(this);
    })
  );

/* ===============================
   ADMIN AUTH
================================ */
function isAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect("/admin/login");
}

/* ===============================
   LOGIN
================================ */
router.get("/login", (req, res) => {
  res.render("admin/login");
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await dbGet("SELECT * FROM admins WHERE email = ?", [email]);
    if (!admin) return res.send("Invalid login ❌");

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.send("Invalid login ❌");

    req.session.admin = { id: admin.id, email: admin.email };
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error(err);
    res.send("Login error ❌");
  }
});

/* ===============================
   LOGOUT
================================ */
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

/* ===============================
   DASHBOARD
================================ */
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    const users = await dbAll("SELECT * FROM users ORDER BY id DESC");
    const pendingDeposits = await dbAll(
      "SELECT * FROM deposits WHERE status='pending' ORDER BY created_at DESC"
    );

    res.render("admin/dashboard", {
      admin: req.session.admin,
      users,
      pendingDeposits
    });
  } catch (err) {
    console.error(err);
    res.send("Dashboard error ❌");
  }
});

/* ===============================
   STATS API
================================ */
router.get("/stats", isAdmin, async (req, res) => {
  try {
    const users = await dbAll("SELECT * FROM users");
    const deposits = await dbAll(
      "SELECT * FROM deposits WHERE status='approved'"
    );
    const withdrawals = await dbAll(
      "SELECT * FROM withdrawals WHERE status='approved'"
    );

    const totalDeposits = deposits.reduce((s, d) => s + d.amount, 0);
    const totalWithdrawals = withdrawals.reduce((s, w) => s + w.amount, 0);

    res.json({
      totalUsers: users.length,
      totalDeposits,
      totalWithdrawals,
      revenue: totalDeposits - totalWithdrawals
    });
  } catch (err) {
    res.status(500).json({ error: "Stats failed" });
  }
});

/* ===============================
   PROCESS REQUEST HANDLER
================================ */
async function processRequest(table, id, action, affectBalance = false, sign = 1) {
  const allowedTables = ["deposits", "withdrawals", "loans", "kyc_requests"];
  if (!allowedTables.includes(table)) throw "Invalid table";

  const request = await dbGet(`SELECT * FROM ${table} WHERE id=?`, [id]);
  if (!request) throw "Request not found";
  if (request.status !== "pending") throw "Already processed";

  const status = action === "approve" ? "approved" : "declined";

  await dbRun("BEGIN TRANSACTION");
  try {
    await dbRun(`UPDATE ${table} SET status=? WHERE id=?`, [status, id]);

    if (status === "approved" && affectBalance && table !== "kyc_requests") {
      await dbRun(
        "UPDATE users SET balance = balance + ? WHERE id=?",
        [request.amount * sign, request.user_id]
      );
    }

    await dbRun("COMMIT");
  } catch (err) {
    await dbRun("ROLLBACK");
    throw err;
  }
}

/* ===============================
   DEPOSITS / WITHDRAWALS / LOANS / KYC
================================ */
router.post("/deposit/:id/:action", isAdmin, async (req, res) => {
  try {
    await processRequest("deposits", req.params.id, req.params.action, true, 1);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

router.post("/withdraw/:id/:action", isAdmin, async (req, res) => {
  try {
    await processRequest("withdrawals", req.params.id, req.params.action, true, -1);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

router.post("/loan/:id/:action", isAdmin, async (req, res) => {
  try {
    await processRequest("loans", req.params.id, req.params.action, true, 1);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

router.post("/kyc/:id/:action", isAdmin, async (req, res) => {
  try {
    await processRequest("kyc_requests", req.params.id, req.params.action);
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
  if (isNaN(amount)) return res.status(400).json({ error: "Invalid amount" });

  try {
    await dbRun("UPDATE users SET balance = balance + ? WHERE id=?", [
      amount,
      req.params.id
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Balance failed" });
  }
});

/* ===============================
   CHAT
================================ */
router.get("/chat/:userId", isAdmin, async (req, res) => {
  try {
    const messages = await dbAll(
      "SELECT * FROM messages WHERE user_id=? ORDER BY created_at ASC",
      [req.params.userId]
    );
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Chat error" });
  }
});

router.post("/chat/:userId", isAdmin, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    await dbRun(
      "INSERT INTO messages (user_id,sender,message,created_at) VALUES (?, 'admin', ?, datetime('now'))",
      [req.params.userId, message]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Send failed" });
  }
});

/* ===============================
   USER ACTIVITY LOGS
================================ */
router.get("/activity/:userId", isAdmin, async (req, res) => {
  try {
    const deposits = await dbAll(
      "SELECT 'Deposit' AS type, amount, status, created_at FROM deposits WHERE user_id=?",
      [req.params.userId]
    );
    const withdrawals = await dbAll(
      "SELECT 'Withdrawal' AS type, amount, status, created_at FROM withdrawals WHERE user_id=?",
      [req.params.userId]
    );
    const activity = deposits.concat(withdrawals).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: "Activity fetch failed" });
  }
});

module.exports = router;
