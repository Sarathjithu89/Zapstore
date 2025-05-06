const Coupon = require("../../models/Coupon.js");
const Order = require("../../models/Order.js");
const Cart = require("../../models/Cart.js");
const MESSAGES = require("../../config/messages.js");
const HTTP_STATUS = require("../../config/statusCodes.js");
const { createClient } = require("redis");

const PAGINATION_LIMIT = 4;

// Redis client initialization
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  legacyMode: true,
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error("Redis connection error:", error);
  }
})();

const getMyCoupons = async (req, res) => {
  try {
    if (!req.user) {
      req.flash("error", MESSAGES.ERROR.AUTHENTICATION_REQUIRED);
      return res.redirect("/");
    }

    const userId = req.user.userId;
    const currentDate = new Date();
    const page = parseInt(req.query.page) || 1;
    const limit = PAGINATION_LIMIT;
    const activeTab = req.query.tab || "available";

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

    // Get user's orders with applied coupons
    const userOrders = await Order.find({
      userId: userId,
      couponApplied: true,
      couponName: { $exists: true, $ne: null },
    });

    const usedCouponNames = userOrders.map((order) => order.couponName);

    // Categorize coupons
    const categorizedCoupons = {
      available: [],
      used: [],
      expired: [],
    };

    allCoupons.forEach((coupon) => {
      // Skip referral coupons that aren't for this user
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

    // Apply pagination
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

const applyCoupon = async (req, res) => {
  try {
    const { couponName } = req.body;
    const userId = req.user?.userId;

    // Check authentication
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.ERROR.AUTHENTICATION_REQUIRED,
      });
    }

    // Get user's cart
    const cart = await Cart.findOne({ userId });

    // Validate cart
    if (!cart || !cart.items.length) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Your cart is empty",
      });
    }

    let totalPrice = 0;
    cart.items.forEach((item) => (totalPrice += item.totalPrice));

    const coupon = await Coupon.findOne({
      name: couponName,
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
      userId,
      couponApplied: true,
      couponName,
    });

    if (hasUsed) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: MESSAGES.COUPON.ALREADY_USED,
      });
    }

    const discountAmount = coupon.offerPrice;
    const finalAmount = cart.totalPrice - discountAmount;

    // try {
    //   await sessionUpdate(req.sessionID, (session) => {
    if (!session.cart) {
      session.cart = {};
    }

    session.cart.couponApplied = true;
    session.cart.couponName = couponName;
    session.cart.discount = discountAmount;
    session.cart.finalAmount = cart.totalPrice - discountAmount;
    // });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.COUPON.APPLIED,
      discount: discountAmount,
      finalAmount,
      coupon: {
        name: couponName,
        offerPrice: discountAmount,
      },
    });
    // } catch (sessionError) {
    //   console.error("Session update error:", sessionError);
    //   return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    //     success: false,
    //     message: "Failed to apply coupon. Please try again.",
    //   });
    // }
  } catch (error) {
    console.error("Error applying coupon:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
    });
  }
};

const removeCoupon = async (req, res) => {
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

    try {
      await sessionUpdate(req.sessionID, (session) => {
        session.cart.couponApplied = false;
        delete session.cart.couponName;
        delete session.cart.discount;
        session.cart.finalAmount = session.cart.totalPrice;
      });

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Coupon removed successfully",
        totalPrice: req.session.cart.totalPrice,
      });
    } catch (sessionError) {
      console.error("Session update error:", sessionError);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to remove coupon. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error removing coupon:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
    });
  }
};

async function sessionUpdate(sessionID, updateFunction) {
  const sessionKey = `sess:${sessionID}`;

  try {
    const sessionData = await new Promise((resolve, reject) => {
      redisClient.get(sessionKey, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    if (!sessionData) {
      throw new Error("Session not found");
    }

    const session = JSON.parse(sessionData);
    updateFunction(session);

    return new Promise((resolve, reject) => {
      const multi = redisClient.multi();
      multi.set(sessionKey, JSON.stringify(session));
      multi.expire(sessionKey, 86400); // Reset

      multi.exec((err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  } catch (error) {
    console.error("Session update error:", error);
    throw error;
  }
}

module.exports = {
  getMyCoupons,
  applyCoupon,
  removeCoupon,
};
