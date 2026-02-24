require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const multer = require("multer");
const session = require("express-session");
const axios = require("axios");
const fetch = require("node-fetch");
const adminPass = process.env.ADMIN_PASS;
const adminRoutes = require("./routes/adminroutes"); 
const sendMail = require("./routes/mailer");
const contactRoute = require('./routes/contactRoutes');
const app = express();
const server = http.createServer(app);


const db = require("./db");
const authRoutes = require("./routes/authRoutes");

// ======================
// DATABASE PROMISE HELPERS
// ======================
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) =>
      err ? reject(err) : resolve(rows)
    )
  );

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    })
  );

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) =>
      err ? reject(err) : resolve(row)
    )
  );
// ======================
// MIDDLEWARE
// ======================
app.use("/", contactRoute); 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: process.env.SESSION_SECRET || "supersecret",
  resave: false,
  saveUninitialized: false
}));
// set EJS as view engine (only this, no custom folder)
app.set("view engine", "ejs");


// ======================
// MULTER SETUP
// ======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads"),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ======================
// MAILER SETUP
// ======================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify(err => {
  if (err) console.error("❌ SMTP Error:", err);
  else console.log("✅ SMTP ready");
});

// ======================
// TELEGRAM BOT
// ======================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "HTML"
  }).catch(err => console.log("Telegram Error:", err.message));
}

// ======================
// OTP TEMP STORE
// ======================
const otpStore = {};

