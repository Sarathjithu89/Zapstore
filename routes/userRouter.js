const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");

//user routes
router.get("/", userController.loadHomepage);
router.get("/login", userController.loadLogin);
router.get("/register", userController.loadRegister);
router.get("/pageNotFound", userController.pageNotFound);
router.post("/register", userController.register);
router.get("/verify-otp", userController.loadOtpVerification);
router.post("/verify-otp", userController.otpVerification);
router.post("/resend-otp", userController.resendOtp);
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/register" }),
  (req, res) => {
    res.redirect("/");
  }
);

module.exports = router;
