const Coupon = require("../../models/Coupon.js");
const Order = require("../../models/Order.js");
const Cart = require("../../models/Cart.js");
const MESSAGES = require("../../config/messages.js");
const HTTP_STATUS = require("../../config/statusCodes.js");

//get coupons
const getMyCoupons = async (req, res) => {
  try {
    if (!req.user) {
      req.flash("error", MESSAGES.ERROR.AUTHENTICATION_REQUIRED);
      return res.redirect("/");
    }

    const userId = req.user.userId;
    const currentDate = new Date();

    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const allCoupons = await Coupon.find({
      $or: [
        { UserId: userId },
        { UserId: { $nin: [userId] } },
        {
          isReferralCoupon: true,
          isusedFor: userId,
        },
      ],
      isListed: true,
    });

    const referralCoupons = allCoupons.filter((c) => c.isReferralCoupon);

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
      if (
        coupon.isReferralCoupon &&
        coupon.isusedFor.toString() !== userId.toString()
      ) {
        return;
      }

      const couponData = {
        id: coupon._id,
        name: coupon.name,
        offerPrice: coupon.offerPrice,
        minimumPrice: coupon.minimumPrice,
        expireOn: coupon.expireOn,
        isReferralCoupon: coupon.isReferralCoupon || false,
      };

      if (new Date(coupon.expireOn) < currentDate) {
        categorizedCoupons.expired.push(couponData);
      } else if (usedCouponNames.includes(coupon.name)) {
        categorizedCoupons.used.push(couponData);
      } else {
        categorizedCoupons.available.push(couponData);
      }
    });

    const activeTab = req.query.tab || "available";

    const totalCoupons = categorizedCoupons[activeTab].length;
    const totalPages = Math.ceil(totalCoupons / limit);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginatedCoupons = { ...categorizedCoupons };
    paginatedCoupons[activeTab] = categorizedCoupons[activeTab].slice(
      startIndex,
      endIndex
    );

    res.render("user/coupons.ejs", {
      title: "My coupons",
      coupons: paginatedCoupons,
      user: req.user,
      pagination: {
        page,
        limit,
        totalPages,
        totalCoupons,
        activeTab,
      },
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    req.flash("error", MESSAGES.ERROR.SOMETHING_WRONG);
    res.redirect("/coupons");
  }
};

//apply coupon
const applyCoupon = async (req, res) => {
  try {
    const { couponName } = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.ERROR.AUTHENTICATION_REQUIRED,
      });
    }

    const cart = (await Cart.findOne({ userId: userId })) || {
      items: [],
    };
    let totalPrice = 0;
    cart.items.forEach((item) => (totalPrice += item.totalPrice));

    if (!cart.items.length) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
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
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.COUPON.INVALID,
      });
    }

    if (totalPrice < coupon.minimumPrice) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
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
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: MESSAGES.COUPON.ALREADY_USED,
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

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.COUPON.APPLIED,
      discount: discountAmount,
      finalAmount: finalAmount,
      coupon: {
        name: couponName,
        offerPrice: discountAmount,
      },
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
    });
  }
};

//remove coupon
const removeCoupon = (req, res) => {
  try {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.ERROR.AUTHENTICATION_REQUIRED,
      });
    }

    if (!req.session.cart) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "No active cart found",
      });
    }

    req.session.cart.couponApplied = false;
    delete req.session.cart.couponName;
    delete req.session.cart.discount;
    req.session.cart.finalAmount = req.session.cart.totalPrice;

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Coupon removed successfully",
      totalPrice: req.session.cart.totalPrice,
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
    });
  }
};

module.exports = {
  getMyCoupons,
  applyCoupon,
  removeCoupon,
};