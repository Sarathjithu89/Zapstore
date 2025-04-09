const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    address: [
      {
        addressType: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        addressLine: {
          type: String,
          required: true,
        },
        country: {
          type: String,
          required: true,
        },
        city: {
          type: String,
          required: true,
        },
        landMark: {
          type: String,
        },
        state: {
          type: String,
          required: true,
        },
        pincode: {
          type: String,
          required: true,
          match: /^[0-9]{6}$/, //6 digit number check
        },
        phone: {
          type: String,
        },
        altPhone: {
          type: String,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Address", addressSchema);
