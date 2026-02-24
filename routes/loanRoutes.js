const express = require("express");
const router = express.Router();
const path = require("path");

router.get("/loan",(req,res)=>{
  if(!req.session.user) return res.redirect("/login");
  res.sendFile(path.join(__dirname,"../public/loan.html"));
});

module.exports = router;
