const express = require("express");
const router = express.Router();
const path = require("path");

// Landing / index
router.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname,"../public/index.html"));
});

// Contact page
router.get("/contact", (req,res)=>{
    res.sendFile(path.join(__dirname,"../public/contact.html"));
});

// Forgot password
router.get("/forgot-password",(req,res)=>{
    res.sendFile(path.join(__dirname,"../public/forgot-password.html"));
});

// OTP page
router.get("/otp",(req,res)=>{
    res.sendFile(path.join(__dirname,"../public/otp.html"));
});

// Verify OTP page
router.get("/verify-otp",(req,res)=>{
    res.sendFile(path.join(__dirname,"../public/verify-otp.html"));
});

// Verify page (after OTP)
router.get("/verify",(req,res)=>{
    res.sendFile(path.join(__dirname,"../public/verify.html"));
});

// Reset password success
router.get("/reset-success",(req,res)=>{
    res.sendFile(path.join(__dirname,"../public/reset-success.html"));
});

// Reset password successful page
router.get("/reset-password-successful",(req,res)=>{
    res.sendFile(path.join(__dirname,"../public/reset-password-successful.html"));
});

module.exports = router;
