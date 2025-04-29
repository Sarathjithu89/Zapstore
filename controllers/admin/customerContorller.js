const User = require("../../models/User");
const HTTP_STATUS = require("../../config/statusCodes.js");
const MESSAGES = require("../../config/adminMessages.js");

//Render customer info
const customerInfo = async (req, res) => {
  try {
    const admin = req.admin;

    if (!admin) {
      req.flash("error", MESSAGES.ERROR.SESSION_EXPIRED);
      return res.redirect("/admin");
    }
    let search = "";
    if (req.query.search) {
      search = req.query.search.trim();
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const searchQuery = {
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    };

    const userData = await User.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments(searchQuery);

    if (userData.length === 0 && search) {
      req.flash("info", MESSAGES.INFO.NO_CUSTOMERS);
    }

    res.render("userlisting.ejs", {
      admin: admin,
      data: userData,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      searchQuery: search,
    });
  } catch (error) {
    console.error("Customer info error:", error);
    req.flash("error", MESSAGES.ERROR.CUSTOMER_ACTION_FAILED);
    res.redirect("/admin/dashboard");
  }
};

// Block customer
const customerBlocked = async (req, res) => {
  try {
    const userId = req.query.userid;

    if (!userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: MESSAGES.ERROR.CUSTOMER_NOT_FOUND,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: false,
        message: MESSAGES.ERROR.CUSTOMER_NOT_FOUND,
      });
    }

    await User.updateOne({ _id: userId }, { $set: { is_blocked: true } });

    return res.status(HTTP_STATUS.OK).json({
      status: true,
      message: MESSAGES.SUCCESS.CUSTOMER_BLOCKED,
    });
  } catch (error) {
    console.error("Customer block error:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: MESSAGES.ERROR.CUSTOMER_ACTION_FAILED,
    });
  }
};

//Unblock customer
const customerUnblocked = async (req, res) => {
  try {
    const userId = req.query.userid;

    if (!userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: MESSAGES.ERROR.CUSTOMER_NOT_FOUND,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: false,
        message: MESSAGES.ERROR.CUSTOMER_NOT_FOUND,
      });
    }

    await User.updateOne({ _id: userId }, { $set: { is_blocked: false } });

    return res.status(HTTP_STATUS.OK).json({
      status: true,
      message: MESSAGES.SUCCESS.CUSTOMER_UNBLOCKED,
    });
  } catch (error) {
    console.error("Customer unblock error:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: MESSAGES.ERROR.CUSTOMER_ACTION_FAILED,
    });
  }
};

module.exports = {
  customerInfo,
  customerBlocked,
  customerUnblocked,
};
