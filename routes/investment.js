const express = require("express");
const router = express.Router();
const path = require("path");

// investment page
router.get("/investment",(req,res)=>{
  if(!req.session.user) return res.redirect("/login");
  res.sendFile(path.join(__dirname,"../public/investment.html"));
});

module.exports = router;
