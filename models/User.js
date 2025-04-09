const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    phone: { type: String, required: false, sparse: true, default: null },
    googleId: { type: String, unique: true, sparse: true },
    address_id: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    is_blocked: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    cart: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cart" }],
    wallet: {
      type: Number,
      default: 0,
    },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Wishlist" }],
    OrderHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    profileImage: {
      type: String,
      default: "default/default-user-avatar.png",
    },
    referalCode: {
      type: String,
    },
    redeemed: {
      type: Boolean,
    },
    redeemedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    searchHistory: [
      {
        category: {
          type: mongoose.Types.ObjectId,
          ref: "Category",
        },
        brand: {
          type: String,
        },
        SearchOn: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("user", userSchema);
