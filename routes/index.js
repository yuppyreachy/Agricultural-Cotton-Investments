const express = require("express");
const router = express.Router();

// Home page
router.get("/", (req, res) => {
  res.render("index"); // homepage
});

// About page
router.get("/about", (req, res) => {
  res.render("about", {
    title: "About Us",
    content: "Cotton Investment is a platform that helps farmers and investors grow wealth together..."
  });
});

// Contact page
router.get("/contact", (req, res) => {
  res.render("contact", {
    title: "Contact Us",
    contacts: {
      email: "support@cottoninvestment.com",
      telegram: "https://t.me/yourchannel",
      phone: "+234123456789"
    }
  });
});

// Terms page
router.get("/terms", (req, res) => {
  res.render("terms", {
    title: "Terms & Conditions",
    content: "Your terms go here..."
  });
});

// Privacy page
router.get("/privacy", (req, res) => {
  res.render("privacy", {
    title: "Privacy Policy",
    content: "Your privacy policy goes here..."
  });
});

module.exports = router;
