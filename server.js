const { Pool } = require('pg'); // PostgreSQL
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Render/Postgres requirement
});

// Test DB
pool.query("SELECT NOW()")
  .then(res => console.log("DB Connected:", res.rows))
  .catch(err => console.error("DB Connection Error:", err));

const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const multer = require("multer");
const session = require("express-session");
const axios = require("axios");
const sgMail = require("@sendgrid/mail");
const fs = require("fs");

// ======================
// DATABASE SETUP
// ======================
const db = require("./dbPostgres"); // should export pool/query functions

// ======================
// EMAIL SETUP
// ======================
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail(to, subject, message) {
  const msg = {
    to,
    from: "Agriculturalfoundationiv@gmail.com",
    subject,
    text: message,
    html: `<p>${message}</p>`,
  };
  await sgMail.send(msg);
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((err) => {
  if (err) console.error("❌ SMTP Error:", err);
  else console.log("✅ SMTP ready");
});

// ======================
// HTTP + SOCKET.IO
// ======================
const server = http.createServer(app);
const io = new Server(server);

// ======================
// ROUTES
// ======================
const adminRoutes = require("./routes/adminroutes");
const sendMail = require("./routes/mailer");
const contactRoute = require("./routes/contactRoutes");
const authRoutes = require("./routes/authRoutes");

// Middleware to protect admin routes
function checkAdmin(req, res, next) {
  // Check if session has admin flag
  if (!req.session?.admin) {
    return res.redirect("/admin/login"); // redirect if not admin
  }
  next();
}


app.use("/", contactRoute);
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);

// ======================
// SESSION + MIDDLEWARE
// ======================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
  })
);
app.set("view engine", "ejs");

function adminAuth(req, res, next) {
  if (!req.session.admin) {
    console.log("⚠️ Unauthorized admin access attempt");
    return res.redirect("/admin"); // admin login page
  }
  next();
}

// ======================
// MULTER SETUP
// ======================
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

// ======================
// TELEGRAM BOT
// ======================
async function sendTelegramMessage(msg) {
  try {
    if (!process.env.TELEGRAM_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;

    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: msg,
        parse_mode: "HTML",
      }
    );
  } catch (err) {
    console.error("Telegram message failed:", err.message);
  }
}

// ======================
// VALIDATION
// ======================
function isValidWallet(wallet) {
  const re = /^[a-zA-Z0-9]{26,35}$/;
  return re.test(wallet);
}

// ======================
// TEMP STORES
// ======================
const otpStore = {};
let adminOnline = false;

// ======================
// DB CHECKS
// ======================
(async () => {
  try {
    console.log("CONNECTED DATABASE:", process.env.DATABASE_URL);
    const res = await db.query("SELECT NOW()");
    console.log("DB Connected:", res.rows);

    const admins = await db.query("SELECT * FROM admins");
    console.log("Admins:", admins.rows);
  } catch (err) {
    console.error("DB ERROR:", err);
  }
})();

async function hashOldPasswords() {
  const res = await pool.query("SELECT id, password FROM users");
  for (let row of res.rows) {
    const pwd = row.password;
    // Check if already hashed (bcrypt hashes start with $2)
    if (!pwd.startsWith("$2")) {
      const hash = await bcrypt.hash(pwd, 10);
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, row.id]);
      console.log(`Hashed password for user id ${row.id}`);
    }
  }
  console.log("All old passwords are hashed!");
}


// ======================
// ADMIN CREDENTIAL CHECK
// ======================
const adminPass = process.env.ADMIN_PASS;
if (!adminPass) {
  console.error("❌ ADMIN_PASS is missing in .env file");
  process.exit(1);
} else {
  console.log("✅ ADMIN_PASS loaded successfully");
}const checkAuth = (req, res, next) => {
  if (!req.session.userId) return res.redirect("/login");
  next();
};

// Helper to send static pages
const sendPage = (res, file) =>
  res.sendFile(path.join(__dirname, "public", file));

// db helper functions
async function dbGet(query, params = []) {
    const { rows } = await pool.query(query, params);
    return rows[0];
}

async function dbAll(query, params = []) {
    const { rows } = await pool.query(query, params);
    return rows;
}

async function dbRun(query, params = []) {
    await pool.query(query, params);
}

