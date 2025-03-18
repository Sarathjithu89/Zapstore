const mongoose = require("mongoose");
const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    product: [
      {
        productId: {
          type: String,
        },
        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],
    amoundt: { type: Number, required: true },
    address: { type: Object, required: true },
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("user", orderSchema);

//real model
/*
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    order_date: { type: Date, default: Date.now },
    shipping_address_id: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    total_amount: { type: Number, required: true },
    status: { type: String, enum: ["Pending", "Shipped", "Delivered", "Canceled"], default: "Pending" },
    payment_method_id: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);

*/
