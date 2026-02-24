// kycroutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ------------------ MULTER SETUP ------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, "../uploads/kyc");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + "-" + file.fieldname + ext);
    }
});

const upload = multer({ storage });

// ------------------ IN-MEMORY DB (replace with real DB) ------------------
let kycRequests = []; 
let otpCounter = 1000; // simple OTP counter

// ------------------ ROUTES ------------------

// 1️⃣ Submit KYC
router.post("/submit", upload.fields([
    { name: "kycIdFront", maxCount: 1 },
    { name: "kycIdBack", maxCount: 1 },
    { name: "kycSSN", maxCount: 1 },
    { name: "kycAddressProof", maxCount: 1 },
    { name: "kycPINProof", maxCount: 1 }
]), (req, res) => {
    try {
        const { kycName, kycEmail, kycAddress, kycMarital, kycKids, kycPIN } = req.body;
        if (!kycName || !kycEmail || !kycAddress || !kycMarital || !kycKids || !kycPIN) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        const otpId = (otpCounter++).toString();
        const newKyc = {
            otpId,
            name: kycName,
            email: kycEmail,
            address: kycAddress,
            marital: kycMarital,
            kids: kycKids,
            pin: kycPIN,
            files: req.files,
            status: "pending",
            createdAt: Date.now()
        };
        kycRequests.push(newKyc);

        return res.json({ success: true, otpId });
    } catch(err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error submitting KYC." });
    }
});

// 2️⃣ Validate OTP
router.post("/validate-otp", (req, res) => {
    const { otp } = req.body;
    if(!otp) return res.status(400).json({ status: "error", message: "OTP required." });

    const kyc = kycRequests.find(k => k.otpId === otp);
    if(!kyc) return res.status(404).json({ status: "error", message: "Invalid OTP." });

    kyc.status = "pending"; // mark for admin review
    return res.json({ status: "pending", otpId: kyc.otpId });
});

// 3️⃣ Poll Admin Response
router.get("/status/:otpId", (req, res) => {
    const { otpId } = req.params;
    const kyc = kycRequests.find(k => k.otpId === otpId);
    if(!kyc) return res.status(404).json({ status: "error", message: "OTP not found." });
    return res.json({ status: kyc.status });
});

// 4️⃣ Admin Approve KYC
router.post("/admin/approve/:otpId", (req, res) => {
    const { otpId } = req.params;
    const kyc = kycRequests.find(k => k.otpId === otpId);
    if(!kyc) return res.status(404).json({ success: false, message: "KYC not found." });
    kyc.status = "approved";
    return res.json({ success: true, message: "KYC approved." });
});

// 5️⃣ Admin Decline KYC
router.post("/admin/decline/:otpId", (req, res) => {
    const { otpId } = req.params;
    const kyc = kycRequests.find(k => k.otpId === otpId);
    if(!kyc) return res.status(404).json({ success: false, message: "KYC not found." });
    kyc.status = "declined";
    return res.json({ success: true, message: "KYC declined." });
});

module.exports = router;