async function updateInvestmentsProfit() {
    try {
        const investments = await dbAll("SELECT * FROM investments WHERE status='active'");
        if (!investments.length) return;

        const control = await dbGet("SELECT roi_percent FROM investment_control ORDER BY id DESC LIMIT 1");
        const roiPercent = control?.roi_percent || 5;

        for (const inv of investments) {
            const profitGain = (inv.amount * roiPercent) / 100;
            await dbRun("UPDATE investments SET profit=profit+$1, withdrawable=withdrawable+$1 WHERE id=$2", [profitGain, inv.id]);
            await dbRun("UPDATE users SET balance=balance+$1 WHERE id=$2", [profitGain, inv.user_id]);
        }

        console.log(`✅ Profits updated for ${investments.length} investments`);
    } catch (err) {
        console.error("Profit Engine Error:", err);
    }
}

// -------------------
// PUBLIC PAGE ROUTES
// -------------------
app.get("/deposit", (req, res) => {
    res.sendFile(path.join(__dirname, "public/deposit.html"));
});
app.get("/", (req, res) => {
  res.redirect("/login.html");
});
app.get("/register", (req, res) => sendPage(res, "register.html"));
app.get("/withdraw", (req, res) => sendPage(res, "withdraw.html"));
app.get("/kyc", (req, res) => sendPage(res, "kyc.html"));
app.get("/loan", (req, res) => sendPage(res, "loan.html"));
app.get("/settings", (req, res) => sendPage(res, "settings.html"));
app.get("/deposit", (req, res) => sendPage(res, "deposit.html"));
app.get("/investment", (req, res) => sendPage(res, "investment.html"));
app.get("/about", (req, res) => sendPage(res, "about.html"));
app.get("/privacy", (req, res) => sendPage(res, "privacy.html"));
app.get("/terms", (req, res) => sendPage(res, "terms.html"));
app.get("/contact", (req, res) => sendPage(res, "contact.html"));
app.get("/confirmation", (req, res) => sendPage(res, "confirmation.html"));
app.get("/crypto-pending", (req, res) => sendPage(res, "crypto-pending.html"));
app.get("/kyc-confirmation", (req, res) => sendPage(res, "kyc-confirmation.html"));
app.get("/kyc-final", (req, res) => sendPage(res, "kyc-final.html"));
app.get("/loan-confirmation", (req, res) => sendPage(res, "loan-confirmation.html"));
app.get("/forgot-password", (req, res) => sendPage(res, "forgot-password.html"));
app.get("/payment-wait", (req, res) => sendPage(res, "payment-wait.html"));
app.get("/otp", (req, res) => sendPage(res, "otp.html"));
app.get("/reset-password", (req, res) => sendPage(res, "reset-password.html"));
app.get("/reset-successful", (req, res) => sendPage(res, "reset-successful.html"));
app.get("/verify", (req, res) => sendPage(res, "verify.html"));
app.get("/verify-otp", (req, res) => sendPage(res, "verify-otp.html"));
app.get("/withdraw-confirmation", (req, res) => sendPage(res, "withdraw-confirmation.html"));
app.get("/success", (req, res) => sendPage(res, "success.html"));
app.get("/admin/dashboard", checkAdmin, async (req, res) => {
  res.render("admin-dashboard");
});
// -------------------
// DEBUG & SESSION
// -------------------
app.get("/debug-users", async (req, res) => {
  const result = await pool.query("SELECT * FROM users");
  res.json(result.rows);
});

