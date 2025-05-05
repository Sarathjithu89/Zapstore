const Cart = require("../../models/Cart.js");
const Address = require("../../models/Address.js");
const Product = require("../../models/Products.js");
const Order = require("../../models/Order.js");
const User = require("../../models/User.js");
const Wallet = require("../../models/Wallet.js");
const mongoose = require("mongoose");
const Coupon = require("../../models/Coupon.js");
const Transaction = require("../../models/Transactions.js");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const MESSAGES = require("../../config/messages.js");
const HTTP_STATUS = require("../../config/statusCodes.js");

//initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

//get checkout page
const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.user.userId;

    let users = await User.findOne({ _id: userId });
    if (!users.wallet) {
      let wallet = new Wallet({
        user: userId,
        balance: 0,
      });
      await wallet.save();
      users.wallet = wallet._id;
      await users.save();
    }

    const user = await User.findOne({ _id: userId })
      .populate({
        path: "cart",
        populate: {
          path: "items.productId",
          populate: {
            path: "category",
          },
        },
      })
      .populate({ path: "wallet" });

    const userAddress = await Address.findOne({ userId: userId });

    const cartItems =
      user.cart && user.cart.length > 0 ? user.cart[0].items || [] : [];

    const wallet = user.wallet;

    let subtotal = 0;
    let totalRegularPrice = 0;
    if (cartItems.length > 0) {
      subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
      totalRegularPrice = cartItems.reduce(
        (acc, item) => acc + item.productId.regularPrice,
        0
      );
    }

    res.render("checkout.ejs", {
      totalRegularPrice,
      cartItems,
      userAddress,
      wallet,
      subtotal,
    });
  } catch (error) {
    console.error("Error fetching checkout data:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("error", {
      message: MESSAGES.ERROR.SOMETHING_WRONG,
      error,
    });
  }
};

// Check stock
const checkStock = async (req, res) => {
  try {
    const userId = req.user.userId;

    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: MESSAGES.SUCCESS.DATA_FETCHED,
        items: [],
      });
    }

    const stockStatus = [];

    for (const item of cart.items) {
      const product = item.productId;

      if (!product) continue;

      if (product.isBlocked) {
        stockStatus.push({
          productId: product._id,
          name: product.productName,
          isBlocked: true,
        });
        continue;
      }

      const availableStock = product.quantity;
      const requestedQuantity = item.quantity;

      if (availableStock < requestedQuantity) {
        const newQuantity = availableStock > 0 ? availableStock : 0;

        if (newQuantity > 0) {
          item.quantity = newQuantity;
          item.totalPrice = newQuantity * product.salePrice;
        } else {
          cart.items = cart.items.filter(
            (i) => i.productId._id.toString() !== product._id.toString()
          );
        }

        stockStatus.push({
          productId: product._id,
          name: product.productName,
          requestedQuantity,
          availableQuantity: newQuantity,
          stockChanged: true,
          message: MESSAGES.PRODUCT.OUT_OF_STOCK,
        });
      } else {
        stockStatus.push({
          productId: product._id,
          name: product.productName,
          requestedQuantity,
          availableQuantity: availableStock,
          stockChanged: false,
        });
      }
    }

    await cart.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.DATA_FETCHED,
      items: stockStatus,
    });
  } catch (error) {
    console.error("Error checking stock:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
    });
  }
};

//Place order-COD
const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    const userId = req.user.userId;

    if (!addressId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ERROR.INVALID_ADDRESS,
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findOne({ _id: userId }).session(session);
      const OrderHistory = user.OrderHistory;

      const cart = await Cart.findOne({ userId })
        .populate("items.productId")
        .session(session);

      const cartItems = cart?.items || [];

      if (cartItems.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Your cart is empty",
        });
      }

      const userAddress = await Address.findOne({ userId: userId }).session(
        session
      );
      const shippingAddress = userAddress?.address?.id(addressId);

      if (!shippingAddress) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: "Invalid shipping address",
        });
      }

      const couponApplied = req.session.cart?.couponApplied || false;
      const couponDiscount = couponApplied ? req.session.cart.discount : 0;
      const couponName = couponApplied ? req.session.cart.couponName : null;

      let subtotal = 0;
      let totalRegularPrice = 0;
      const orderedItems = cartItems.map((item) => {
        subtotal += item.totalPrice;
        totalRegularPrice += item.productId.regularPrice;
        return {
          product: item.productId._id,
          quantity: item.quantity,
          price: item.productId.salePrice,
        };
      });

      if (subtotal > 1000) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          info: true,
          message: "Cash on Delivery is not available for orders above ₹1000",
        });
      }

      const shippingCost = 50; // fixed
      const grandTotal = subtotal - couponDiscount + shippingCost;
      const discount = couponDiscount + (totalRegularPrice - subtotal);

      const order = new Order({
        userId: userId,
        orderedItems,
        totalPrice: subtotal,
        discount,
        finalAmount: grandTotal,
        address: shippingAddress,
        invoiceDate: new Date(),
        status: "Pending",
        paymentMethod: paymentMethod,
        paymentStatus: paymentMethod === "COD" ? "Not Paid" : "Paid",
        couponApplied: !!couponName,
        couponName: couponName,
        shippingCost,
        statusHistory: [
          {
            status: "Pending",
            updatedBy: "System",
            date: new Date(),
          },
        ],
      });

      await order.save({ session });
      const orderId = order.orderId;
      OrderHistory.push(order._id);
      await user.save({ session });

      await Coupon.findOneAndUpdate(
        { name: couponName },
        { $push: { UserId: userId } }
      );

      for (const item of cartItems) {
        await Product.updateOne(
          { _id: item.productId._id },
          { $inc: { quantity: -item.quantity, sold: item.quantity } },
          { session }
        );
      }

      cart.items = [];
      await cart.save({ session });

      await session.commitTransaction();
      session.endSession();

      //order success
      req.session.orderSuccess = {
        orderIds: [orderId],
        paymentMethod: paymentMethod,
        couponName,
        couponApplied: couponApplied,
        totalRegularPrice,
      };

      delete req.session.cart;

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: MESSAGES.ORDER.PLACED,
        orderIds: [orderId],
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
    });
  }
};

