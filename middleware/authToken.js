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

// const authToken = async (req, res, next) => {
//   try {
//     const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       res.clearCookie("token");
//       return res.redirect("/login"); // Redirect to login page instead of "/"
//     }

//     let decoded;
//     try {
//       decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
//     } catch (err) {
//       console.error("Token verification failed:", err.message);
//       res.clearCookie("token");
//       return res.redirect("/login"); // Redirect properly
//     }

//     const user = await User.findOne({ _id: decoded.userId, is_blocked: false });

//     if (!user) {
//       req.flash("error", "User is Blocked");
//       res.clearCookie("token");
//       return res.redirect("/login"); // Avoid infinite redirect loop
//     }

//     req.user = decoded; // Store user info in request
//     next();
//   } catch (error) {
//     console.error("Authentication Error:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

module.exports = { authToken };
