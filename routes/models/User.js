const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    balance: { type: Number, default: 0 },
    kyc_status: { type: Boolean, default: false }
});

module.exports = mongoose.model("User", userSchema);