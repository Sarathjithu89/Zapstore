const MESSAGES = {
  SUCCESS: {
    // Authentication
    LOGIN: "Login successful",
    LOGOUT: "You have been logged out successfully",
    REGISTRATION: "Registration successful",

    // Password
    PASSWORD_CHANGED: "Password changed successfully",
    PASSWORD_ADDED: "Success! Please Login",
    PASSWORD_RESET: "Password has been reset successfully",

    // OTP
    OTP_VERIFIED: "OTP verified successfully!",
    OTP_SENT: "OTP sent successfully",
    ENTER_NEW_PASSWORD: "Please Enter New Password",

    // Common
    DATA_FETCHED: "Data fetched successfully",
    OPERATION_SUCCESS: "Operation completed successfully",
  },

  ERROR: {
    // Authentication
    USER_NOT_FOUND: "User not found",
    BLOCKED_ACCOUNT: "Your account has been blocked",
    INCORRECT_PASSWORD: "Incorrect password",
    LOGIN_FAILED: "Login failed. Please try again",
    ALREADY_SIGNED_IN: "You are already signed in",
    AUTHENTICATION_REQUIRED: "Please Login to Access this",
    LOGOUT_FAILED: "An error occurred during logout",

    // Authorization
    UNAUTHORIZED_ACCESS: "You are not authorized to perform this action",

    // Session
    SESSION_EXPIRED: "Session expired or invalid request",

    // OTP
    INVALID_OTP: "Invalid OTP, please try again",

    // Email
    EMAIL_NOT_SENT: "Email could not be sent. Please try again",
    EMAIL_REQUIRED: "Email is required",

    // Password
    PASSWORD_MISMATCH: "Passwords do not match",
    PASSWORD_COMPLEXITY: "Password doesn't meet complexity requirements",

    // User
    USER_EXISTS: "User already exists",

    // Product
    PRODUCT_NOT_FOUND: "Product not found",

    // General
    SERVER_ERROR: "Server error",
    SOMETHING_WRONG: "Something went wrong",
    VALIDATION_ERROR: "Validation error. Please check your input",
    INVALID_REQUEST: "Invalid request",
  },

  INFO: {
    ACCOUNT_CREATED: "Your account has been created successfully",
    VERIFICATION_REQUIRED: "Please verify your email to continue",
    PASSWORD_RESET_INSTRUCTIONS:
      "Password reset instructions have been sent to your email",
  },

  WALLET: {
    REFERRAL_REWARD: (name) => `Referral reward for ${name}`,
    RECHARGE_SUCCESS: "Wallet recharged successfully",
    WITHDRAWAL_SUCCESS: "Withdrawal successful",
    INSUFFICIENT_BALANCE: "Insufficient balance in wallet",
  },

  PRODUCT: {
    ADDED_TO_CART: "Product added to cart successfully",
    REMOVED_FROM_CART: "Product removed from cart",
    OUT_OF_STOCK: "Product is out of stock",
  },

  ORDER: {
    PLACED: "Order placed successfully",
    CANCELLED: "Order cancelled successfully",
    DELIVERED: "Order delivered successfully",
    SHIPPED: "Order has been shipped",
  },

  COUPON: {
    APPLIED: "Coupon applied successfully",
    INVALID: "Invalid coupon code",
    EXPIRED: "Coupon has expired",
    ALREADY_USED: "You have already used this coupon",
  },
};

module.exports = MESSAGES;
