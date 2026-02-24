// ===============================
// ELITE EMAIL SYSTEM (mailer.js)
// ===============================
const nodemailer = require("nodemailer");
require("dotenv").config();

// ===============================
// SMTP CONFIG
// ===============================
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// test smtp
transporter.verify((err)=>{
    if(err) console.log("SMTP ERROR:", err);
    else console.log("✅ Email server ready");
});


// ===============================
// ELITE EMAIL DESIGN TEMPLATE
// ===============================
function eliteTemplate(title, message){
return `
<div style="background:#0d0d14;padding:40px;font-family:sans-serif;color:white">
  <div style="max-width:600px;margin:auto;background:#111827;padding:30px;border-radius:15px;border:1px solid gold">
    
    <h1 style="color:gold;text-align:center">${title}</h1>
    
    <p style="font-size:16px;line-height:1.6;text-align:center">
    ${message}
    </p>

    <div style="text-align:center;margin-top:30px">
      <a href="http://localhost:3000/login"
      style="background:gold;color:black;padding:12px 25px;
      text-decoration:none;border-radius:8px;font-weight:bold">
      Login Dashboard
      </a>
    </div>

    <p style="text-align:center;margin-top:30px;font-size:12px;color:gray">
    Elite Investment Company © 2026
    </p>

  </div>
</div>
`;
}


// ===============================
// 1. WELCOME EMAIL
// ===============================
function sendWelcomeEmail(to, fullname){
const html = eliteTemplate(
"Welcome To Elite Investment",
`Hello <b>${fullname}</b>,<br>
Your account has been successfully created.<br><br>
You can now invest, deposit, withdraw and grow your wealth with us.<br>
We are happy to have you onboard.`
);

transporter.sendMail({
from:process.env.EMAIL_USER,
to,
subject:"🎉 Registration Successful",
html
});
}


// ===============================
// 2. DEPOSIT EMAIL
// ===============================
function sendDepositEmail(to, fullname, amount, balance){
const html = eliteTemplate(
"Deposit Successful",
`Hello ${fullname},<br><br>
We received your deposit of <b>$${amount}</b> successfully.<br>
Your new account balance is <b>$${balance}</b>.<br><br>
Thank you for investing with us.`
);

transporter.sendMail({from:process.env.EMAIL_USER,to,subject:"Deposit Successful",html});
}


// ===============================
// 3. WITHDRAW EMAIL
// ===============================
function sendWithdrawEmail(to, fullname, amount, balance){
const html = eliteTemplate(
"Withdrawal Processed",
`Hello ${fullname},<br><br>
Your withdrawal request of <b>$${amount}</b> has been processed.<br>
Remaining balance: <b>$${balance}</b>.<br><br>
Thank you for using our platform.`
);

transporter.sendMail({from:process.env.EMAIL_USER,to,subject:"Withdrawal Successful",html});
}


// ===============================
// 4. LOAN EMAIL
// ===============================
function sendLoanEmail(to, fullname, amount, status){
const html = eliteTemplate(
"Loan Update",
`Hello ${fullname},<br><br>
Your loan request of <b>$${amount}</b> has been <b>${status}</b>.<br>
Login dashboard for more details.`
);

transporter.sendMail({from:process.env.EMAIL_USER,to,subject:"Loan "+status,html});
}


// ===============================
// 5. KYC EMAIL
// ===============================
function sendKycEmail(to, fullname, status){
const html = eliteTemplate(
"KYC Verification",
`Hello ${fullname},<br><br>
Your KYC verification has been <b>${status}</b>.<br>
You can now enjoy full platform features.`
);

transporter.sendMail({from:process.env.EMAIL_USER,to,subject:"KYC "+status,html});
}


// ===============================
// 6. INVEST EMAIL
// ===============================
function sendInvestEmail(to, fullname, plan, amount){
const html = eliteTemplate(
"Investment Confirmed",
`Hello ${fullname},<br><br>
You invested <b>$${amount}</b> into <b>${plan}</b> plan.<br>
Your ROI will start counting immediately.<br><br>
Thank you for investing with us.`
);

transporter.sendMail({from:process.env.EMAIL_USER,to,subject:"Investment Successful",html});
}


// ===============================
module.exports = {
sendWelcomeEmail,
sendDepositEmail,
sendWithdrawEmail,
sendLoanEmail,
sendKycEmail,
sendInvestEmail
};
