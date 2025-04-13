const Coupon = require("../../models/Coupon.js");
const User = require("../../models/User.js");

//get coupons
const getCoupons = async (req, res) => {
  try {
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

    res.render("admin/couponsMangment.ejs", {
      coupons,
      currentPage: page,
      totalPages,
      totalItems: totalCoupons,
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    req.flash("error", "Failed to load coupons");
    res.redirect("/admin/dashboard.ejs");
  }
};

//Add coupon
const addCoupon = async (req, res) => {
  try {
    const { name, offerPrice, minimumPrice, expireOn } = req.body;
    const existingCoupon = await Coupon.findOne({ name });
    if (existingCoupon) {
      req.flash("error", "A coupon with this name already exists");
      return res.redirect("/admin/coupons.ejs");
    }
    const newCoupon = new Coupon({
      name,
      offerPrice,
      minimumPrice,
      expireOn,
      isListed: true,
    });

    await newCoupon.save();

    req.flash("success", "Coupon added successfully");
    res.redirect("/admin/coupons.ejs");
  } catch (error) {
    console.error("Error adding coupon:", error);
    req.flash("error", "Failed to add coupon");
    res.redirect("/admin/coupons.ejs");
  }
};

//Edit coupon
const editCoupon = async (req, res) => {
  try {
    const { couponId, name, offerPrice, minimumPrice, expireOn } = req.body;
    const existingCoupon = await Coupon.findOne({
      name,
      _id: { $ne: couponId },
    });

    if (existingCoupon) {
      req.flash("error", "Another coupon with this name already exists");
      return res.redirect("/admin/coupons.ejs");
    }
    await Coupon.findByIdAndUpdate(couponId, {
      name,
      offerPrice,
      minimumPrice,
      expireOn,
    });

    req.flash("success", "Coupon updated successfully");
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Error updating coupon:", error);
    req.flash("error", "Failed to update coupon");
    res.redirect("/admin/coupons.ejs");
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const couponId = req.query.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      req.flash("error", "Coupon not found");
      return res.redirect("/admin/coupons.ejs");
    }

    coupon.isListed = !coupon.isListed;
    await coupon.save();

    const statusMessage = coupon.isListed ? "activated" : "deactivated";
    req.flash("success", `Coupon ${statusMessage} successfully`);
    res.redirect("/admin/coupons.ejs");
  } catch (error) {
    console.error("Error toggling coupon status:", error);
    req.flash("error", "Failed to update coupon status");
    res.redirect("/admin/coupons.ejs");
  }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    await Coupon.findByIdAndDelete(couponId);

    req.flash("success", "Coupon deleted successfully");
    res.redirect("/admin/coupons.ejs");
  } catch (error) {
    console.error("Error deleting coupon:", error);
    req.flash("error", "Failed to delete coupon");
    res.redirect("/admin/coupons.ejs");
  }
};

//users who used a coupon
const getCouponUsers = async (req, res) => {
  try {
    const couponId = req.params.id;

    const coupon = await Coupon.findById(couponId).populate("UserId");

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }
    //maping the users
    const users = coupon.UserId.map((user) => {
      return {
        _id: user._id,
        name: user.name || "User",
        email: user.email || "No email",
        usedOn: user.updatedAt || new Date(),
      };
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error("Error getting coupon users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get coupon users",
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
