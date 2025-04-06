const User = require("../../models/User");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

//load admin login
const loadLogin = async (req, res) => {
  if (req.session.admin) {
    return res.redirect("/dashboard");
  }
  return res.render("admin-login.ejs", { message: null });
};

//login check
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email: email, isAdmin: true });

    if (!admin) {
      req.flash("error", "Please Enter Valid Admin Email");
      return res.redirect("/admin");
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (passwordMatch) {
      req.session.admin = { name: admin.name, email: admin.email };
      req.flash("success", "Login successful");
      return res.redirect("/admin/dashboard");
    } else {
      req.flash("error", "Incorrect password");
      return res.redirect("/admin");
    }
  } catch (error) {
    console.log("Login Error", error);
    return res.redirect("/pageerror");
  }
};

//load Dashboard
const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      const admin = await req.session.admin;
      return res.render("dashboard.ejs", { admin });
    } catch (error) {
      console.log(error);
      res.redirect("/pageerror");
    }
  } else {
    return res.redirect("/admin");
  }
};
//Logout
const adminLogout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destoring session", err);
        return res.redirect("/pageerror");
      }
    });

    return res.redirect("/admin");
  } catch (error) {
    console.log("unexpected error during logout", error);
    res.redirect("/pageerror");
  }
};
//page Error
const pageError = async (req, res) => {
  res.render("pageerror.ejs");
};

module.exports = {
  loadLogin,
  adminLogin,
  adminLogout,
  loadDashboard,
  pageError,
};
