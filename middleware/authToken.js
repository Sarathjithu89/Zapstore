const jwt = require("jsonwebtoken");
const dotenv = require("dotenv").config();
const User = require("../models/User.js");

const authToken = async (req, res, next) => {
  try {
    const token = req.cookies.token ? req.cookies.token : null;
    if (token) {
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (error) {
        console.log(error);
        res.clearCookie("token");
        next();
      }
      const user = await User.findOne({
        _id: decoded.userId,
        is_blocked: false,
      });
      if (user) {
        req.user = decoded;
        next();
      } else {
        req.flash("error", "User is Blocked");
        res.clearCookie("token");
        next();
      }
    } else {
      next();
    }
  } catch (error) {
    console.log("Authentication Error", error);
    next();
  }
};

module.exports = { authToken };
