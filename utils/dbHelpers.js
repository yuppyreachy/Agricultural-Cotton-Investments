// dbHelpers.js
const pool = require("./db");

// fetch single row
async function dbGet(query, params = []) {
  const res = await pool.query(query, params);
  return res.rows[0] || null;
}

// fetch multiple rows
async function dbAll(query, params = []) {
  const res = await pool.query(query, params);
  return res.rows;
}

// run query (insert/update/delete)
async function dbRun(query, params = []) {
  return pool.query(query, params);
}

module.exports = { dbGet, dbAll, dbRun };