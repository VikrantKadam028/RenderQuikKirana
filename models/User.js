const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    isVerified: { type: Boolean, default: false },
    username: { type: String },
    shopName: { type: String },
    profilePicture: { type: String }
});

module.exports = mongoose.model("User", userSchema);
