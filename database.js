const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database.sqlite");

console.log("📂 Using database at:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ Database connection error:", err);
  else console.log("✅ SQLite connected");
});

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE,
      fullname TEXT NOT NULL,
      dob TEXT,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      gender TEXT,
      marital_status TEXT,
      farmer TEXT,
      investor TEXT,
      pin TEXT,
      password TEXT NOT NULL,
      id_card TEXT,
      passport_photo TEXT,
      source TEXT,
      balance REAL DEFAULT 0,
      profit REAL DEFAULT 0,
      kyc_status TEXT DEFAULT 'Pending',
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error("❌ Error creating users table:", err);
    else console.log("✅ Users table ready");
  });


  // ------------------ DEPOSITS ------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT,
      status TEXT DEFAULT 'Pending',
      bank_name TEXT,
      account_number TEXT,
      account_holder TEXT,
      instructions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // ------------------ WITHDRAWALS ------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS withdrawals(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      method TEXT,
      amount REAL,
      info TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  

  // ------------------ INVESTMENTS ------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan TEXT NOT NULL,
      amount REAL NOT NULL,
      profit REAL NOT NULL,
      withdrawable REAL DEFAULT 0,
      status TEXT DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // ------------------ LOANS ------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS loans(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL,
      duration TEXT,
      method TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // ------------------ KYC ------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS kyc(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      full_name TEXT,
      email TEXT,
      address TEXT,
      marital_status TEXT,
      kids INTEGER,
      id_front TEXT,
      id_back TEXT,
      ssn TEXT,
      proof_address TEXT,
      security_pin TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // ------------------ CHAT ------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS chat(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // ------------------ ADMIN ------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS admin(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `, async (err) => {
    if (err) console.error("❌ Admin table error:", err);
    else {
      console.log("✅ Admin table ready");

      // Insert default admin if not exists
      const defaultAdmin = 'Justusalways';
      const defaultPass = '12345Just67890Us@';
      const hashed = await bcrypt.hash(defaultPass, 10);
      db.run(`
        INSERT OR IGNORE INTO admin (username, password)
        VALUES (?, ?)
      `, [defaultAdmin, hashed]);
    }
  });

  // ------------------ POSTS ------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS posts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

});

module.exports = db;