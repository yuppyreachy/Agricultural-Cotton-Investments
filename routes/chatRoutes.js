const express = require("express");
const router = express.Router();
const path = require("path");

router.get("/chat",(req,res)=>{
  if(!req.session.user) return res.redirect("/login");
  res.sendFile(path.join(__dirname,"../public/chat.html"));
});

module.exports = router;
