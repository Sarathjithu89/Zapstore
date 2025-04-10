// Import required models and packages
const Cart = require("../../models/Cart.js");
const Address = require("../../models/Address.js");
const Product = require("../../models/Products.js");
const Order = require("../../models/Order.js");
const crypto = require("crypto");

//get checkout page
const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.user.userId;

    const cart = await Cart.findOne({ userId: userId }).populate({
      path: "items.productId",
      populate: {
        path: "category",
      },
    });

    const cartItems = cart?.items || [];

    const userAddress = await Address.findOne({ userId: userId });
    const wallet = { balance: 0 }; // maybe fetch actual wallet later

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

    // Loop through each item in cart
    for (const item of cart.items) {
      const product = item.productId;

      if (!product) continue; // If product was deleted

      // Check if product is blocked
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
          // Remove item from cart
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

// Place order (Cash on Delivery)
const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    const userId = req.user.userId;

    // Validate address
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    // Fetch cart with populated product info
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const cartItems = cart?.items || [];

    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty",
      });
    }

    // Get selected address
    const userAddress = await Address.findOne({ userId: userId });
    const shippingAddress = userAddress?.address?.id(addressId);

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Invalid shipping address",
      });
    }

    // Placeholder for coupon discount logic
    let couponDiscount = 0;
    const totalSubtotal = cartItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    // Group cart items by seller
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

    // Create orders for each seller
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
        address: addressId,
        invoiceDate: new Date(),
        status: "Pending",
        paymentMethod: paymentMethod,
        couponApplied: !!couponCode,
      });

      await order.save();
      orderIds.push(order.orderId);

      // Update product stock
      for (const item of items) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { quantity: -item.quantity, sold: item.quantity },
        });
      }
    }
    //update product

    // Clear cart
    await Cart.deleteOne({ userId });

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
    // Render add address page with return URL set to checkout
    res.render("users/addAddress", { returnUrl: "/checkout" });
  } catch (error) {
    console.error("Error rendering add address page:", error);
    res.status(500).render("error", {
      message: "Error loading address form",
      error,
    });
  }
};

module.exports = {
  getCheckoutPage,
  checkStock,
  placeOrder,
  addAddressCheckout,
};
