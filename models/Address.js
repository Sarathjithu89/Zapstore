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
        city: {
          type: String,
          required: true,
        },
        landMark: {
          type: String,
          required: true,
        },
        state: {
          type: String,
          required: true,
        },
        pincode: {
          type: String,
          required: true,
        },
        phone: {
          type: Number,
          required: true,
        },
        altPhone: {
          type: Number,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Address", addressSchema);
