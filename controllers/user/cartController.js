const User = require("../../models/User.js");
const Cart = require("../../models/Cart.js");
const Product = require("../../models/Products.js");
const { json } = require("body-parser");
const Wishlist = require("../../models/Wishlist.js");

//View the shopping cart
const viewCart = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      req.flash("error", "please login to access cart");
      return res.redirect("/");
    }

    let cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: {
        path: "category",
        select: "name categoryOffer",
      },
    });

    if (!cart) {
      return res.render("cart.ejs", {
        cartItems: [],
        offerdiscount: 0,
        grandTotal: 0,
        totalproductPrice: 0,
        title: "Shopping Cart",
      });
    }

    cart.items.forEach((item) => {
      const regularPrice = item.productId.regularPrice;
      const categoryOffer = item.productId.category?.categoryOffer || 0;
      const productOffer = item.productId.productOffer || 0;
      const bestDiscount = Math.max(categoryOffer, productOffer);

      const discountedPrice =
        Math.round((regularPrice - (bestDiscount / 100) * regularPrice) * 100) /
        100;

      item.price = discountedPrice;
      item.totalPrice = item.quantity * discountedPrice;
    });
    await cart.save();

    let subtotal = 0;
    let offerdiscount = 0;
    let cartItems = [];
    let totalproductPrice = 0;

    if (cart.items.length !== 0) {
      cartItems = cart.items.map((item) => {
        const itemSubtotal = item.totalPrice;
        subtotal += itemSubtotal;

        const originalPrice = item.productId.regularPrice * item.quantity;
        const discountAmount = originalPrice - itemSubtotal;
        offerdiscount += discountAmount;

        totalproductPrice += originalPrice;

        return {
          product: item.productId,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          price: item.price,
          appliedDiscount: Math.max(
            item.productId.category?.categoryOffer || 0,
            item.productId.productOffer || 0
          ),
        };
      });
    }

    res.render("cart.ejs", {
      cartItems,
      offerdiscount,
      grandTotal: subtotal,
      totalproductPrice,
      title: "Shopping Cart",
    });
  } catch (error) {
    console.error("Error in viewCart:", error);
    req.flash("error", "Failed to load cart items");
    res.redirect("/");
  }
};

//Add a product to the cart
const addToCart = async (req, res) => {
  try {
    const productId = req.body.id;
    const quantity = parseInt(req.body.quantity) || 1;
    const userId = req.user?.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Please login to add items to cart" });
    }
    const user = await User.findById(userId);

    const product = await Product.findById(productId).populate("category");
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (product.isBlocked || !product.category.isListed) {
      return res.status(400).json({
        success: false,
        message: "Product or category is not available",
      });
    }

    if (product.quantity < quantity || product.status !== "Available") {
      return res
        .status(400)
        .json({ success: false, message: "Not enough stock available" });
    }

    let cart = await Cart.findOne({ userId });
    const itemPrice = product.salePrice;
    const totalItemPrice = itemPrice * quantity;

    if (!cart) {
      cart = new Cart({
        userId,
        items: [
          {
            productId,
            quantity,
            price: itemPrice,
            totalPrice: totalItemPrice,
          },
        ],
      });
    } else {
      const existingItemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );
      if (existingItemIndex >= 0) {
        const existingItem = cart.items[existingItemIndex];
        const newQuantity =
          cart.items[existingItemIndex].quantity + parseInt(quantity);

        if (newQuantity > 5) {
          //limit 5 per user
          return res.json({
            success: false,
            message: "Maximum 5 quantity per user",
          });
        }

        if (newQuantity > product.quantity) {
          return res.status(400).json({
            success: false,
            message: "Stock limit exceeded",
          });
        }

        existingItem.quantity = newQuantity;
        existingItem.totalPrice = existingItem.price * newQuantity;
      } else {
        cart.items.push({
          productId,
          quantity: parseInt(quantity),
          price: itemPrice,
          totalPrice: totalItemPrice,
        });
      }
    }

    await cart.save();

    const wishlist = await Wishlist.findOne({ userId: userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        (item) => item.productId.toString() !== productId
      );
      await wishlist.save();
    }

    if (!user.cart.includes(cart._id)) {
      user.cart.push(cart._id);
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      cartCount: cart.items.length,
    });
  } catch (error) {
    console.error("Error in addToCart:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
    });
  }
};

//change Quantity
const changeQuantity = async (req, res) => {
  try {
    const { productId, action } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ status: false, message: "Please login to update cart" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ status: false, message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res
        .status(404)
        .json({ status: false, message: "Product not found in cart" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ status: false, message: "Product not found" });
    }

    if (action === "increase") {
      if (cart.items[itemIndex].quantity >= 5) {
        return res
          .status(400)
          .json({ status: false, message: "Maximum 5 quantity per user" });
      }
      // Check availability
      if (cart.items[itemIndex].quantity >= product.quantity) {
        return res
          .status(400)
          .json({ status: false, message: "Stock limit exceeded" });
      }

      cart.items[itemIndex].quantity += 1;
      cart.items[itemIndex].totalPrice =
        cart.items[itemIndex].price * cart.items[itemIndex].quantity;
    } else if (action === "decrease") {
      cart.items[itemIndex].quantity -= 1;

      if (cart.items[itemIndex].quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].totalPrice =
          cart.items[itemIndex].price * cart.items[itemIndex].quantity;
      }
    }

    // cart.items.map((item) => (item.totalPrice = item.quantity * item.price));

    await cart.save();

    return res.status(200).json({
      status: true,
      message: "Cart updated successfully",
    });
  } catch (error) {
    console.error("Error in changeQuantity:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to update cart",
    });
  }
};

//deleteItem
const deleteItem = async (req, res) => {
  try {
    const productId = req.query.id;
    const userId = req.user?.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ status: false, message: "Please login to update cart" });
    }

    const result = await Cart.updateOne(
      { userId },
      { $pull: { items: { productId } } }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Item not found in cart" });
    }

    return res.status(200).json({
      status: true,
      message: "Item removed from cart successfully",
    });
  } catch (error) {
    console.error("Error in deleteItem:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to remove item from cart",
    });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ status: false, message: "Please login to update cart" });
    }
    await Cart.updateOne({ userId }, { $set: { items: [] } });

    req.flash("success", "Cart cleared successfully");
    res.redirect("/cart");
  } catch (error) {
    console.error("Error in clearCart:", error);
    req.flash("error", "Failed to clear cart");
    res.redirect("/cart");
  }
};

module.exports = { viewCart, addToCart, changeQuantity, deleteItem, clearCart };
