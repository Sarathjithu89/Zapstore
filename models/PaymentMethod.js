const mongoose = require("mongoose");

const paymentMethodSchema = new mongoose.Schema({
  name: { type: String, required: true },
  details: { type: String },
});

module.exports = mongoose.model("PaymentMethod", paymentMethodSchema);