// Add address from checkout page
const addAddressCheckout = (req, res) => {
  try {
    res.render("users/addAddress", { returnUrl: "/checkout" });
  } catch (error) {
    console.error("Error rendering add address page:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("error", {
      message: MESSAGES.ERROR.SOMETHING_WRONG,
      error,
    });
  }
};

const WalletOrder = async (req, res) => {
  try {
    const { addressId, amount } = req.body;
    const userId = req.user.userId;
    if (!addressId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ERROR.INVALID_ADDRESS,
      });
    }

    if (!amount || amount <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ERROR.INVALID_REQUEST,
      });
    }
    const orderIds = [];
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const wallet = await Wallet.findOne({ user: userId }).session(session);

      const user = await User.findOne({ _id: userId }).session(session);
      const OrderHistory = user.OrderHistory;

      if (!wallet) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: "Wallet not Found",
        });
      }

      const cart = await Cart.findOne({ userId: userId })
        .populate({
          path: "items.productId",
          populate: {
            path: "category",
            select: "name categoryOffer",
          },
        })
        .session(session);

      if (!cart || cart.items.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Your cart is Empty",
        });
      }

      const userAddress = await Address.findOne({
        userId: userId,
      }).session(session);

      if (!userAddress) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: "Shipping address not found",
        });
      }

      const shippingAddress = userAddress.address.id(addressId);
      const couponApplied = req.session.cart?.couponApplied || false;
      const couponDiscount = couponApplied ? req.session.cart.discount || 0 : 0;
      const couponName = couponApplied ? req.session.cart.couponName : null;

      let subtotal = 0;
      let totalRegularPrice = 0;
      const orderedItems = cart.items.map((item) => {
        const regularPrice = item.productId.regularPrice;
        const categoryOffer = item.productId.category?.categoryOffer || 0;
        const productOffer = item.productId.productOffer || 0;
        const bestDiscount = Math.max(categoryOffer, productOffer);

        const discountedPrice =
          Math.round(
            (regularPrice - (bestDiscount / 100) * regularPrice) * 100
          ) / 100;

        totalRegularPrice += regularPrice * item.quantity;
        subtotal += item.quantity * discountedPrice;

        return {
          product: item.productId._id,
          quantity: item.quantity,
          price: discountedPrice,
        };
      });

      const shippingCost = 50; // fixed
      const productDiscount = totalRegularPrice - subtotal;
      const totalDiscount = productDiscount + couponDiscount;
      const grandTotal = subtotal - couponDiscount + shippingCost;

      if (wallet.balance < grandTotal) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.WALLET.INSUFFICIENT_BALANCE,
        });
      }
      //order
      const newOrder = new Order({
        userId: userId,
        orderedItems,
        address: shippingAddress,
        paymentMethod: "Wallet",
        paymentStatus: "Paid",
        status: "Pending",
        totalPrice: subtotal,
        discount: totalDiscount,
        finalAmount: grandTotal,
        invoiceDate: new Date(),
        couponApplied: !!couponName,
        couponName: couponName,
        shippingCost,
        statusHistory: [
          {
            status: "Pending",
            updatedBy: "System",
            date: new Date(),
          },
        ],
      });

      await newOrder.save({ session });
      orderIds.push(newOrder.orderId);
      OrderHistory.push(newOrder._id);
      await user.save({ session });

      wallet.balance -= Number(grandTotal);
      await wallet.save({ session });

      const transaction = new Transaction({
        wallet: wallet._id,
        amount: Number(grandTotal),
        balanceAfter: wallet.balance,
        type: "debit",
        description: `Payment for order #${newOrder.orderId}`,
        orderId: newOrder._id,
      });

      await transaction.save({ session });

      if (couponName) {
        await Coupon.findOneAndUpdate(
          { name: couponName },
          { $push: { UserId: userId } },
          { session }
        );
      }

      for (const item of cart.items) {
        await Product.updateOne(
          { _id: item.productId._id },
          { $inc: { quantity: -item.quantity, sold: item.quantity } },
          { session }
        );
      }

      cart.items = [];
      await cart.save({ session });

      await session.commitTransaction();
      session.endSession();

      req.session.orderSuccess = {
        orderIds: orderIds,
        paymentMethod: newOrder.paymentMethod,
        couponName,
        couponApplied: couponApplied,
        totalRegularPrice,
      };

      delete req.session.cart;

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: MESSAGES.ORDER.PLACED,
        orderIds,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Wallet order error:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
    });
  }
};

