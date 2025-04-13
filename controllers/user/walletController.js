const User = require("../../models/User.js");
const Wallet = require("../../models/Wallet.js");
const Transaction = require("../../models/Transactions.js");
const Order = require("../../models/Order.js");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// Display wallet page with balance and transactions
const getWallet = async (req, res) => {
  try {
    const userId = req.user.userId;
    // Find or create wallet
    let user = await User.findOne({ _id: userId });
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      wallet = new Wallet({
        user: userId,
        balance: 0,
      });
      await wallet.save();
      user.wallet = wallet._id;
      await user.save();
    }

    // Get transaction history
    const transactions = await Transaction.find({ wallet: user.wallet })
      .sort({ createdAt: -1 })
      .limit(50);

    res.render("user/wallet.ejs", {
      wallet,
      transactions,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    req.flash("error", "Failed to fetch wallet details");
    res.redirect("/userProfile");
  }
};

// Initialize adding money to wallet
const addMoney = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid amount",
      });
    }

    // Create Razorpay order
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `wallet_${req.user._id}_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        type: "wallet_recharge",
      },
    };

    const order = await razorpay.orders.create(options);

    // Store order details in session for verification later
    req.session.razorpayOrderId = order.id;
    req.session.walletRechargeAmount = amount;

    return res.status(200).json({
      success: true,
      redirectUrl: "/wallet/payment",
      order,
    });
  } catch (error) {
    console.error("Error creating payment order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process your request",
    });
  }
};

// Render payment page
const getPaymentPage = (req, res) => {
  if (!req.session.razorpayOrderId || !req.session.walletRechargeAmount) {
    req.flash("error", "Payment session expired. Please try again.");
    return res.redirect("/wallet");
  }

  res.render("user/wallet-payment", {
    orderId: req.session.razorpayOrderId,
    amount: req.session.walletRechargeAmount,
    key_id: process.env.RAZORPAY_KEY_ID,
    user: req.user,
  });
};

// Verify payment and update wallet
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;

    // Verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const amount = req.session.walletRechargeAmount;
    const userId = req.user._id;

    // Update wallet balance
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find or create wallet
      let wallet = await Wallet.findOne({ user: userId }).session(session);
      if (!wallet) {
        wallet = new Wallet({
          user: userId,
          balance: 0,
        });
      }

      // Update balance
      wallet.balance += Number(amount);
      wallet.updatedAt = new Date();
      await wallet.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        user: userId,
        amount: Number(amount),
        type: "credit",
        description: "Added money to wallet",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
      });

      await transaction.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Clear session data
      delete req.session.razorpayOrderId;
      delete req.session.walletRechargeAmount;

      req.flash("success", `₹${amount} successfully added to your wallet`);
      return res.status(200).json({
        success: true,
        message: "Payment successful and wallet updated!",
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};

// Handle withdrawal requests
const withdrawMoney = async (req, res) => {
  try {
    const { amount, accountNumber, ifscCode } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid amount",
      });
    }

    if (!accountNumber || !ifscCode) {
      return res.status(400).json({
        success: false,
        message: "Bank details are required",
      });
    }

    // Start a session for transaction consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get wallet and check balance
      const wallet = await Wallet.findOne({ user: userId }).session(session);

      if (!wallet) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Wallet not found",
        });
      }

      if (wallet.balance < amount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Insufficient balance",
        });
      }

      // Update wallet balance
      wallet.balance -= Number(amount);
      wallet.updatedAt = new Date();
      await wallet.save({ session });

      // Create withdrawal transaction record
      const transaction = new Transaction({
        user: userId,
        amount: Number(amount),
        type: "debit",
        description: "Withdrawal request",
        status: "pending",
        withdrawalDetails: {
          accountNumber,
          ifscCode,
          requestDate: new Date(),
        },
      });

      await transaction.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      req.flash("success", "Withdrawal request submitted successfully");
      return res.status(200).json({
        success: true,
        message: "Withdrawal request submitted successfully",
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Withdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process withdrawal request",
    });
  }
};

// Handle order refund to wallet
const refundToWallet = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // Start a session for transaction consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get order and validate
      const order = await Order.findById(orderId).session(session);

      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      if (order.refundStatus === "refunded") {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Order has already been refunded",
        });
      }

      const refundAmount = order.paidAmount || order.totalAmount;
      const userId = order.user;

      // Get or create wallet
      let wallet = await Wallet.findOne({ user: userId }).session(session);
      if (!wallet) {
        wallet = new Wallet({
          user: userId,
          balance: 0,
        });
      }

      // Update wallet balance
      wallet.balance += Number(refundAmount);
      wallet.updatedAt = new Date();
      await wallet.save({ session });

      // Create refund transaction record
      const transaction = new Transaction({
        user: userId,
        amount: Number(refundAmount),
        type: "credit",
        description: `Refund for order #${order.orderNumber}`,
        orderId: order._id,
      });

      await transaction.save({ session });

      // Update order refund status
      order.refundStatus = "refunded";
      order.refundedAt = new Date();
      order.refundAmount = refundAmount;
      await order.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Refund processed successfully",
        refundAmount,
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Refund error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process refund",
    });
  }
};

module.exports = {
  getWallet,
  addMoney,
  getPaymentPage,
  verifyPayment,
  withdrawMoney,
  refundToWallet,
};
