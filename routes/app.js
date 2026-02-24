const express = require("express");
const app = express();
const path = require("path");
const session = require("express-session");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended:true }));
app.use(express.json());
app.use(session({ secret:"secret", resave:false, saveUninitialized:true }));

// Routes
const adminRoutes = require("./routes/adminroutes");
app.use("/admin", adminRoutes);

app.listen(3000, ()=> console.log("Server running on http://localhost:3000"));