const express = require("express");
const router = express.Router();
const path = require("path");

// About page
router.get("/about", (req,res)=>{
    res.sendFile(path.join(__dirname,"../public/about.html"));
});

// Privacy Policy
router.get("/privacy", (req,res)=>{
    res.sendFile(path.join(__dirname,"../public/privacy.html"));
});

// Terms & Conditions
router.get("/terms", (req,res)=>{
    res.sendFile(path.join(__dirname,"../public/terms.html"));
});

module.exports = router;
