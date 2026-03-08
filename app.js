// app.js
const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./dbPostgres"); // PostgreSQL helpers

const app = express();

// ===============================
// VIEW ENGINE SETUP
// ===============================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ===============================
// MIDDLEWARE
// ===============================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set to true in production with HTTPS
  })
);

// ===============================
// STATIC FILES
// ===============================
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// ROUTES
// ===============================

// Root route
app.get("/", (req, res) => {
  res.send("Welcome! Go to /admin/login to access the admin panel.");
});

// ================= User Routes =================

// Fetch a user by ID
app.get("/user/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await db.getUser(userId);
    if (!user) return res.status(404).send("User not found");

    res.json(user);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Database error");
  }
});

// Update a user's balance
app.post("/user/:id/balance", async (req, res) => {
  const userId = req.params.id;
  const { balance } = req.body;

  if (typeof balance !== "number") {
    return res.status(400).send("Balance must be a number");
  }

  try {
    const updatedUser = await db.updateBalance(userId, balance);
    if (!updatedUser) return res.status(404).send("User not found");

    res.send(`✅ User balance updated to ${updatedUser.balance}`);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Database error");
  }
});

// ================= Admin Routes =================

// Admin login
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.status(400).send("Missing username or password");

  try {
    const admin = await db.getAdminByUsername(username);
    if (!admin) return res.status(404).send("Admin not found");

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) return res.status(401).send("Incorrect password");

    // Store admin ID in session
    req.session.adminId = admin.id;
    res.send(`✅ Welcome, ${admin.username}`);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Database error");
  }
});

// Admin logout
app.post("/admin/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Could not log out");
    res.send("✅ Logged out successfully");
  });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));