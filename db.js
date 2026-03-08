// db.js
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // only if needed for cloud DBs
  }
});

pool.on("connect", () => console.log("✅ PostgreSQL connected"));

module.exports = pool;