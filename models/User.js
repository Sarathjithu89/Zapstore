const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    phone: { type: String, required: false, sparse: true, default: null },
    googleId: { type: String, unique: true, required: false },
    address_id: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    is_blocked: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("user", userSchema);