//razropay payment
const razorpayPayment = async (req, res) => {
  try {
    const { amount, addressId } = req.body;

    if (!addressId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ERROR.INVALID_ADDRESS,
      });
    }

    if (!amount) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: MESSAGES.ERROR.INVALID_REQUEST });
    }
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: MESSAGES.ERROR.USER_NOT_FOUND });
    }
    const cart = await Cart.findOne({ userId: userId });

    let subtotal = 0;
    const couponDiscount = req.session.cart?.discount || 0;
    const shippingCost = 50;

    cart.items.map((item) => (subtotal += item.totalPrice));

    const totalAmount = subtotal - couponDiscount + shippingCost;

    const options = {
      amount: totalAmount.toFixed() * 100, // Convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.OPERATION_SUCCESS,
      key: process.env.RAZORPAY_KEY_ID,
      order: order,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
      error: error.message,
    });
  }
};

//verifyRazorpayPayment
const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      addressId,
    } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Payment verification Failed. Invalid signature",
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.ERROR.AUTHENTICATION_REQUIRED,
      });
    }
    const userAddress = await Address.findOne({ userId: userId });
    const shippingAddress = userAddress?.address?.id(addressId);

    const cart = await Cart.findOne({ userId: userId }).populate({
      path: "items.productId",
      populate: {
        path: "category",
        select: "name categoryOffer",
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Cart is empty",
      });
    }

    const couponApplied = req.session.cart?.couponApplied || false;
    const couponDiscount = couponApplied ? req.session.cart.discount : 0;
    const couponName = couponApplied ? req.session.cart.couponName : null;

    let subtotal = 0;
    const shippingCost = 50;
    let totalRegularPrice = 0;

    const orderedItems = cart.items.map((item) => {
      const regularPrice = item.productId.regularPrice;
      const categoryOffer = item.productId.category?.categoryOffer || 0;
      const productOffer = item.productId.productOffer || 0;
      const bestDiscount = Math.max(categoryOffer, productOffer);

      const discountedPrice =
        Math.round((regularPrice - (bestDiscount / 100) * regularPrice) * 100) /
        100;

      totalRegularPrice += regularPrice * item.quantity;

      const itemTotal = item.quantity * discountedPrice;
      subtotal += itemTotal;

      return {
        product: item.productId._id,
        quantity: item.quantity,
        price: discountedPrice,
      };
    });

    const productDiscount = totalRegularPrice - subtotal;
    const totalDiscount = productDiscount + couponDiscount;
    const totalAmount = subtotal - couponDiscount + shippingCost;

    const newOrder = new Order({
      userId: userId,
      orderedItems: orderedItems,
      address: shippingAddress,
      totalPrice: subtotal,
      discount: totalDiscount,
      finalAmount: totalAmount,
      paymentMethod: "Online",
      onlinePaymentId: razorpay_payment_id,
      paymentStatus: "Paid",
      couponName: couponName,
      couponApplied: !!couponName,
      status: "Pending",
      invoiceDate: new Date(),
      shippingCost,
      statusHistory: [
        {
          status: "Pending",
          updatedBy: "System",
          date: new Date(),
        },
      ],
    });

    const savedOrder = await newOrder.save();

    await User.findByIdAndUpdate(userId, {
      $push: { OrderHistory: savedOrder._id },
    });

    await Coupon.findOneAndUpdate(
      { name: couponName },
      { $push: { UserId: userId } }
    );

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { quantity: -item.quantity, sold: item.quantity },
      });
    }

    cart.items = [];
    await cart.save();

    req.session.orderSuccess = {
      orderIds: [savedOrder.orderId],
      paymentMethod: "Online",
      couponName,
      couponApplied: couponApplied,
      totalRegularPrice,
    };

    delete req.session.cart;

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.ORDER.PLACED,
      orderId: savedOrder.orderId,
    });
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
      error: error.message,
    });
  }
};

module.exports = {
  getCheckoutPage,
  checkStock,
  placeOrder,
  addAddressCheckout,
  WalletOrder,
  razorpayPayment,
  verifyRazorpayPayment,
};
