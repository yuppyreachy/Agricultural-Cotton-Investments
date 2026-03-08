// dbPostgres.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function query(text, params) {
  return pool.query(text, params);
}


// ================= Get User =================
async function getUser(userId) {
  const result = await pool.query(
    "SELECT * FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

// ================= Update Balance =================
async function updateBalance(userId, newBalance) {
  const result = await pool.query(
    "UPDATE users SET balance = $1 WHERE id = $2 RETURNING *",
    [newBalance, userId]
  );
  return result.rows[0] || null;
}

// ================= Get Admin by Username =================
async function getAdminByUsername(username) {
  const result = await pool.query(
    "SELECT * FROM admins WHERE username = $1",
    [username]
  );
  return result.rows[0] || null;
}

module.exports = {
  pool,
   query,
  getUser,
  updateBalance,
  getAdminByUsername
};