const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    phone: { type: String, required: false, sparse: true, default: null },
    googleId: { type: String, unique: true },
    address_id: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    is_blocked: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("user", userSchema);

//real model
/*
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    address_id: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    phone_number: { type: String, required: true },
    is_blocked: { type: Boolean, default: false },
    is_admin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
*/
