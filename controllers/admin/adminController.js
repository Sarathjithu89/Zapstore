const User = require("../../models/User");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createAdminJwtToken } = require("../../config/jwt.js");
const HTTP_STATUS = require("../../config/statusCodes.js");
const MESSAGES = require("../../config/adminMessages.js");

// Load admin login
const loadLogin = async (req, res) => {
  if (req.admin) {
    return res.redirect("admin/dashboard");
  }
  return res.render("admin-login.ejs", { message: null });
};

// Login check
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email: email, isAdmin: true });

    if (!admin) {
      req.flash("error", MESSAGES.ERROR.LOGIN_FAILED);
      return res.status(HTTP_STATUS.UNAUTHORIZED).redirect("/admin");
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (passwordMatch) {
      // Create JWT token
      const payLoad = {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
      };
      const tokenkey = createAdminJwtToken(payLoad);

      res.cookie("tokenkey", tokenkey, { httpOnly: true, secure: true });

      req.flash("success", MESSAGES.SUCCESS.LOGIN);
      return res.status(HTTP_STATUS.OK).redirect("/admin/dashboard");
    } else {
      req.flash("error", MESSAGES.ERROR.LOGIN_FAILED);
      return res.status(HTTP_STATUS.UNAUTHORIZED).redirect("/admin");
    }
  } catch (error) {
    console.log("Login Error", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .redirect("admin/pageerror");
  }
};

// Load Dashboard
const loadDashboard = async (req, res) => {
  if (req.admin) {
    try {
      const admin = await req.admin;
      return res.status(HTTP_STATUS.OK).render("dashboard.ejs", {
        admin,
        message: MESSAGES.INFO.DASHBOARD_ACCESS,
      });
    } catch (error) {
      console.log(error);
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .redirect("admin/pageerror");
    }
  } else {
    req.flash("error", MESSAGES.ERROR.SESSION_EXPIRED);
    return res.status(HTTP_STATUS.UNAUTHORIZED).redirect("/admin");
  }
};

// Logout
const adminLogout = async (req, res) => {
  try {
    req.flash("success", MESSAGES.SUCCESS.LOGOUT);
    res.clearCookie("tokenkey");
    return res.status(HTTP_STATUS.OK).redirect("/admin");
  } catch (error) {
    console.log("Unexpected error during logout", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .redirect("admin/pageerror");
  }
};

// Page Error
const pageError = async (req, res) => {
  return res.status(HTTP_STATUS.NOT_FOUND).render("pageerror.ejs", {
    message: MESSAGES.INFO.PAGE_NOT_FOUND,
  });
};

module.exports = {
  loadLogin,
  adminLogin,
  adminLogout,
  loadDashboard,
  pageError,
};
