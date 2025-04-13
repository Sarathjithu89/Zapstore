const mongoose = require("mongoose");
const walletTransactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    description: {
      type: String,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    paymentId: {
      type: String,
    },
    withdrawalDetails: {
      accountNumber: String,
      ifscCode: String,
      requestDate: Date,
      processedDate: Date,
      status: {
        type: String,
        enum: ["pending", "processed", "rejected"],
        default: "pending",
      },
      remarks: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", walletTransactionSchema);
