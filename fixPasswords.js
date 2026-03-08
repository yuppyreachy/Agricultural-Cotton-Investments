require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

// Configure PostgreSQL pool (reuse your .env variables)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixPasswords() {
  try {
    const { rows: users } = await pool.query("SELECT id, email, password FROM users");

    console.log(`Found ${users.length} users, checking passwords...`);

    let updatedCount = 0;

    for (let user of users) {
      // If password is likely plaintext (not bcrypt hash)
      if (!user.password.startsWith("$2b$") && user.password.length < 60) {
        const hash = await bcrypt.hash(user.password, 10);
        await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, user.id]);
        console.log(`✅ Hashed password for ${user.email}`);
        updatedCount++;
      }
    }

    console.log(`\nFinished! ${updatedCount} user(s) updated.`);
  } catch (err) {
    console.error("Error fixing passwords:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixPasswords();