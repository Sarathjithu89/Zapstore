const express = require("express");
const userRouter = express.Router();
const profileController = require("../controllers/user/profileController.js");
const userController = require("../controllers/user/userController");
const checkoutController = require("../controllers/user/checkoutController.js");
const cartController = require("../controllers/user/cartController.js");
const orderController = require("../controllers/user/orderController.js");
const walletController = require("../controllers/user/walletController.js");
const couponController = require("../controllers/user/couponController.js");
const passport = require("passport");
const { authToken } = require("../middleware/authToken");
const { json } = require("body-parser");
const { profileImageUpload } = require("../uility/multer.js");
const wishlistController = require("../controllers/user/wishlistController.js");

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
userRouter.get("/userProfile", authToken, profileController.getUserProfile);
userRouter.post(
  "/uploadProfileImage",
  authToken,
  profileImageUpload.single("profileImage"),
  profileController.uploadProfileImage
);
userRouter.post(
  "/removeProfileImage",
  authToken,
  profileController.removeProfileImage
);
userRouter.post("/profileUpdate", authToken, profileController.profileUpdate);
userRouter.post(
  "/changePasswordProfile",
  authToken,
  profileController.changePasswordProfile
);
userRouter.get(
  "/forgotPasswordLogout",
  authToken,
  profileController.forgotPasswordLogout
);
userRouter.get(
  "/change-email",
  authToken,
  profileController.renderChangeEmailPage
);
userRouter.post(
  "/sendEmailVerification",
  authToken,
  profileController.sendEmailVerification
);

userRouter.post("/updateEmail", authToken, profileController.updateEmail);

//address routes
userRouter.get("/address", authToken, profileController.getUserAddress);
userRouter.post("/save-address", authToken, profileController.saveAddress);
userRouter.post(
  "/setDefaultAddress",
  authToken,
  profileController.setDefaultAddress
);
userRouter.post("/deleteAddress", authToken, profileController.deleteAddress);

//cart
userRouter.get("/cart", authToken, cartController.viewCart);
userRouter.post("/cart/add", authToken, cartController.addToCart);
userRouter.post("/changeQuantity", authToken, cartController.changeQuantity);
userRouter.get("/deleteItem", authToken, cartController.deleteItem);

//checkout
userRouter.get("/checkout", authToken, checkoutController.getCheckoutPage);
userRouter.get("/checkStock", authToken, checkoutController.checkStock);
userRouter.post("/placeOrder", authToken, checkoutController.placeOrder);
userRouter.post("/palceWalletOrder", authToken, checkoutController.WalletOrder);
userRouter.post(
  "/razorpay-order",
  authToken,
  checkoutController.razorpayPayment
);
userRouter.post(
  "/verify-razorpay-payment",
  authToken,
  checkoutController.verifyRazorpayPayment
);

//orders
userRouter.get("/orders", authToken, orderController.getUserOrders);
userRouter.post("/cancelOrder", authToken, orderController.cancelOrder);
userRouter.get("/invoice/:orderId", authToken, orderController.generateInvoice);
userRouter.post("/requestReturn", authToken, orderController.requestReturn);
userRouter.get("/order/:id", authToken, orderController.getOrderDetails);
userRouter.get("/ordersuccess", authToken, orderController.orderSuccess);

//wallet
userRouter.get("/wallet", authToken, walletController.getWallet);
userRouter.post("/addToWallet", authToken, walletController.addMoney);
userRouter.get("/payment", authToken, walletController.getPaymentPage);
userRouter.post("/verify-payment", authToken, walletController.verifyPayment);
userRouter.post("/withdraw", authToken, walletController.withdrawMoney);
userRouter.post("/refund", authToken, walletController.refundToWallet);

//wishlist

userRouter.get("/wishlist", authToken, wishlistController.getWishlist);
userRouter.post("/addtowishlisht", authToken, wishlistController.addToWishlist);
userRouter.post(
  "/removeFromWishlist",
  authToken,
  wishlistController.removeFromWishlist
);

//coupons
userRouter.get("/mycoupons", authToken, couponController.getMyCoupons);
userRouter.post("/apply-coupon", authToken, couponController.applyCoupon);
userRouter.post("/remove-coupon", authToken, couponController.removeCoupon);

module.exports = userRouter;
