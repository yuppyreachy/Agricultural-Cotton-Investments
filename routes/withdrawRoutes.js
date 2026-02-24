const express = require("express");
const router = express.Router();
const path = require("path");

router.get("/withdraw",(req,res)=>{
  if(!req.session.user) return res.redirect("/login");
  res.sendFile(path.join(__dirname,"../public/withdraw.html"));
});

module.exports = router;
