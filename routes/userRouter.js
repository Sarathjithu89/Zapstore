const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const { authToken } = require("../middleware/authToken");
const { json } = require("body-parser");

router.get("/pageNotFound", userController.pageNotFound);
//user login
router.get("/", authToken, userController.loadHomepage);
router.get("/login", authToken, userController.loadLogin);
router.post("/login", authToken, userController.login);
//register routes
router.get("/register", userController.loadRegister);
router.post("/register", userController.register);
router.get("/verify-otp", userController.loadOtpVerification);
router.post("/verify-otp", userController.otpVerification);
router.post("/resend-otp", userController.resendOtp);
//user logout
router.get("/logout", userController.logout);
//reset password routes
router.get("/forgotPassword", userController.loadforgotPassword);
router.get("/resetPassword", userController.loadResetPassword);
router.post("/forgotPassword", userController.forgotPassword);
router.post("/verifyForgotOtp", userController.verifyForgotOtp);
router.post("/resetPassword", userController.changePassword);
router.post("/resetPassword", userController.resetPassword);
//checkout page
router.get("/checkout", authToken, userController.checkoutPage);

//google signin routes
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/register",
  }),userController.googleCallback
  
);
//for adding new password in Google sign in
router.get("/addpassword",userController.getAddPassword);
router.post("/addpassword", userController.addPassword);

//product routes
router.get("/product", authToken, userController.getSingleProduct);
router.get("/shop", authToken, userController.getCategoryPage);
router.get("/category", authToken, userController.getCategoryPage);

module.exports = router;
