const User = require("../../models/User.js");
const Coupon = require("../../models/Coupon.js");
const Order = require("../../models/Order.js");
const Cart = require("../../models/Cart.js");

//get coupons
const getMyCoupons = async (req, res) => {
  try {
    if (!req.user) {
      req.flash("error", "Please login to view your coupons");
      return res.redirect("/");
    }

    const userId = req.user.userId;

    const currentDate = new Date();

    const allCoupons = await Coupon.find({
      $or: [{ UserId: userId }, { UserId: { $size: 0 } }],
      isListed: true,
    });

    const userOrders = await Order.find({
      userId: userId,
      couponApplied: true,
      couponName: { $exists: true, $ne: null },
    });

    const usedCouponNames = userOrders.map((order) => order.couponName);

    const categorizedCoupons = {
      available: [],
      used: [],
      expired: [],
    };

    allCoupons.forEach((coupon) => {
      const couponData = {
        id: coupon._id,
        name: coupon.name,
        offerPrice: coupon.offerPrice,
        minimumPrice: coupon.minimumPrice,
        expireOn: coupon.expireOn,
      };

      if (new Date(coupon.expireOn) < currentDate) {
        categorizedCoupons.expired.push(couponData);
      } else if (usedCouponNames.includes(coupon.name)) {
        categorizedCoupons.used.push(couponData);
      } else {
        categorizedCoupons.available.push(couponData);
      }
    });

    res.render("user/coupons.ejs", {
      title: "My coupons",
      coupons: categorizedCoupons,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    req.flash("error", "Failed to load coupons.Please try again later.");
    res.redirect("/coupons");
  }
};

//apply coupon
const applyCoupon = async (req, res) => {
  try {
    const { couponName } = req.body;
    const userId = req.user.userId;
    if (!userId) {
      req.flash("error", "Please login");
      return res.redirect("/");
    }

    const cart = (await Cart.findOne({ userId: userId })) || {
      items: [],
    };
    let totalPrice = 0;
    cart.items.forEach((item) => (totalPrice += item.totalPrice));

    if (!cart.items.length) {
      return res.json({
        success: false,
        message: "Your cart is empty",
      });
    }

    const coupon = await Coupon.findOne({
      name: couponName,
      $or: [{ UserId: userId }, { UserId: { $size: 0 } }],
      expireOn: { $gt: new Date() },
      isListed: true,
    });

    if (!coupon) {
      return res.json({
        success: false,
        message: "Invalid or expired coupon",
      });
    }

    if (totalPrice < coupon.minimumPrice) {
      return res.json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minimumPrice} required to use this coupon`,
      });
    }

    const hasUsed = await Order.findOne({
      userId: userId,
      couponApplied: true,
      couponName: couponName,
    });
    if (hasUsed) {
      return res.json({
        success: false,
        message: "You have already used this coupon",
      });
    }

    let discountAmount = coupon.offerPrice;
    let finalAmount = cart.totalPrice - discountAmount;

    if (!req.session.cart) {
      req.session.cart = {};
    }

    req.session.cart.couponApplied = true;
    req.session.cart.couponName = couponName;
    req.session.cart.discount = discountAmount;
    req.session.cart.finalAmount = cart.totalPrice - discountAmount;

    return res.json({
      success: true,
      message: "coupon applied successfully",
      discount: discountAmount,
      finalAmount: finalAmount,
      coupon: {
        name: couponName,
        offerPrice: discountAmount,
      },
    });
  } catch (error) {
    console.error("Error applying coupon", error);
    return res.json({
      success: false,
      message: "Failed to apply coupon.Please try again",
    });
  }
};

//remove coupon
const removeCoupon = (req, res) => {
  try {
    if (!req.user) {
      return res.json({
        success: false,
        message: "please login to continue",
      });
    }

    if (!req.session.cart) {
      return res.json({
        success: false,
        message: "No active cart found",
      });
    }

    req.session.cart.couponApplied = false;
    delete req.session.cart.couponName;
    delete req.session.cart.discount;
    req.session.cart.finalAmount = req.session.cart.totalPrice;

    return res.json({
      success: true,
      message: "coupon remove successfully",
      totalPrice: req.session.cart.totalPrice,
    });
  } catch (error) {
    console.error("Error removing coupn:", error);
    return res.json({
      success: false,
      message: "Failed to remove coupon. Please try again",
    });
  }
};

module.exports = {
  getMyCoupons,
  applyCoupon,
  removeCoupon,
};
