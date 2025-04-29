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
const { profileImageUpload } = require("../uility/multer.js");
const wishlistController = require("../controllers/user/wishlistController.js");

//user login
userRouter.get("/pageNotFound", userController.pageNotFound);
userRouter.get("/", authToken, userController.loadHomepage);
userRouter.get("/login", authToken, userController.loadLogin);
userRouter.post("/login", authToken, userController.login);

//register routes
userRouter.get("/register", userController.loadRegister);
userRouter.post("/register", userController.register);
userRouter.get("/verify-otp", userController.loadOtpVerification);
userRouter.post("/verify-otp", userController.otpVerification);
userRouter.post("/auth/otp/resend", userController.resendOtp);

//user logout
userRouter.post("/logout", userController.logout);

//reset password routes
userRouter.get("/auth/password/forgot", userController.loadforgotPassword);
userRouter.get("/resetPassword", userController.loadResetPassword);
userRouter.post("/auth/password/forgot", userController.forgotPassword);
userRouter.post("/auth/otp/verify", userController.verifyForgotOtp);
userRouter.post("/resetPassword", userController.changePassword);

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
userRouter.get("/products", authToken, userController.getCategoryPage);
userRouter.get("/products/:id", authToken, userController.getSingleProduct);
userRouter.get(
  "/categories/:id/products",
  authToken,
  userController.getCategoryPage
);

//profile routes
userRouter.get("/users/profile", authToken, profileController.getUserProfile);
userRouter.post(
  "/user/profile/image",
  authToken,
  profileImageUpload.single("profileImage"),
  profileController.uploadProfileImage
);
userRouter.delete(
  "/user/profile/image",
  authToken,
  profileController.removeProfileImage
);
userRouter.patch("/profileUpdate", authToken, profileController.profileUpdate);
userRouter.patch(
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
userRouter.patch("/updateEmail", authToken, profileController.updateEmail);

//address routes
userRouter.get("/users/addresses", authToken, profileController.getUserAddress);
userRouter.post("/users/addresses", authToken, profileController.saveAddress);
userRouter.patch(
  "/users/addresses/:id/default",
  authToken,
  profileController.setDefaultAddress
);
userRouter.delete(
  "/users/addresses/:id",
  authToken,
  profileController.deleteAddress
);

//cart
userRouter.get("/cart", authToken, cartController.viewCart);
userRouter.post("/cart/add", authToken, cartController.addToCart);
userRouter.patch("/changeQuantity", authToken, cartController.changeQuantity);
userRouter.delete("/deleteItem", authToken, cartController.deleteItem);

//checkout
userRouter.get("/checkout", authToken, checkoutController.getCheckoutPage);
userRouter.get("/checkStock", authToken, checkoutController.checkStock);
userRouter.post("/placeOrder", authToken, checkoutController.placeOrder);
userRouter.post(
  "/checkout/wallet-order",
  authToken,
  checkoutController.WalletOrder
);
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
userRouter.get("/user/orders", authToken, orderController.getUserOrders);
userRouter.patch("/orders/:id/cancel", authToken, orderController.cancelOrder);
userRouter.get(
  "/orders/:id/invoice",
  authToken,
  orderController.generateInvoice
);
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
userRouter.get("/user/wishlist", authToken, wishlistController.getWishlist);
userRouter.post("/user/wishlist", authToken, wishlistController.addToWishlist);
userRouter.delete(
  "/user/wishlist/:id",
  authToken,
  wishlistController.removeFromWishlist
);

//coupons
userRouter.get("/users/mycoupons", authToken, couponController.getMyCoupons);
userRouter.post("/apply-coupon", authToken, couponController.applyCoupon);
userRouter.delete("/checkout/coupon", authToken, couponController.removeCoupon);

module.exports = userRouter;
