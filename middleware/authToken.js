const jwt = require("jsonwebtoken");
const dotenv = require("dotenv").config();
const User = require("../models/User.js");

const authenticateToken = (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      console.log("No token found, redirecting to Home");
      return res.render("home.ejs", { message: "please login" }); // Redirect if no token
    }

    // Verify Token
    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
      if (err) {
        console.log("Token verification error:", err.message);
        res.clearCookie("token");
        return res.render("home.ejs");
      }
      req.user = decoded; // Store user info in req
      User.findById({ _id: decoded.userId }).then((data) => {
        if (data && !data.isBlocked) {
          console.log("Token verified:", decoded);
          next();
        } else {
          res.redirect("/", { message: "User is blocked" });
        }
      });
    });
  } catch (error) {
    console.error("Authentication Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = { authenticateToken };
