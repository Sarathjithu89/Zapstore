const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    orderId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
    },
    orderedItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          default: 0,
        },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
    },
    address: {
      type: Object,
      required: true,
    },
    invoiceDate: {
      type: Date,
    },
    status: {
      type: String,
      required: true,
      enum: [
        "Pending",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
        "Return Request",
        "Returned",
      ],
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Not Paid", "Refunded"],
    },
    couponApplied: {
      type: Boolean,
      default: false,
    },
    statusHistory: [
      {
        status: {
          type: String,
        },
        updatedBy: {
          type: String,
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },

  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
