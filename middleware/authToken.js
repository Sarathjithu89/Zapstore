const jwt = require("jsonwebtoken");
const dotenv = require("dotenv").config();
const User = require("../models/User.js");

const authToken = async (req, res, next) => {
  try {
    const token = req.cookies.token ? req.cookies.token : null;

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

      const user = await User.findOne({
        _id: decoded.userId,
        is_blocked: false,
      });

      if (user) {
        req.user = decoded;
        return next();
      } else {
        req.flash("error", "User is blocked or doesn't exist");
        res.clearCookie("token");
        return next();
      }
    } catch (error) {
      console.log("Token error:", error.name);

      if (error.name === "TokenExpiredError") {
        req.flash("error", "Your session has expired. Please log in again.");
      } else {
        req.flash("error", "Authentication error");
      }

      res.clearCookie("token");
      return next();
    }
  } catch (error) {
    console.log("Authentication Error", error);
    res.clearCookie("token");
    return next();
  }
};

module.exports = { authToken };
