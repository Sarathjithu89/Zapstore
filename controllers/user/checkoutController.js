const Cart = require("../../models/Cart.js");
const Address = require("../../models/Address.js");
const Product = require("../../models/Products.js");
const Order = require("../../models/Order.js");
const User = require("../../models/User.js");
const Wallet = require("../../models/Wallet.js");
const mongoose = require("mongoose");
const Coupon = require("../../models/Coupon.js");
const Transaction = require("../../models/Transactions.js");
//const { default: items } = require("razorpay/dist/types/items.js");
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
    // const totalCategoryOffer = user.cart.flatMap((item) => {
    //   return item.items
    //     .map(
    //       (itm) =>
    //         itm.productId?.salePrice -
    //         (itm.productId?.salePrice *
    //           itm.productId?.category?.categoryOffer) /
    //           100
    //     )
    //     .reduce((sum, offer) => sum + offer, 0);
    // });
    // const totalProductOffer = user.cart.flatMap((item) => {
    //   return item.items.map(
    //     (itm) =>
    //       itm.productId?.salePrice -
    //       (itm.productId?.salePrice * itm.productId?.productOffer) / 100
    //   );
    // });

    // console.log(totalCategoryOffer);
    // console.log(totalProductOffer);

    let subtotal = 0;
    if (cartItems.length > 0) {
      subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
    }

    // const offerdiscount =
    //   totalCategoryOffer > totalProductOffer
    //     ? totalCategoryOffer
    //     : totalProductOffer;

    // subtotal = (subtotal - subtotal * offerdiscount) / 100;

    res.render("checkout.ejs", {
      cartItems,
      userAddress,
      wallet,
      subtotal,
    });
  } catch (error) {
    console.error("Error fetching checkout data:", error);
    res.status(500).render("error", {
      message: "Error loading checkout page",
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
      return res.json({ success: true, items: [] });
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

    return res.json({ success: true, items: stockStatus });
  } catch (error) {
    console.error("Error checking stock:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking product availability",
    });
  }
};

// Place order- Cash on Delivery
const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, couponCode, paymentId } = req.body;
    const userId = req.user.userId;

    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }
    const user = await User.findOne({ _id: userId });
    const OrderHistory = user.OrderHistory;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const cartItems = cart?.items || [];

    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty",
      });
    }
    const userAddress = await Address.findOne({ userId: userId });
    const shippingAddress = userAddress?.address?.id(addressId);

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Invalid shipping address",
      });
    }

    let couponDiscount = 0;
    const totalSubtotal = cartItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    const sellerGroups = {};
    for (const item of cartItems) {
      const product = item.productId;
      const sellerId = product?.seller?.toString() || "admin";
      if (!sellerGroups[sellerId]) {
        sellerGroups[sellerId] = [];
      }

      sellerGroups[sellerId].push(item);
    }

    const orderIds = [];
    //seller
    for (const [sellerId, items] of Object.entries(sellerGroups)) {
      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const shippingCost = 50; //fixed
      const sellerDiscount = (subtotal / totalSubtotal) * couponDiscount;
      const totalAmount = subtotal + shippingCost - sellerDiscount;

      const order = new Order({
        userId: userId,
        orderedItems: items.map((item) => ({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.productId.salePrice,
        })),
        totalPrice: subtotal,
        discount: sellerDiscount,
        finalAmount: totalAmount,
        address: shippingAddress,
        invoiceDate: new Date(),
        status: "Pending",
        paymentMethod: paymentMethod,
        couponApplied: !!couponCode,
      });

      await order.save();
      orderIds.push(order.orderId);
      OrderHistory.push(order._id);
      await user.save();

      // Update  stock
      for (const item of items) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { quantity: -item.quantity, sold: item.quantity },
        });
      }
    }
    // Clear cart
    await Cart.deleteOne({ userId });

    req.session.orderSuccess = {
      orderIds: orderIds,
      paymentMethod: paymentMethod,
      couponApplied: !!couponCode,
    };

    return res.json({
      success: true,
      message: "Order placed successfully",
      orderIds,
    });
  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing your order",
    });
  }
};

// Add address from checkout page
const addAddressCheckout = (req, res) => {
  try {
    res.render("users/addAddress", { returnUrl: "/checkout" });
  } catch (error) {
    console.error("Error rendering add address page:", error);
    res.status(500).render("error", {
      message: "Error loading address form",
      error,
    });
  }
};

const WalletOrder = async (req, res) => {
  try {
    const { addressId, couponCode, amount } = req.body;
    const userId = req.user.userId;

    if (!addressId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request parameters",
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
        return res.status(404).json({
          success: false,
          message: "Wallet not Found",
        });
      }

      if (wallet.balance < amount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Insufficient Balance",
        });
      }

      const cart = await Cart.findOne({ userId: userId })
        .populate("items.productId")
        .session(session);

      if (!cart || cart.items.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
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
        return res.status(400).json({
          success: false,
          message: "Shipping address not found",
        });
      }

      const shippingAddress = userAddress.address.id(addressId);
      let discount = 0;
      if (couponCode) {
        const coupon = await Coupon.findOne({
          name: couponCode,
          isListed: true,
          expireOn: { $gt: new Date() },
        }).session(session);

        if (coupon) {
          discount = coupon.offerPrice;
        }
      }

      let subtotal = 0;
      const orderedItems = cart.items.map((item) => {
        subtotal += item.totalPrice;
        return {
          product: item.productId,
          quantity: item.quantity,
          price: item.price,
        };
      });

      const shippingCost = 50; // fixed
      const grandTotal = subtotal - discount + shippingCost;

      //order
      const newOrder = new Order({
        userId: userId,
        orderedItems,
        address: shippingAddress,
        paymentMethod: "Wallet",
        paymentStatus: "Paid",
        status: "Pending",
        totalPrice: subtotal,
        discount,
        finalAmount: grandTotal,
        invoiceDate: new Date(),
        couponApplied: !!couponCode,
      });

      await newOrder.save({ session });
      orderIds.push(newOrder.orderId);
      OrderHistory.push(newOrder._id);
      await user.save({ session });

      wallet.balance -= Number(amount);
      await wallet.save({ session });

      const transaction = new Transaction({
        wallet: wallet._id,
        amount: Number(amount),
        type: "debit",
        description: `Payment for order #${newOrder.orderId}`,
        orderId: newOrder._id,
      });

      await transaction.save({ session });

      for (const item of cart.items) {
        await Product.updateOne(
          { _id: item.productId._id },
          { $inc: { quantity: -item.quantity } },
          { session }
        );
      }

      cart.items = [];
      await cart.save({ session });

      await session.commitTransaction();
      session.endSession();

      //for order success page
      req.session.orderSuccess = {
        orderIds: orderIds,
        paymentMethod: newOrder.paymentMethod,
        couponApplied: !!couponCode,
      };

      return res.status(200).json({
        success: true,
        message: "Order placed successfully!",
        orderIds,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.log("Wallet order error:", error);
    return res.status(500).json({
      success: false,
      message: "Order processing failed",
    });
  }
};

module.exports = {
  getCheckoutPage,
  checkStock,
  placeOrder,
  addAddressCheckout,
  WalletOrder,
};
