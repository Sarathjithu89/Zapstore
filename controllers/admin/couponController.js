const Coupon = require("../../models/Coupon.js");
const User = require("../../models/User.js");
const HTTP_STATUS = require("../../config/statusCodes.js");
const MESSAGES = require("../../config/adminMessages.js");

//Get all coupons
const getCoupons = async (req, res) => {
  try {
    const admin = req.admin;
    if (!admin) {
      req.flash("error", MESSAGES.ERROR.SESSION_EXPIRED);
      return res.redirect("/admin");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const searchQuery = req.query.search
      ? { name: { $regex: req.query.search, $options: "i" } }
      : {};

    const coupons = await Coupon.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCoupons = await Coupon.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCoupons / limit);

    if (coupons.length === 0 && !req.query.search) {
      req.flash("info", MESSAGES.INFO.NO_COUPONS);
    }

    res.status(HTTP_STATUS.OK).render("admin/couponsMangment.ejs", {
      coupons,
      currentPage: page,
      totalPages,
      totalItems: totalCoupons,
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    req.flash("error", MESSAGES.ERROR.COUPON_NOT_FOUND);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/dashboard");
  }
};

//Add coupon
const addCoupon = async (req, res) => {
  try {
    const { name, offerPrice, minimumPrice, expireOn } = req.body;

    const existingCoupon = await Coupon.findOne({ name });
    if (existingCoupon) {
      req.flash("error", MESSAGES.ERROR.COUPON_EXISTS);
      return res.status(HTTP_STATUS.CONFLICT).redirect("/admin/coupons");
    }

    const newCoupon = new Coupon({
      name,
      offerPrice,
      minimumPrice,
      expireOn,
      isListed: true,
    });

    await newCoupon.save();

    req.flash("success", MESSAGES.SUCCESS.COUPON_ADDED);
    res.status(HTTP_STATUS.CREATED).redirect("/admin/coupons");
  } catch (error) {
    console.error("Error adding coupon:", error);
    req.flash("error", MESSAGES.ERROR.COUPON_ADD_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/coupons");
  }
};

// Edit  coupon
const editCoupon = async (req, res) => {
  try {
    const { couponId, name, offerPrice, minimumPrice, expireOn } = req.body;
    s;
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      req.flash("error", MESSAGES.ERROR.COUPON_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/coupons");
    }

    const existingCoupon = await Coupon.findOne({
      name,
      _id: { $ne: couponId },
    });

    if (existingCoupon) {
      req.flash("error", MESSAGES.ERROR.COUPON_EXISTS);
      return res.status(HTTP_STATUS.CONFLICT).redirect("/admin/coupons");
    }

    await Coupon.findByIdAndUpdate(couponId, {
      name,
      offerPrice,
      minimumPrice,
      expireOn,
    });

    req.flash("success", MESSAGES.SUCCESS.COUPON_UPDATED);
    res.status(HTTP_STATUS.OK).redirect("/admin/coupons");
  } catch (error) {
    console.error("Error updating coupon:", error);
    req.flash("error", MESSAGES.ERROR.COUPON_UPDATE_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/coupons");
  }
};

// coupon active status
const toggleCouponStatus = async (req, res) => {
  try {
    const couponId = req.query.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      req.flash("error", MESSAGES.ERROR.COUPON_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/coupons");
    }

    coupon.isListed = !coupon.isListed;
    await coupon.save();

    req.flash(
      "success",
      coupon.isListed
        ? MESSAGES.SUCCESS.COUPON_STATUS_UPDATED
        : MESSAGES.SUCCESS.COUPON_STATUS_UPDATED
    );

    res.status(HTTP_STATUS.OK).redirect("/admin/coupons");
  } catch (error) {
    console.error("Error toggling coupon status:", error);
    req.flash("error", MESSAGES.ERROR.COUPON_UPDATE_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/coupons");
  }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      req.flash("error", MESSAGES.ERROR.COUPON_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/coupons");
    }

    await Coupon.findByIdAndDelete(couponId);

    req.flash("success", MESSAGES.SUCCESS.COUPON_DELETED);
    res.status(HTTP_STATUS.OK).redirect("/admin/coupons");
  } catch (error) {
    console.error("Error deleting coupon:", error);
    req.flash("error", MESSAGES.ERROR.COUPON_DELETE_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/coupons");
  }
};

//Get users who have coupon
const getCouponUsers = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId).populate("UserId");

    if (!coupon) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ERROR.COUPON_NOT_FOUND,
      });
    }

    if (!coupon.UserId || coupon.UserId.length === 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: MESSAGES.INFO.NO_COUPON_USERS,
        users: [],
      });
    }

    const users = coupon.UserId.map((user) => {
      return {
        _id: user._id,
        name: user.name || "User",
        email: user.email || "No email",
        usedOn: user.updatedAt || new Date(),
      };
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.COUPON_USERS_FETCHED,
      users,
    });
  } catch (error) {
    console.error("Error getting coupon users:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.COUPON_NOT_FOUND,
    });
  }
};

module.exports = {
  getCoupons,
  addCoupon,
  editCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getCouponUsers,
};
