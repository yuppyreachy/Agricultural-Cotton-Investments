// adminroutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User"); // Adjust path if necessary
const Deposit = require("../models/Deposit");
const Withdraw = require("../models/Withdraw");
const Loan = require("../models/Loan");
const KYC = require("../models/KYC");

// Middleware to check admin login
function isAdmin(req, res, next){
    if(req.session && req.session.admin) return next();
    res.status(401).send("Unauthorized admin access attempt ⚠️");
}

// =========================
// DASHBOARD
// =========================
router.get("/dashboard", isAdmin, async (req, res) => {
    try {
        const users = await User.find({});
        res.render("admin/dashboard", { users, admin: req.session.admin });
    } catch(err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// =========================
// GET SINGLE USER
// =========================
router.get("/user/:id", isAdmin, async (req,res)=>{
    try{
        const user = await User.findById(req.params.id);
        if(!user) return res.status(404).json({error:"User not found"});
        res.json(user);
    }catch(err){ console.error(err); res.status(500).json({error:"Server error"});}
});

// =========================
// ADD BALANCE
// =========================
router.post("/addBalance/:id", isAdmin, async (req,res)=>{
    try{
        const { amount } = req.body;
        const user = await User.findById(req.params.id);
        if(!user) return res.status(404).json({error:"User not found"});
        user.balance += Number(amount);
        await user.save();
        res.json({success:true, balance:user.balance});
    }catch(err){ console.error(err); res.status(500).json({error:"Server error"});}
});

// =========================
// APPROVE / DECLINE DEPOSIT
// =========================
router.post("/deposit/:id/approve", isAdmin, async(req,res)=>{
    try{
        const deposit = await Deposit.findById(req.params.id);
        if(!deposit) return res.status(404).json({error:"Deposit not found"});
        deposit.status = "approved";
        await deposit.save();
        const user = await User.findById(deposit.userId);
        user.balance += deposit.amount;
        await user.save();
        res.json({success:true});
    }catch(err){ console.error(err); res.status(500).json({error:"Server error"});}
});

router.post("/deposit/:id/decline", isAdmin, async(req,res)=>{
    try{
        const deposit = await Deposit.findById(req.params.id);
        if(!deposit) return res.status(404).json({error:"Deposit not found"});
        deposit.status = "declined";
        await deposit.save();
        res.json({success:true});
    }catch(err){ console.error(err); res.status(500).json({error:"Server error"});}
});

// =========================
// APPROVE / DECLINE WITHDRAWAL
// =========================
router.post("/withdraw/:id/approve", isAdmin, async(req,res)=>{
    try{
        const withdraw = await Withdraw.findById(req.params.id);
        if(!withdraw) return res.status(404).json({error:"Withdraw not found"});
        withdraw.status = "approved";
        await withdraw.save();
        const user = await User.findById(withdraw.userId);
        user.balance -= withdraw.amount;
        await user.save();
        res.json({success:true});
    }catch(err){ console.error(err); res.status(500).json({error:"Server error"});}
});

router.post("/withdraw/:id/decline", isAdmin, async(req,res)=>{
    try{
        const withdraw = await Withdraw.findById(req.params.id);
        if(!withdraw) return res.status(404).json({error:"Withdraw not found"});
        withdraw.status = "declined";
        await withdraw.save();
        res.json({success:true});
    }catch(err){ console.error(err); res.status(500).json({error:"Server error"});}
});

// =========================
// APPROVE / DECLINE LOAN
// =========================
router.post("/loan/:id/approve", isAdmin, async(req,res)=>{
    try{
        const loan = await Loan.findById(req.params.id);
        if(!loan) return res.status(404).json({error:"Loan not found"});
        loan.status = "approved";
        await loan.save();
        const user = await User.findById(loan.userId);
        user.balance += loan.amount;
        await user.save();
        res.json({success:true});
    }catch(err){ console.error(err); res.status(500).json({error:"Server error"});}
});

router.post("/loan/:id/decline", isAdmin, async(req,res)=>{
    try{
        const loan = await Loan.findById(req.params.id);
        if(!loan) return res.status(404).json({error:"Loan not found"});
        loan.status = "declined";
        await loan.save();
        res.json({success:true});
    }catch(err){ console.error(err); res.status(500).json({error:"Server error"});}
});

// =========================
// APPROVE / DECLINE KYC
// =========================
router.post("/kyc/:id/approve", isAdmin, async(req,res)=>{
    try{
        const kyc = await KYC.findById(req.params.id);
        if(!kyc) return res.status(404).json({error:"KYC not found"});
        kyc.status = "approved";
        await kyc.save();
        const user = await User.findById(kyc.userId);
        user.kyc_status = true;
        await user.save();
        res.json({success:true});
    }catch(err){ console.error(err); res.status(500).json({error:"Server error"});}
});

router.post("/kyc/:id/decline", isAdmin, async(req,res)=>{
    try{
        const kyc = await KYC.findById(req.params.id);
        if(!kyc) return res.status(404).json({error:"KYC not found"});
        kyc.status = "declined";
        await kyc.save();
        res.json({success:true});
    }catch(err){ console.error(err); res.status(500).json({error:"Server error"});}
});

module.exports = router;