const env = require("dotenv").config();
const User = require("../models/User.js");
const jwt = require("jsonwebtoken");

const adminAuth = async (req, res, next) => {
  try {
    const tokenkey = req.cookies.tokenkey ? req.cookies.tokenkey : null;

    if (!tokenkey) {
      return next();
    }
    try {
      const decoded = jwt.verify(tokenkey, process.env.JWT_ADMIN_SECRET_KEY);
      const admin = await User.findOne({ _id: decoded._id, isAdmin: true });
      if (admin) {
        req.admin = decoded;
        return next();
      } else {
        req.flash("error", "Not a Admin or account doesn't exist");
        res.clearCookie("tokenkey");
        return next();
      }
    } catch (error) {
      console.log("Token verification Error", error);

      if (error.name === "TokenExpiredError") {
        req.flash("error", "Your session has expired. Please log in again.");
      } else {
        req.flash("error", "Authentication error");
      }

      res.clearCookie("tokenkey");
      return next();
    }
  } catch (error) {
    console.log("Autentication Error", error);
    res.clearCookie("tokenkey");
    return next();
  }
};

module.exports = { adminAuth };
