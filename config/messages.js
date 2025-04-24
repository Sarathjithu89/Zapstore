const MESSAGES = {
  AUTH: {
    LOGIN_SUCCESS: "Login successful.",
    LOGIN_FAILED: "Invalid email or password.",
    UNAUTHORIZED: "You are not authorized to perform this action.",
  },
  PRODUCT: {
    NOT_FOUND: "Product not found.",
    OUT_OF_STOCK: "This product is currently out of stock.",
    ADD_SUCCESS: "Product added successfully.",
  },
  ORDER: {
    CREATED: "Order has been placed.",
    FAILED: "Order could not be completed.",
  },
  GENERAL: {
    SERVER_ERROR: "Something went wrong. Please try again later.",
    INVALID_INPUT: "Provided input is not valid.",
  },
};

module.exports = MESSAGES;
