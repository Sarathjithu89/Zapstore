const express = require("express");
const userRouter = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const { authToken } = require("../middleware/authToken");
const { json } = require("body-parser");
const { profileImageUpload } = require("../uility/multer.js");

userRouter.get("/pageNotFound", userController.pageNotFound);
//user login
userRouter.get("/", authToken, userController.loadHomepage);
userRouter.get("/login", authToken, userController.loadLogin);
userRouter.post("/login", authToken, userController.login);
//register routes
userRouter.get("/register", userController.loadRegister);
userRouter.post("/register", userController.register);
userRouter.get("/verify-otp", userController.loadOtpVerification);
userRouter.post("/verify-otp", userController.otpVerification);
userRouter.post("/resend-otp", userController.resendOtp);
//user logout
userRouter.get("/logout", userController.logout);
//reset password routes
userRouter.get("/forgotPassword", userController.loadforgotPassword);
userRouter.get("/resetPassword", userController.loadResetPassword);
userRouter.post("/forgotPassword", userController.forgotPassword);
userRouter.post("/verifyForgotOtp", userController.verifyForgotOtp);
userRouter.post("/resetPassword", userController.changePassword);
userRouter.post("/resetPassword", userController.resetPassword);
//checkout page
userRouter.get("/checkout", authToken, userController.checkoutPage);

//google signin routes
userRouter.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
userRouter.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/register",
  }),
  userController.googleCallback
);
//for adding new password in Google sign in
userRouter.get("/addpassword", userController.getAddPassword);
userRouter.post("/addpassword", userController.addPassword);

//product routes
userRouter.get("/product", authToken, userController.getSingleProduct);
userRouter.get("/shop", authToken, userController.getCategoryPage);
userRouter.get("/category", authToken, userController.getCategoryPage);

//profile routes
userRouter.get("/userProfile", authToken, userController.getUserProfile);
userRouter.post(
  "/uploadProfileImage",
  authToken,
  profileImageUpload.single("profileImage"),
  userController.uploadProfileImage
);
userRouter.post(
  "/removeProfileImage",
  authToken,
  userController.removeProfileImage
);
userRouter.post("/profileUpdate", authToken, userController.profileUpdate);
userRouter.post(
  "/changePasswordProfile",
  authToken,
  userController.changePasswordProfile
);
userRouter.get(
  "/forgotPasswordLogout",
  authToken,
  userController.forgotPasswordLogout
);

//address routes
userRouter.get("/address", authToken, userController.getUserAddress);
userRouter.post("/save-address", authToken, userController.saveAddress);
userRouter.post(
  "/setDefaultAddress",
  authToken,
  userController.setDefaultAddress
);
userRouter.post("/deleteAddress", authToken, userController.deleteAddress);
module.exports = userRouter;
