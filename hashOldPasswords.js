const bcrypt = require("bcrypt");
const { Pool } = require("pg");

// Make sure DATABASE_URL is in your .env
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function hashOldPasswords() {
  const res = await pool.query("SELECT id, password FROM users");
  for (let row of res.rows) {
    if (!row.password.startsWith("$2")) { // password not hashed yet
      const hash = await bcrypt.hash(row.password, 10);
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, row.id]);
      console.log(`Hashed password for user id ${row.id}`);
    }
  }
  console.log("✅ All old passwords are hashed!");
  await pool.end(); // only end the pool in this script
}

hashOldPasswords().catch(console.error);