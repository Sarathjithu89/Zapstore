const Coupon = require("../../models/Coupon");
const User = require("../../models/User"); // Assuming you have a User model

// Get all coupons with pagination and search
const getCoupons = async (req, res) => {
  try {
    const admin = req.session.admin;
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    // Find coupons based on search criteria
    const coupons = await Coupon.find({
      name: { $regex: new RegExp(".*" + search + ".*", "i") },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    // Count total coupons for pagination
    const count = await Coupon.find({
      name: { $regex: new RegExp(".*" + search + ".*", "i") },
    }).countDocuments();

    // Format coupon data for display in the template
    const formattedCoupons = coupons.map((coupon) => {
      const isExpired = new Date(coupon.expireOn) < new Date();
      return {
        _id: coupon._id,
        code: coupon.name,
        description: `Discount coupon with minimum purchase of ₹${coupon.minimumPrice}`,
        discountType: "fixed",
        discountValue: coupon.offerPrice,
        minPurchase: coupon.minimumPrice,
        maxDiscount: null,
        usageLimit: null,
        expiryDate: coupon.expireOn,
        isActive: coupon.isList && !isExpired,
        usedCount: coupon.UserId.length,
      };
    });

    res.render("coupons.ejs", {
      coupons: formattedCoupons,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      admin: admin,
    });
  } catch (error) {
    console.log("Get coupons error", error);
    return res.redirect("/admin/pageerror");
  }
};

// Render add coupon page
const getAddCouponPage = async (req, res) => {
  try {
    const admin = req.session.admin;
    res.render("addCoupon.ejs", { admin });
  } catch (error) {
    console.log("Get add coupon page error", error);
    return res.redirect("/admin/pageerror");
  }
};

// Add new coupon
const addCoupon = async (req, res) => {
  try {
    const { name, expireOn, offerPrice, minimumPrice } = req.body;

    // Validate coupon data
    if (!name || !expireOn || !offerPrice || !minimumPrice) {
      req.session.message = {
        type: "error",
        message: "All fields are required",
      };
      return res.redirect("/admin/addCoupon");
    }

    // Check if coupon name already exists
    const existingCoupon = await Coupon.findOne({
      name: { $regex: new RegExp("^" + name + "$", "i") },
    });
    if (existingCoupon) {
      req.session.message = {
        type: "error",
        message: "Coupon code already exists",
      };
      return res.redirect("/admin/addCoupon");
    }

    // Validate expiry date
    const expireDate = new Date(expireOn);
    if (expireDate <= new Date()) {
      req.session.message = {
        type: "error",
        message: "Expiry date must be in the future",
      };
      return res.redirect("/admin/addCoupon");
    }

    // Create new coupon
    const newCoupon = new Coupon({
      name: name.toUpperCase().trim(),
      expireOn: expireDate,
      offerPrice: Number(offerPrice),
      minimumPrice: Number(minimumPrice),
      isList: true,
      UserId: [],
    });

    await newCoupon.save();

    req.session.message = {
      type: "success",
      message: "Coupon added successfully",
    };
    res.redirect("/admin/coupons");
  } catch (error) {
    console.log("Add coupon error", error);
    req.session.message = {
      type: "error",
      message: "Failed to add coupon",
    };
    return res.redirect("/admin/addCoupon");
  }
};

// Render edit coupon page
const getEditCouponPage = async (req, res) => {
  try {
    const admin = req.session.admin;
    const couponId = req.params.id;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      req.session.message = {
        type: "error",
        message: "Coupon not found",
      };
      return res.redirect("/admin/coupons");
    }

    res.render("admin/editCoupon", { admin, coupon });
  } catch (error) {
    console.log("Get edit coupon page error", error);
    return res.redirect("/admin/pageerror");
  }
};

// Update coupon
const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const { name, expireOn, offerPrice, minimumPrice } = req.body;

    // Validate coupon data
    if (!name || !expireOn || !offerPrice || !minimumPrice) {
      req.session.message = {
        type: "error",
        message: "All fields are required",
      };
      return res.redirect(`/admin/editCoupon/${couponId}`);
    }

    // Check if coupon name already exists (excluding current coupon)
    const existingCoupon = await Coupon.findOne({
      name: { $regex: new RegExp("^" + name + "$", "i") },
      _id: { $ne: couponId },
    });

    if (existingCoupon) {
      req.session.message = {
        type: "error",
        message: "Coupon code already exists",
      };
      return res.redirect(`/admin/editCoupon/${couponId}`);
    }

    // Update coupon
    await Coupon.findByIdAndUpdate(couponId, {
      name: name.toUpperCase().trim(),
      expireOn: new Date(expireOn),
      offerPrice: Number(offerPrice),
      minimumPrice: Number(minimumPrice),
    });

    req.session.message = {
      type: "success",
      message: "Coupon updated successfully",
    };
    res.redirect("/admin/coupons");
  } catch (error) {
    console.log("Update coupon error", error);
    req.session.message = {
      type: "error",
      message: "Failed to update coupon",
    };
    return res.redirect(`/admin/editCoupon/${req.params.id}`);
  }
};

// Toggle coupon listing status (activate/deactivate)
const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId, active } = req.body;

    const isActive = active === "true" || active === true;

    await Coupon.findByIdAndUpdate(couponId, {
      isList: isActive,
    });

    return res.json({
      status: true,
      message: `Coupon ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.log("Toggle coupon status error", error);
    return res.json({
      status: false,
      message: "Failed to update coupon status",
    });
  }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    await Coupon.findByIdAndDelete(couponId);

    return res.json({
      status: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.log("Delete coupon error", error);
    return res.json({
      status: false,
      message: "Failed to delete coupon",
    });
  }
};

// Validate coupon (for checkout process)
const validateCoupon = async (req, res) => {
  try {
    const { couponCode, total, userId } = req.body;

    if (!couponCode || !total || !userId) {
      return res.json({
        status: false,
        message: "Invalid request parameters",
      });
    }

    // Find coupon (case insensitive)
    const coupon = await Coupon.findOne({
      name: { $regex: new RegExp("^" + couponCode + "$", "i") },
      isList: true,
      expireOn: { $gt: new Date() },
    });

    if (!coupon) {
      return res.json({
        status: false,
        message: "Invalid or expired coupon code",
      });
    }

    // Check if user has already used this coupon
    if (coupon.UserId.includes(userId)) {
      return res.json({
        status: false,
        message: "You have already used this coupon",
      });
    }

    // Check minimum purchase requirement
    if (total < coupon.minimumPrice) {
      return res.json({
        status: false,
        message: `Minimum purchase of ₹${coupon.minimumPrice.toLocaleString()} required for this coupon`,
      });
    }

    return res.json({
      status: true,
      coupon: {
        id: coupon._id,
        code: coupon.name,
        discountValue: coupon.offerPrice,
        minPurchase: coupon.minimumPrice,
      },
    });
  } catch (error) {
    console.log("Validate coupon error", error);
    return res.json({
      status: false,
      message: "Failed to validate coupon",
    });
  }
};

// Apply coupon to user when order is placed
const applyCoupon = async (userId, couponCode) => {
  try {
    if (!userId || !couponCode) return false;

    const result = await Coupon.updateOne(
      { name: { $regex: new RegExp("^" + couponCode + "$", "i") } },
      { $addToSet: { UserId: userId } }
    );

    return result.modifiedCount > 0;
  } catch (error) {
    console.log("Apply coupon error", error);
    return false;
  }
};

module.exports = {
  getCoupons,
  getAddCouponPage,
  addCoupon,
  getEditCouponPage,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
};
