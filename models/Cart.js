const mongoose = require("mongoose");
const carttSchema = new mongoose.Schema(
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("user", carttSchema);

//real model
/*
const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  product_id: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  quantity: { type: Number, required: true },
});

module.exports = mongoose.model("Cart", cartSchema);
*/
