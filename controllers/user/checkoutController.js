const Cart = require("../../models/Cart.js");
const Address = require("../../models/Address.js");
const Product = require("../../models/Products.js");
const Order = require("../../models/Order.js");
const User = require("../../models/User.js");
const Wallet = require("../../models/Wallet.js");
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
    if (cartItems.length > 0) {
      subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
    }

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
    const { addressId, paymentMethod, couponCode } = req.body;
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
      const shippingCost = 50;
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
    const { orderId, amount } = req.body;
    const userId = req.user.userId;

    if (!orderId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request parameters",
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

      if (!order.user.equals(userId)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          success: false,
          message: "Unauthorized access to order",
        });
      }

      // Update wallet balance
      wallet.balance -= Number(amount);
      wallet.updatedAt = new Date();
      await wallet.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        user: userId,
        amount: Number(amount),
        type: "debit",
        description: `Payment for order #${order.orderNumber}`,
        orderId: order._id,
      });

      await transaction.save({ session });

      // Update order payment status
      order.paymentStatus = "paid";
      order.paymentMethod = "wallet";
      order.paidAmount = amount;
      order.paidAt = new Date();
      await order.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Payment successful!",
        orderId: order._id,
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Wallet payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment processing failed",
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
