const express = require("express");
const router = express.Router();
const db = require("../database");
const path = require("path");

// =======================
// Admin check middleware
// =======================
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.send("❌ Access denied: Admins only");
    }
}

// =======================
// VIEW ALL LOAN REQUESTS
// =======================
router.get("/admin/loans", isAdmin, (req, res) => {
    db.all("SELECT * FROM loans ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.send("Database error");
        // Send EJS view with data
        res.render("admin-loans", { loans: rows, path: "/uploads/loan/" });
    });
});

// =======================
// APPROVE LOAN
// =======================
router.post("/admin/loans/approve/:id", isAdmin, (req, res) => {
    const loanId = req.params.id;

    db.get("SELECT * FROM loans WHERE id=?", [loanId], (err, loan) => {
        if (err || !loan) return res.send("Loan not found");

        // Update loan status
        db.run("UPDATE loans SET status='approved' WHERE id=?", [loanId], (err2) => {
            if (err2) return res.send("DB error on approve");

            // Auto-credit user's balance (example: 1000 per month of loan_duration)
            const creditAmount = loan.loan_duration * 1000; // adjust logic to real loan amount
            db.run("UPDATE users SET balance = balance + ? WHERE id=?", [creditAmount, loan.user_id], (err3) => {
                if (err3) return res.send("Error crediting user balance");
                res.redirect("/admin/loans");
            });
        });
    });
});

// =======================
// REJECT LOAN
// =======================
router.post("/admin/loans/reject/:id", isAdmin, (req, res) => {
    const loanId = req.params.id;
    db.run("UPDATE loans SET status='rejected' WHERE id=?", [loanId], (err) => {
        if (err) return res.send("DB error on reject");
        res.redirect("/admin/loans");
    });
});

module.exports = router;
