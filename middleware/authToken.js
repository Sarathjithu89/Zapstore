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
    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decoded) => {
      if (err) {
        console.log("Token verification error:", err.message);
        res.clearCookie("token");
        return res.render("home.ejs");
      }

      try {
        const user = await User.findById(decoded.userId);

        if (!user) {
          // User no longer exists
          res.clearCookie("token");
          return res.redirect("/login", { message: "User account not found" });
        }

        if (user.isBlocked) {
          // Clear token and logout user if blocked
          res.clearCookie("token");

          // Option 1: Render home page with blocked message
          return res.render("home.ejs", {
            message: "Your account has been blocked. Please contact support.",
          });

          // Option 2: Redirect to a specific logout route
          // return res.redirect("/logout?reason=blocked");
        }

        // User is not blocked, proceed
        req.user = decoded; // Store user info in req
        next();
      } catch (findError) {
        console.error("User lookup error:", findError);
        res.status(500).json({ message: "Server Error" });
      }
    });
  } catch (error) {
    console.error("Authentication Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = { authenticateToken };
