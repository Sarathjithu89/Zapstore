const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    expireOn: {
      type: Date,
      required: true,
    },
    offerPrice: {
      type: Number,
      required: true,
    },
    minimumPrice: {
      type: Number,
      required: true,
    },
    isListed: {
      type: Boolean,
      default: true,
    },

    isReferralCoupon: { type: Boolean, default: false },
    isusedFor: { type: String },
    usageLimit: { type: Number },
    UserId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