// ======================
// DATABASE TABLE CREATION
// ======================
function createTables() {
  db.serialize(() => {

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE,
      fullname TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      dob TEXT,
      phone TEXT,
      gender TEXT,
      marital_status TEXT,
      farmer TEXT,
      investor TEXT,
      pin TEXT,
      otp TEXT,
      balance REAL DEFAULT 0,
      profit REAL DEFAULT 0,
      security_pin TEXT,
      kyc_status TEXT DEFAULT 'pending',
      role TEXT DEFAULT 'user',
      id_card TEXT,
      passport_photo TEXT,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      amount REAL,
      method TEXT,
      status TEXT DEFAULT 'Pending',
      bank_name TEXT,
      account_number TEXT,
      account_holder TEXT,
      instructions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      amount REAL,
      status TEXT DEFAULT 'Active',
      profit REAL DEFAULT 0,
      withdrawable REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS investment_control (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roi_percent REAL DEFAULT 5,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      amount REAL,
      status TEXT DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      amount REAL,
      interest REAL DEFAULT 0,
      total_payable REAL DEFAULT 0,
      duration TEXT,
      status TEXT DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT,
      sender TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

  

    db.run(`CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admin_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS media_gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      wallet TEXT,
      amount TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      media TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

  });

  console.log("✅ Database tables initialized");
}

createTables();

// ======================
// PROFIT ENGINE
// ======================
async function updateInvestmentsProfit() {
  try {
    const investments = await dbAll(
      "SELECT * FROM investments WHERE status = 'Active'"
    );

    if (!investments.length) return;

    const control = await dbGet(
      "SELECT * FROM investment_control ORDER BY id DESC LIMIT 1"
    );

    const roiPercent = Number(control?.roi_percent || 5);

    for (const inv of investments) {
      const profitGain = (inv.amount * roiPercent) / 100;

      await dbRun(
        `UPDATE investments
         SET profit = profit + ?,
             withdrawable = withdrawable + ?
         WHERE id = ?`,
        [profitGain, profitGain, inv.id]
      );
    }

    console.log("✅ Investment profits updated");
  } catch (err) {
    console.error("❌ Profit Engine Error:", err);
  }
}



// ======================
// START SERVER
// ======================

// ======================
// ROUTES
// ======================
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
if (!adminPass) {
  console.log("❌ ADMIN_PASS is missing in .env file");
  process.exit(1); // stops server to prevent running without admin
} else {
  console.log("✅ ADMIN_PASS loaded successfully");
}

const myNewUser = process.env.ADMIN_USER;
const myNewPass = process.env.ADMIN_PASS;

db.get("SELECT * FROM admin WHERE username = ?", [myNewUser], async (err, admin) => {
    if (err) return console.error("DB error:", err);

    if (!admin) {

        if (!myNewPass || typeof myNewPass !== "string") {
            return console.error("❌ ADMIN_PASS is missing in .env file");
        }

        const hashed = await bcrypt.hash(myNewPass.trim(), 10);

        db.run(
            "INSERT INTO admin (username, password) VALUES (?, ?)",
            [myNewUser, hashed],
            (err) => {
                if (err) console.error("Insert admin error:", err);
                else console.log("🔥 NEW ADMIN CREATED →", myNewUser);
            }
        );
    } else {
        console.log("✅ Admin already exists, login with existing credentials");
    }
});


// ======================
// MIDDLEWARE
// ====================


function adminAuth(req, res, next) {
    if (!req.session.admin) {
        console.log("⚠️ Unauthorized admin access attempt");
        return res.redirect("/admin"); // admin login page
    }
    next();
}
// Track online admins (demo, can use DB)
let adminOnline = false;
  
// -------------------
// Auth Middleware
// -------------------
function checkAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

function approveDeposit(){
    const depositId = document.getElementById('depositSelect').value;
    if(!depositId) return alert("Select a deposit");
    fetch(`/admin/deposit/${depositId}/approved`, {method:'POST'})
    .then(res=>res.json()).then(data=>{ alert("Deposit " + data.status); location.reload(); });
}

function declineDeposit(){
    const depositId = document.getElementById('depositSelect').value;
    if(!depositId) return alert("Select a deposit");
    fetch(`/admin/deposit/${depositId}/declined`, {method:'POST'})
    .then(res=>res.json()).then(data=>{ alert("Deposit " + data.status); location.reload(); });
}

function approveWithdraw(){
    const withdrawId = document.getElementById('withdrawSelect').value;
    if(!withdrawId) return alert("Select a withdrawal");
    fetch(`/admin/withdraw/${withdrawId}/approved`, {method:'POST'})
    .then(res=>res.json()).then(data=>{ alert("Withdrawal " + data.status); location.reload(); });
}

function declineWithdraw(){
    const withdrawId = document.getElementById('withdrawSelect').value;
    if(!withdrawId) return alert("Select a withdrawal");
    fetch(`/admin/withdraw/${withdrawId}/declined`, {method:'POST'})
    .then(res=>res.json()).then(data=>{ alert("Withdrawal " + data.status); location.reload(); });
}

function approveLoan(){
    const loanId = document.getElementById('loanSelect').value;
    if(!loanId) return alert("Select a loan");
    fetch(`/admin/loan/${loanId}/approved`, {method:'POST'})
    .then(res=>res.json()).then(data=>{ alert("Loan " + data.status); location.reload(); });
}

function declineLoan(){
    const loanId = document.getElementById('loanSelect').value;
    if(!loanId) return alert("Select a loan");
    fetch(`/admin/loan/${loanId}/declined`, {method:'POST'})
    .then(res=>res.json()).then(data=>{ alert("Loan " + data.status); location.reload(); });
}

function approveKYC(){
    const kycId = document.getElementById('kycSelect').value;
    if(!kycId) return alert("Select a KYC");
    fetch(`/admin/kyc/${kycId}/approved`, {method:'POST'})
    .then(res=>res.json()).then(data=>{ alert("KYC " + data.status); location.reload(); });
}

function declineKYC(){
    const kycId = document.getElementById('kycSelect').value;
    if(!kycId) return alert("Select a KYC");
    fetch(`/admin/kyc/${kycId}/declined`, {method:'POST'})
    .then(res=>res.json()).then(data=>{ alert("KYC " + data.status); location.reload(); });
}

// ======================
// PAGE ROUTES
// ==================
const sendPage = (res, file) =>
  res.sendFile(path.join(__dirname, "public", file));



app.get("/check-session", (req, res) => {
   res.json(req.session);
});
// Redirect root to login page
app.get("/", (req, res) => res.redirect("/login"));

// Serve login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register", (req,res)=> sendPage(res,"register.html"));


app.get("/deposit", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  res.render("deposit");
});
app.get("/admin-login", (req, res) => {
  res.render("admin/login"); // make sure this file exists
});

app.get("/withdraw",(req,res)=> sendPage(res,"withdraw.html"));
app.get("/kyc",(req,res)=> sendPage(res,"kyc.html"));
app.get("/loan",(req,res)=> sendPage(res,"loan.html"));
app.get("/settings",(req,res)=> sendPage(res,"settings.html"));
app.get("/investment",(req,res)=> sendPage(res,"investment.html"));
app.get("/about",(req,res)=> sendPage(res,"about.html"));
app.get("/privacy",(req,res)=> sendPage(res,"privacy.html"));
app.get("/terms",(req,res)=> sendPage(res,"terms.html"));
app.get("/contact",(req,res)=> sendPage(res,"contact.html"));
app.get("/confirmation",(req,res)=> sendPage(res,"confirmation.html"));
app.get("/crypto-pending",(req,res)=> sendPage(res,"crypto-pending.html"));
app.get("/kyc-confirmation",(req,res)=> sendPage(res,"kyc-confirmation.html"));
app.get("/kyc-final",(req,res)=> sendPage(res,"kyc-final.html"));
app.get("/loan-confirmation",(req,res)=> sendPage(res,"loan-confirmation.html"));
app.get("/forgot-password",(req,res)=> sendPage(res,"forgot-password.html"));
app.get("/payment-wait",(req,res)=> sendPage(res,"payment-wait.html"));
app.get("/otp",(req,res)=> sendPage(res,"otp.html"));
app.get("/rest-password-successful",(req,res)=> sendPage(res,"reset-password-successful.html"));
app.get("/reset-password",(req,res)=> sendPage(res,"rest-password.html"));
app.get("/reset-successful",(req,res)=> sendPage(res,"rest-successful.html"));
app.get("/verify",(req,res)=> sendPage(res,"verify.html"));
app.get("/verify-otp",(req,res)=> sendPage(res,"verify-otp.html"));
app.get("/withdraw-confirmation",(req,res)=> sendPage(res,"withdraw-confirmation.html"));

app.get("/success", (req, res) => {
    res.sendFile(__dirname + "/public/success.html");

});
app.get("/logout",(req,res)=>{
  req.session.destroy();
  res.redirect("/login");
});

app.get("/api/users", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }

  db.all("SELECT id, fullname, email, balance FROM users", [], (err, rows) => {
    if (err) {
      console.error("Fetch users error:", err);
      return res.status(500).send("Server error");
    }

    res.json(rows); // return users to dashboard
  });
});









// ===== USER DASHBOARD =====
app.get("/dashboard", async (req, res) => {
  try {
    const userId = req.session.userId;

    // 🔒 Protect route
    if (!userId) {
      return res.redirect("/login");
    }

    // 👤 Get logged in user
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) return res.redirect("/login");

    // 💰 Balance
    const balance = user.balance || 0;

    // 💳 Deposits
    const deposits = await dbAll(
      "SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // 💸 Withdrawals
    const withdrawals = await dbAll(
      "SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // 🏦 Loans
    const loans = await dbAll(
      "SELECT * FROM loans WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // 📈 Investments
    const investments = await dbAll(
      "SELECT * FROM investments WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // 🏆 Top Investors (by balance)
    const topInvestors = await dbAll(`
      SELECT fullname AS name, balance AS roi
      FROM users
      ORDER BY balance DESC
      LIMIT 5
    `);

    // 🖼 Media Gallery
    const media = await dbAll(
      "SELECT * FROM media_gallery ORDER BY created_at DESC"
    );

    // 📰 Dummy reviews & news (optional, replace with real queries)
    const reviews = await dbAll("SELECT fullname AS name, 'Great platform!' AS review FROM users LIMIT 5");
    const news = await dbAll("SELECT title, message AS content FROM admin_posts ORDER BY created_at DESC LIMIT 5");

    // 🚀 Render Dashboard
    res.render("dashboard", {
      user,
      balance,
      deposits: deposits || [],
      withdrawals: withdrawals || [],
      loans: loans || [],
      investments: investments || [],
      topInvestors: topInvestors || [],
      media: media || [],
      reviews: reviews || [],
      news: news || []
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.send("Something went wrong loading dashboard.");
  }
});


// -------------------
// Transaction Route
// -------------------
app.get("/transaction", checkAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Get user
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) return res.redirect("/login");

    // Get related data
    const deposits = await dbAll(
      "SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const withdrawals = await dbAll(
      "SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const investments = await dbAll(
      "SELECT * FROM investments WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const loans = await dbAll(
      "SELECT * FROM loans WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // Render the transaction page
    res.render("transaction", {
      user,
      deposits: deposits || [],
      withdrawals: withdrawals || [],
      investments: investments || [],
      loans: loans || []
    });

  } catch (err) {
    console.error("Transaction Error:", err);
    res.status(500).send("Unable to load transactions");
  }
});




app.get("/gallery", (req,res)=>{
  db.all("SELECT * FROM gallery ORDER BY created_at DESC", (err, rows)=>{
    if(err) return res.json([]);
    res.json(rows);
  });
});


//REGISTER-ROUTES//


const { promisify } = require("util");

// LOGIN //



app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.send("All fields required");

    const user = await dbGet("SELECT * FROM users WHERE email=?", [email]);
    if (!user) return res.send("Invalid email or password");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Invalid email or password");

    // ✅ Correct session setup
    req.session.userId = user.id;
    req.session.admin = false;
    req.session.adminId = null;

    res.redirect("/dashboard");
});

app.post("/apply-loan", checkAuth, (req, res) => {
  const userId = req.session.userId;
  const { amount, duration } = req.body;

  const interestRate = 10; // 10%
  const interest = (amount * interestRate) / 100;
  const total = Number(amount) + interest;

  db.run(`
    INSERT INTO loans (user_id, amount, interest, total_payable, duration)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, amount, interestRate, total, duration], () => {
    res.redirect("/transaction");
  });
});
const uploadKyc = upload.fields([
  { name: "id_front", maxCount: 1 },
  { name: "id_back", maxCount: 1 },
  { name: "ssn_proof", maxCount: 1 },
  { name: "proof_address", maxCount: 1 },
  { name: "signature", maxCount: 1 }
]);

app.post("/kyc", checkAuth, (req, res) => {
  uploadKyc(req, res, async function (err) {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).send("Please login first");

      if (err) {
        console.error("Multer Error:", err);
        return res.status(400).send("File upload error: " + err.message);
      }

      // Extract uploaded files
      const idFront = req.files?.id_front?.[0]?.filename;
      const idBack = req.files?.id_back?.[0]?.filename;
      const ssnProof = req.files?.ssn_proof?.[0]?.filename;
      const proofAddress = req.files?.proof_address?.[0]?.filename;
      const signature = req.files?.signature?.[0]?.filename;

      if (!idFront || !idBack || !ssnProof || !proofAddress || !signature) {
        return res.status(400).send("Please upload all required KYC documents");
      }

      // Extract form fields
      const { fullname, email, address, marital_status, kids, pin, verification_type } = req.body;

      // Basic validation
      if (!fullname || !email || !address || !marital_status || !kids || !pin || !verification_type) {
        return res.status(400).send("Please fill all required fields");
      }

      // Save KYC info in DB (adjust column names as per your DB)
      await dbRun(
        `UPDATE users
         SET fullname=?, email=?, address=?, marital_status=?, kids=?, pin=?, 
             id_front=?, id_back=?, ssn_proof=?, proof_address=?, signature=?, 
             kyc_status='pending'
         WHERE id=?`,
        [fullname, email, address, marital_status, kids, pin, idFront, idBack, ssnProof, proofAddress, signature, userId]
      );

      // Optional: send email verification if selected
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

// ==============================
// ADMIN LOGIN PROCESS
// ==============================
app.post("/admin-login", (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password?.trim();

  if (!username || !password) {
    return res.send("Missing credentials ❌");
  }

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    req.session.admin = true;
    return res.redirect("/admin/dashboard");
  }

  res.send("Invalid admin login ❌");
});

// ============================
// POST /deposit
// ============================
app.post("/deposit/manual", (req, res) => {

  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const userId = req.session.userId;
  const amount = parseFloat(req.body.amount);
  const method = req.body.method;

  // Validate
  if (!amount || amount < 10) {
    return res.send("Invalid amount. Minimum is $10.");
  }

  if (!method) {
    return res.send("Select payment method.");
  }

  db.run(
    "INSERT INTO deposits (user_id, amount, method, status) VALUES (?, ?, ?, ?)",
    [userId, amount, method, "Pending"],
    function (err) {
      if (err) {
        console.error(err);
        return res.send("Database error");
      }

      if (method === "PayPal" || method === "CashApp") {
        return res.redirect("/payment-wait");
      }

      if (method === "Bank") {
        return res.redirect("/bank-wait");
      }

      res.redirect("/dashboard");
    }
  );

});


app.post('/admin/users/:id/add-balance', async (req,res)=>{
  try {
    const userId = req.params.id;
    const { amount } = req.body;
    if(!amount) return res.status(400).json({error:"Amount required"});
    await dbRun("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, userId]);
    res.json({success:true, message:`$${amount} added to user ${userId}`});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post("/deposit/crypto", async (req, res) => {
  try {
    if (!req.session.userId) return res.redirect("/login");

    const userId = req.session.userId;
    const { amount, wallet } = req.body;

    if (!amount || amount < 10) return res.send("Invalid amount. Minimum $10");
    if (!wallet) return res.send("Wallet address required");

    await dbRun(
      "INSERT INTO deposits (user_id, amount, method, status) VALUES (?, ?, ?, ?)",
      [userId, amount, "Crypto", "Pending"]
    );

    // Optional: redirect to a “crypto pending” page
    res.redirect("/crypto-pending");

  } catch (err) {
    console.error("Crypto Deposit Error:", err);
    res.status(500).send("Server error");
  }
});


app.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) return res.send("Email required");

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if(err || !user) return res.send("Email not registered");

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[email] = otp; // store OTP temporarily


    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Password Reset",
      text: `Your OTP is: ${otp}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if(error){
        console.log(error);
        return res.send("Failed to send OTP");
      }
      console.log("OTP sent: " + info.response);

      // Redirect to OTP page, pass email in query string
      res.redirect(`/otp.html?email=${encodeURIComponent(email)}`);
    });
  });
});

// ======================
// VERIFY OTP
// ======================
app.post("/verify-otp", (req,res) => {
  const { email, otp } = req.body;
  if(!email || !otp) return res.send("All fields required");

  if(otpStore[email] && otpStore[email] == otp){
    delete otpStore[email]; // remove OTP after success
    res.redirect(`/reset-password.html?email=${encodeURIComponent(email)}`);
  } else {
    return res.send("Invalid OTP, try again");
  }
});

// ======================
// SEND OTP
// ======================
app.post("/send-otp", (req, res) => {
    if (!req.session.userId) return res.redirect("/login");

    db.get("SELECT email FROM users WHERE id=?", [req.session.userId], (err, user) => {
        if(err || !user) return res.send("User not found");

        const email = user.email;
        const otp = Math.floor(100000 + Math.random() * 900000);
        otpStore[email] = otp; // store OTP temporarily

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your OTP",
            text: `Your OTP is ${otp}`
        }, (err) => {
            if(err) return res.send("❌ Mail failed");
            console.log("OTP:", otp);
            res.send("✅ OTP sent");
        });
    });
});

app.post("/admin-login", (req, res) => {
  const { username, password } = req.body;

  console.log("Entered:", username, password);
  console.log("Expected:", process.env.ADMIN_USER, process.env.ADMIN_PASS);

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    req.session.admin = true;
    return res.redirect("/admin/dashboard");
  }

  res.send("Invalid admin login ❌");
});

app.post("/reset-password", async (req,res) => {
  const { email, password } = req.body;
  if(!email || !password) return res.send("All fields required");

  const hashed = await bcrypt.hash(password, 10);
  db.run("UPDATE users SET password = ? WHERE email = ?", [hashed, email], function(err){
    if(err) return res.send("Error resetting password");
    res.send("Password reset successful! <a href='/login'>Login</a>");
  });
});

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
      "Starter": { min: 5000, max: 10000, roi: 3.75, wait: 10 },
      "Growth": { min: 10100, max: 49900, roi: 4.2, wait: 15 },
      "Wealth": { min: 50000, max: 200000, roi: 5.8, wait: 30 },
      "Elite Premium": { min: 200000, max: Infinity, roi: 7.5, wait: 30 }
    };

    const cfg = planConfig[plan];
    if (!cfg)
      return res.json({ success: false, message: "Invalid plan" });

    const user = await dbGet(
      "SELECT balance,email FROM users WHERE id=?",
      [userId]
    );

    if (!user)
      return res.json({ success: false, message: "User not found" });

    if (amt < cfg.min || amt > cfg.max)
      return res.json({
        success: false,
        message: `Amount must be between $${cfg.min} and $${cfg.max}`
      });

    if (amt > user.balance)
      return res.json({
        success: false,
        message: "Insufficient balance"
      });

    const profit = amt * (cfg.roi / 100);
    const newBalance = user.balance - amt;

    await dbRun(
      `INSERT INTO investments 
       (user_id, plan, amount, profit, withdrawable, status, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [userId, plan, amt, profit, 0, "Pending", new Date().toISOString()]
    );

    await dbRun(
      "UPDATE users SET balance=? WHERE id=?",
      [newBalance, userId]
    );

    // Telegram (safe, won't crash server)
    const msg = `New Investment!
User: ${user.email}
Plan: ${plan}
Amount: $${amt}
Profit: $${profit.toFixed(2)}`;

    fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage?chat_id=${process.env.CHAT_ID}&text=${encodeURIComponent(msg)}`)
      .catch(err => console.log("Telegram error:", err.message));

    res.json({
      success: true,
      message: `Invested $${amt} in ${plan} successfully!`,
      newBalance
    });

  } catch (err) {
    console.error("Invest error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/withdraw",(req,res)=>{
    const { userId, amount } = req.body;
    if(!userId || !amount) return res.send("Enter amount");

    db.get("SELECT * FROM users WHERE id=?", [userId], (err, user)=>{
        if(err || !user) return res.send("User not found");

        // Save withdrawal request
        db.run("INSERT INTO withdrawals(user_id, amount, status, created_at) VALUES(?,?,?,?)",
            [userId, amount, "Pending", new Date().toISOString()]);

        // Send email to user
        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Withdrawal Request",
            html: `<h2>Hello ${user.fullname}</h2>
                   <p>Your withdrawal request of $${amount} has been received.</p>`
        });

        res.send("Withdrawal request sent successfully");
    });
});


// ======================
// KYC
// ======================
app.post("/submit-kyc",(req,res)=>{
 const { fullname,email } = req.body;
 console.log("KYC:",fullname,email);
 res.redirect("/kyc-confirmation.html");
 
});
const io = require("socket.io")(server);

let onlineUsers = new Map(); // userId -> socketId
let adminSocket = null;

io.on("connection", (socket) => {
  console.log("New connection", socket.id);

  // User joins
  socket.on("user-join", (userId) => {
    if(!userId) return;
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;

    // Notify admin
    if(adminSocket) io.to(adminSocket).emit("online-users", Array.from(onlineUsers.keys()));

    // Notify user if admin online
    if(adminSocket) socket.emit("admin-online");
  });

  // Admin joins
  socket.on("admin-join", () => {
    adminSocket = socket.id;
    console.log("Admin connected");

    // Notify all users admin is online
    onlineUsers.forEach(sid => io.to(sid).emit("admin-online"));
    io.to(adminSocket).emit("online-users", Array.from(onlineUsers.keys()));
  });

  // User sends message
  socket.on("user-message", (data) => {
    if(!data?.userId || !data?.text) return;

    if(adminSocket){
      io.to(adminSocket).emit("receive-message", { ...data, sender:"user", time:new Date() });
    } else {
      // AUTO-RESPONSE if admin offline
      socket.emit("receive-message", {
        sender: "system",
        text: "⚠️ Admin is currently offline. Your message will be replied to soon.",
        time: new Date()
      });
    }
  });

  // Admin sends message
  socket.on("admin-message", (data) => {
    const userSocket = onlineUsers.get(data.userId);
    if(userSocket){
      io.to(userSocket).emit("receive-message", { text: data.text, sender:"admin", time: new Date() });
    }
  });

  // Disconnect
  socket.on("disconnect", ()=>{
    if(socket.userId) onlineUsers.delete(socket.userId);
    if(adminSocket === socket.id){
      adminSocket = null;
      onlineUsers.forEach(sid => io.to(sid).emit("admin-offline"));
    }
  });
});


setInterval(updateInvestmentsProfit, 5 * 60 * 1000);

setInterval(() => {
  const roi = (Math.random() * 10 + 90).toFixed(2);
  const profit = (Math.random() * 5 + 10).toFixed(2);
  io.emit("liveData", { roi, profit });
}, 3000);


// ======================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