app.get("/check-session", (req, res) => res.json(req.session));

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// -------------------
// ADMIN ROUTES
// -------------------
app.get("/api/users", async (req, res) => {
  if (!req.session.admin) return res.status(403).json({ error: "Admin only" });

  try {
    const { rows } = await pool.query(
      "SELECT id, fullname, email, balance FROM users"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------
// USER DASHBOARD
// -------------------
// -------------------
// DASHBOARD EXTRA DATA
// -------------------
app.get("/dashboard", checkAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Fetch user
    const { rows: users } = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    const user = users[0];
    if (!user) return res.redirect("/login");

    const [depositsRes, withdrawalsRes, loansRes, investmentsRes, topInvestorsRes, mediaRes, reviewsRes, newsRes] = await Promise.all([
      pool.query("SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
      pool.query("SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
      pool.query("SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
      pool.query("SELECT * FROM investments WHERE user_id = $1", [userId]),
      pool.query("SELECT fullname AS name, balance AS roi FROM users ORDER BY balance DESC LIMIT 5"),
      pool.query("SELECT * FROM media_gallery ORDER BY created_at DESC"),
      pool.query("SELECT fullname AS name, 'Great platform!' AS review FROM users LIMIT 5"),
      pool.query("SELECT title, message AS content FROM admin_posts ORDER BY created_at DESC LIMIT 5")
    ]);

    res.render("dashboard", {
      user,
      balance: user.balance || 0,
      deposits: depositsRes.rows,
      withdrawals: withdrawalsRes.rows,
      loans: loansRes.rows,
      investments: investmentsRes.rows,
      topInvestors: topInvestorsRes.rows,
      media: mediaRes.rows,
      reviews: reviewsRes.rows,
      news: newsRes.rows
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("Something went wrong loading dashboard.");
  }
});

// -------------------
// TRANSACTION PAGE
// -------------------
app.get("/transaction", checkAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const { rows: userRows } = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    const user = userRows[0];
    if (!user) return res.redirect("/login");

    const [depositsRes, withdrawalsRes, investmentsRes, loansRes] = await Promise.all([
      pool.query("SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
      pool.query("SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
      pool.query("SELECT * FROM investments WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
      pool.query("SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC", [userId])
    ]);

    res.render("transaction", {
      user,
      deposits: depositsRes.rows,
      withdrawals: withdrawalsRes.rows,
      investments: investmentsRes.rows,
      loans: loansRes.rows
    });

  } catch (err) {
    console.error("Transaction Error:", err);
    res.status(500).send("Unable to load transactions");
  }
});

// -------------------
// GALLERY
// -------------------
app.get("/gallery", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM gallery ORDER BY created_at DESC");
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// -------------------
// REGISTER
// -------------------
app.post("/register", async (req, res) => {
  const { fullname, email, password, phone, dob, gender, marital_status, pin } = req.body;

  if (!fullname || !email || !password || !phone || !dob || !gender || !marital_status || !pin) {
    return res.send("All fields required");
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user while keeping default values for investor/farmer, balance, etc.
    await pool.query(`
      INSERT INTO users 
        (fullname, email, phone, dob, gender, marital_status, pin, password)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [fullname, email, phone, dob, gender, marital_status, pin, hashedPassword]);

    res.redirect("/login");

  } catch (err) {
    // If user already exists
    if (err.code === '23505') { // unique_violation
      return res.send("Email already registered");
    }
    console.error("Register Error:", err);
    res.status(500).send("Server error");
  }
});

// -------------------
// LOGIN
// -------------------
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.send("All fields required");

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    const user = result.rows[0];
    if (!user) return res.send("Invalid email or password");

    let match = false;

    // Detect hashed passwords
    if (user.password.startsWith("$2")) {
      match = await bcrypt.compare(password, user.password);
    } else {
      match = password === user.password;
      if (match) {
        // Upgrade plaintext password to bcrypt
        const hashed = await bcrypt.hash(password, 10);
        await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, user.id]);
      }
    }

    if (!match) return res.send("Invalid email or password");

    // ✅ Set session
    req.session.userId = user.id;
    req.session.admin = user.role === "admin";

    res.redirect("/dashboard");

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).send("Server error");
  }
});

// -------------------
// APPLY LOAN
// -------------------
app.post("/apply-loan", checkAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { amount, duration } = req.body;
    const interestRate = 10; // 10%
    const interest = (amount * interestRate) / 100;
    const total = Number(amount) + interest;

    await pool.query(
      "INSERT INTO loans (user_id, amount, interest, total_payable, duration) VALUES ($1,$2,$3,$4,$5)",
      [userId, amount, interest, total, duration]
    );

    res.redirect("/transaction");
  } catch (err) {
    console.error("Loan Error:", err);
    res.status(500).send("Unable to apply for loan");
  }
});

// -------------------
// KYC UPLOAD
// -------------------
const uploadKyc = upload.fields([
  { name: "id_front", maxCount: 1 },
  { name: "id_back", maxCount: 1 },
  { name: "ssn_proof", maxCount: 1 },
  { name: "proof_address", maxCount: 1 },
  { name: "signature", maxCount: 1 }
]);


// -------------------
// KYC FORM SUBMISSION
// -------------------
app.post("/kyc", checkAuth, async (req, res) => {
  uploadKyc(req, res, async (err) => {
    try {
      if (err) return res.status(400).send("File upload error: " + err.message);

      const userId = req.session.userId;
      if (!userId) return res.status(401).send("Please login first");

      const files = req.files || {};
      const idFront = files.id_front?.[0]?.filename;
      const idBack = files.id_back?.[0]?.filename;
      const ssnProof = files.ssn_proof?.[0]?.filename;
      const proofAddress = files.proof_address?.[0]?.filename;
      const signature = files.signature?.[0]?.filename;

      const { fullname, email, address, marital_status, kids, pin, verification_type } = req.body;
      if (!fullname || !email || !address || !marital_status || !kids || !pin || !verification_type) {
        return res.status(400).send("Please fill all required fields");
      }

      await pool.query(
        `UPDATE users
         SET fullname=$1, email=$2, address=$3, marital_status=$4, kids=$5, pin=$6,
             id_front=$7, id_back=$8, ssn_proof=$9, proof_address=$10, signature=$11,
             kyc_status='pending'
         WHERE id=$12`,
        [fullname, email, address, marital_status, kids, pin, idFront, idBack, ssnProof, proofAddress, signature, userId]
      );

      // Optional: send verification email
      if (verification_type === "email") {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Complete Your KYC Verification",
          html: `<p>Hi ${fullname},<br>
                 Please click <a href="https://yourdomain.com/kyc-final?user=${userId}">here</a> to complete your KYC verification.</p>`
        });
      }

      res.send("✅ KYC submitted successfully! Await admin approval.");
    } catch (error) {
      console.error("KYC Submission Error:", error);
      res.status(500).send("Server error submitting KYC. Check console logs.");
    }
  });
});

// -------------------
// MANUAL DEPOSIT
// -------------------
app.post("/deposit/manual", checkAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const amount = parseFloat(req.body.amount);
    const method = req.body.method;

    if (!amount || amount < 10) return res.send("Invalid amount. Minimum is $10.");
    if (!method) return res.send("Select payment method.");

    await pool.query(
      "INSERT INTO deposits (user_id, amount, method, status) VALUES ($1,$2,$3,$4)",
      [userId, amount, method, "pending"]
    );

    if (method === "PayPal" || method === "CashApp") return res.redirect("/payment-wait");
    if (method === "Bank") return res.redirect("/bank-wait");

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Manual Deposit Error:", err);
    res.status(500).send("Server error processing deposit");
  }
});

// -------------------
// CRYPTO DEPOSIT
// -------------------
app.post("/deposit/crypto", checkAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { amount, wallet } = req.body;

    const amt = Number(amount);
    if (!amt || amt < 10) return res.send("Invalid amount. Minimum $10.");
    if (!wallet || !isValidWallet(wallet)) return res.send("Invalid wallet address.");

    const { rows: users } = await pool.query("SELECT balance,email FROM users WHERE id=$1", [userId]);
    const user = users[0];
    if (!user) return res.send("User not found");
    if (amt > user.balance) return res.send("Insufficient balance");

    const newBalance = user.balance - amt;
    await pool.query("UPDATE users SET balance=$1 WHERE id=$2", [newBalance, userId]);

    await pool.query(
      "INSERT INTO deposits (user_id, amount, method, status, wallet, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [userId, amt, "Crypto", "pending", wallet, new Date().toISOString()]
    );

    if (process.env.BOT_TOKEN && process.env.CHAT_ID) {
      sendTelegramMessage(`🪙 New Crypto Deposit Pending!\nUser: ${user.email}\nAmount: $${amt}\nWallet: ${wallet}`);
    }

    res.redirect("/crypto-pending");
  } catch (err) {
    console.error("Crypto Deposit Error:", err);
    res.status(500).send("Server error processing crypto deposit");
  }
});

// -------------------
// FORGOT PASSWORD / OTP
// -------------------
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.send("Email required");

    const { rows: users } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    const user = users[0];
    if (!user) return res.send("Email not registered");

    const otp = Math.floor(100000 + Math.random() * 900000);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    await pool.query(
      "INSERT INTO otp (email, code, expires_at) VALUES ($1,$2,$3) ON CONFLICT (email) DO UPDATE SET code=$2, expires_at=$3",
      [email, otp, expiresAt]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Password Reset",
      text: `Your OTP is: ${otp}`
    });

    console.log(`OTP sent to ${email}: ${otp}`);
    res.redirect(`/otp.html?email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.send("Failed to send OTP. Try again later.");
  }
});

// -------------------
// VERIFY OTP
// -------------------
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.send("All fields required");

    const { rows } = await pool.query("SELECT code, expires_at FROM otp WHERE email=$1", [email]);
    const row = rows[0];
    if (!row) return res.send("OTP not found");

    if (row.expires_at < Date.now()) return res.send("OTP expired");
    if (row.code != otp) return res.send("Invalid OTP");

    await pool.query("DELETE FROM otp WHERE email=$1", [email]);
    res.redirect(`/reset-password.html?email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.send("Server error");
  }
});

// -------------------
// SEND OTP
// -------------------
app.post("/send-otp", checkAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { rows: users } = await pool.query("SELECT email FROM users WHERE id=$1", [userId]);
    const user = users[0];
    if (!user) return res.send("User not found");

    const email = user.email;
    const otp = Math.floor(100000 + Math.random() * 900000);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await pool.query(
      "INSERT INTO otp (email, code, expires_at) VALUES ($1,$2,$3) ON CONFLICT (email) DO UPDATE SET code=$2, expires_at=$3",
      [email, otp, expiresAt]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP",
      text: `Your OTP is: ${otp}`
    });

    console.log(`OTP sent to ${email}: ${otp}`);
    res.send("✅ OTP sent");
  } catch (err) {
    console.error("Send OTP Error:", err);
    res.send("❌ Mail failed");
  }
});
// -------------------
// RESET PASSWORD
// -------------------
app.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.send("All fields required");

    const hashed = await bcrypt.hash(password, 10);
    await pool.query("UPDATE users SET password=$1 WHERE email=$2", [hashed, email]);

    res.send("Password reset successful! <a href='/login'>Login</a>");
  } catch (err) {
    console.error("Reset password error:", err);
    res.send("Error resetting password");
  }
});

// ======================
// PROFIT ENGINE (PostgreSQL)
// ======================
async function updateInvestmentsProfit() {
  try {
    // 1️⃣ Get all active investments
    const { rows: investments } = await pool.query(
      "SELECT * FROM investments WHERE status = 'active'"
    );
    if (!investments.length) return;

    // 2️⃣ Get control ROI percent (default to 5%)
    const { rows: controlRows } = await pool.query(
      "SELECT roi_percent FROM investment_control ORDER BY id DESC LIMIT 1"
    );
    const roiPercent = controlRows[0]?.roi_percent || 5;

    // 3️⃣ Loop through investments and update profits
    for (const inv of investments) {
      const profitGain = (inv.amount * roiPercent) / 100;

      await pool.query(
        `UPDATE investments
         SET profit = profit + $1,
             withdrawable = withdrawable + $1
         WHERE id = $2`,
        [profitGain, inv.id]
      );

      // Optionally, update user's balance
      await pool.query(
        "UPDATE users SET balance = balance + $1 WHERE id = $2",
        [profitGain, inv.user_id]
      );
    }

    console.log(`✅ Investment profits updated for ${investments.length} investments.`);
  } catch (err) {
    console.error("❌ Profit Engine Error:", err);
  }
}

// -------------------
// INVESTMENT
// -------------------
app.post("/invest", async (req, res) => {
  try {
    if (!req.session.userId)
      return res.json({ success: false, message: "Login required" });

    const { plan, amount } = req.body;
    const userId = req.session.userId;
    const amt = Number(amount);

    if (!amt || amt <= 0)
      return res.json({ success: false, message: "Invalid amount" });

    const planConfig = {
      "Starter": { min: 5000, max: 10000, roi: 3.75 },
      "Growth": { min: 10100, max: 49900, roi: 4.2 },
      "Wealth": { min: 50000, max: 200000, roi: 5.8 },
      "Elite Premium": { min: 200000, max: Infinity, roi: 7.5 }
    };

    const cfg = planConfig[plan];
    if (!cfg) return res.json({ success: false, message: "Invalid plan" });

    const { rows: users } = await pool.query("SELECT balance,email FROM users WHERE id=$1", [userId]);
    const user = users[0];
    if (!user) return res.json({ success: false, message: "User not found" });

    if (amt < cfg.min || amt > cfg.max)
      return res.json({ success: false, message: `Amount must be between $${cfg.min} and $${cfg.max}` });
    if (amt > user.balance) return res.json({ success: false, message: "Insufficient balance" });

    const profit = amt * (cfg.roi / 100);
    const newBalance = user.balance - amt;

    await pool.query(
      `INSERT INTO investments (user_id, plan, amount, profit, withdrawable, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, plan, amt, profit, 0, "pending", new Date().toISOString()]
    );

    await pool.query("UPDATE users SET balance=$1 WHERE id=$2", [newBalance, userId]);

    if (process.env.BOT_TOKEN && process.env.CHAT_ID) {
      sendTelegramMessage(`New Investment!\nUser: ${user.email}\nPlan: ${plan}\nAmount: $${amt}\nProfit: $${profit.toFixed(2)}`);
    }

    res.json({ success: true, message: `Invested $${amt} in ${plan} successfully!`, newBalance });
  } catch (err) {
    console.error("Invest error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// -------------------
// WITHDRAWAL
// -------------------
app.post("/withdraw", async (req, res) => {
  try {
    const userId = req.session.userId;
    const amount = Number(req.body.amount);

    if (!userId) return res.redirect("/login");
    if (!amount || amount <= 0) return res.send("Enter valid amount");

    const { rows: users } = await pool.query("SELECT * FROM users WHERE id=$1", [userId]);
    const user = users[0];
    if (!user) return res.send("User not found");

    await pool.query(
      "INSERT INTO withdrawals(user_id, amount, status, created_at) VALUES($1,$2,$3,$4)",
      [userId, amount, "pending", new Date().toISOString()]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Withdrawal Request",
      html: `<h2>Hello ${user.fullname}</h2>
             <p>Your withdrawal request of $${amount} has been received.</p>`
    });

    res.send("Withdrawal request sent successfully");
  } catch (err) {
    console.error("Withdraw error:", err);
    res.send("Error processing withdrawal");
  }
});

// -------------------
// KYC SUBMIT (DEMO)
// -------------------
app.post("/submit-kyc", (req, res) => {
  const { fullname, email } = req.body;
  console.log("KYC:", fullname, email);
  res.redirect("/kyc-confirmation.html");
});
app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  // check admin from .env
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASS) {
    req.session.admin = true;
    return res.redirect("/admin/dashboard");
  }

  return res.render("admin-login", { error: "Invalid admin credentials" });
});

// -------------------
// SOCKET.IO CHAT
// -------------------
const adminSockets = new Set();
const userSockets = new Map(); // userId => socket.id

io.on("connection", (socket) => {

  // USER CONNECT
  socket.on("user-join", userId => {
    userSockets.set(userId, socket.id);
    socket.emit(adminSockets.size ? "admin-online" : "admin-offline");
  });

  socket.on("user-message", async ({ userId, text }) => {
    await pool.query(
      "INSERT INTO messages(user_id, sender, message, created_at) VALUES($1,$2,$3,$4)",
      [userId, "user", text, new Date().toISOString()]
    );

    adminSockets.forEach(adminId => {
      io.to(adminId).emit("receive-message", { sender: "user", userId, text });
    });

    if (!adminSockets.size) {
      const userSocketId = userSockets.get(userId);
      if (userSocketId) io.to(userSocketId).emit("receive-message", { sender: "system", text: "Admin is offline. Your message has been received." });
    }
  });

  // ADMIN CONNECT
  socket.on("admin-join", () => adminSockets.add(socket.id));

  socket.on("admin-message", async ({ userId, text }) => {
    await pool.query(
      "INSERT INTO messages(user_id, sender, message, created_at) VALUES($1,$2,$3,$4)",
      [userId, "admin", text, new Date().toISOString()]
    );

    const userSocketId = userSockets.get(userId);
    if (userSocketId) io.to(userSocketId).emit("receive-message", { sender: "admin", userId, text });
  });

  socket.on("disconnect", () => {
    adminSockets.delete(socket.id);
    userSockets.forEach((id, uid) => { if (id === socket.id) userSockets.delete(uid); });
  });
});

// -------------------
// LIVE INVESTMENT UPDATES
// -------------------
setInterval(updateInvestmentsProfit, 5 * 60 * 1000);
setInterval(() => {
  const roi = (Math.random() * 10 + 90).toFixed(2);
  const profit = (Math.random() * 5 + 10).toFixed(2);
  io.emit("liveData", { roi, profit });
}, 3000);

// -------------------
// SERVER START
// -------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
