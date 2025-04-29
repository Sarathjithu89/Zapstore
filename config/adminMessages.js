const MESSAGES = {
    SUCCESS: {
      // Authentication
      LOGIN: "Admin login successful",
      LOGOUT: "Admin logged out successfully",
      
      // Customer Management
      CUSTOMER_BLOCKED: "Customer blocked successfully",
      CUSTOMER_UNBLOCKED: "Customer unblocked successfully",
      CUSTOMERS_FETCHED: "Customer data fetched successfully",
      
      // Category Management
      CATEGORY_ADDED: "Category added successfully",
      CATEGORY_UPDATED: "Category updated successfully",
      CATEGORY_LISTED: "Category listed successfully",
      CATEGORY_UNLISTED: "Category unlisted successfully",
      CATEGORY_DELETED: "Category deleted successfully",
      CATEGORY_OFFER_ADDED: "Category offer added successfully",
      CATEGORY_OFFER_REMOVED: "Category offer removed successfully",
      
      // Brand Management
      BRAND_ADDED: "Brand added successfully",
      BRAND_BLOCKED: "Brand blocked successfully",
      BRAND_UNBLOCKED: "Brand unblocked successfully",
      BRAND_DELETED: "Brand deleted successfully",
      
      // Product Management
      PRODUCT_ADDED: "Product added successfully",
      PRODUCT_UPDATED: "Product updated successfully",
      PRODUCT_STATUS_TOGGLED: "Product status updated successfully",
      PRODUCT_DELETED: "Product deleted successfully",
      PRODUCT_OFFER_ADDED: "Product offer added successfully",
      PRODUCT_OFFER_REMOVED: "Product offer removed successfully",
      
      // Order Management
      ORDERS_FETCHED: "Orders fetched successfully",
      ORDER_DETAILS_FETCHED: "Order details fetched successfully",
      ORDER_STATUS_UPDATED: "Order status updated successfully",
      ORDERS_EXPORTED: "Orders exported successfully",
      RETURN_PROCESSED: "Return processed successfully",
      
      // Inventory Management
      QUANTITY_UPDATED: "Product quantity updated successfully",
      PRODUCT_STATUS_UPDATED: "Product status updated successfully",
      INVENTORY_ADJUSTED: "Inventory adjusted successfully",
      INVENTORY_HISTORY_FETCHED: "Inventory history fetched successfully",
      
      // Coupon Management
      COUPON_ADDED: "Coupon added successfully",
      COUPON_UPDATED: "Coupon updated successfully",
      COUPON_STATUS_UPDATED: "Coupon status updated successfully",
      COUPON_DELETED: "Coupon deleted successfully",
      COUPON_USERS_FETCHED: "Coupon usage data fetched successfully",
      
      // Dashboard & Reports
      DASHBOARD_LOADED: "Dashboard data loaded successfully",
      SALES_REPORT_GENERATED: "Sales report generated successfully",
      SALES_REPORT_EXPORTED: "Sales report exported successfully",
      
      // Wallet Management
      WALLET_DASHBOARD_LOADED: "Wallet dashboard loaded successfully",
      WALLET_CREDIT_ADDED: "Wallet credit added successfully",
      WALLET_BALANCE_DEDUCTED: "Wallet balance deducted successfully",
      USER_WALLET_INFO_FETCHED: "User wallet information fetched successfully",
      WALLET_DATA_EXPORTED: "Wallet data exported successfully",
      TRANSACTION_REVERSED: "Transaction reversed successfully"
    },
    
    ERROR: {
      // Authentication
      LOGIN_FAILED: "Admin login failed. Please check your credentials",
      SESSION_EXPIRED: "Admin session expired. Please login again",
      ACCESS_DENIED: "Access denied. Insufficient privileges",
      
      // Customer Management
      CUSTOMER_NOT_FOUND: "Customer not found",
      CUSTOMER_ACTION_FAILED: "Failed to perform action on customer",
      
      // Category Management
      CATEGORY_EXISTS: "Category with this name already exists",
      CATEGORY_NOT_FOUND: "Category not found",
      CATEGORY_UPDATE_FAILED: "Failed to update category",
      CATEGORY_DELETE_FAILED: "Failed to delete category. It may be in use",
      CATEGORY_OFFER_FAILED: "Failed to update category offer",
      
      // Brand Management
      BRAND_EXISTS: "Brand with this name already exists",
      BRAND_NOT_FOUND: "Brand not found",
      BRAND_UPDATE_FAILED: "Failed to update brand",
      BRAND_DELETE_FAILED: "Failed to delete brand. It may be in use",
      
      // Product Management
      PRODUCT_NOT_FOUND: "Product not found",
      PRODUCT_ADD_FAILED: "Failed to add product",
      PRODUCT_UPDATE_FAILED: "Failed to update product",
      PRODUCT_DELETE_FAILED: "Failed to delete product",
      PRODUCT_OFFER_FAILED: "Failed to update product offer",
      INVALID_PRODUCT_DATA: "Invalid product data",
      
      // Order Management
      ORDER_NOT_FOUND: "Order not found",
      ORDER_UPDATE_FAILED: "Failed to update order status",
      ORDERS_EXPORT_FAILED: "Failed to export orders",
      RETURN_PROCESS_FAILED: "Failed to process return request",
      
      // Inventory Management
      INVENTORY_UPDATE_FAILED: "Failed to update inventory",
      QUANTITY_UPDATE_FAILED: "Failed to update product quantity",
      STATUS_UPDATE_FAILED: "Failed to update product status",
      INVENTORY_ADJUSTMENT_FAILED: "Failed to adjust inventory",
      
      // Coupon Management
      COUPON_EXISTS: "Coupon with this code already exists",
      COUPON_NOT_FOUND: "Coupon not found",
      COUPON_ADD_FAILED: "Failed to add coupon",
      COUPON_UPDATE_FAILED: "Failed to update coupon",
      COUPON_DELETE_FAILED: "Failed to delete coupon",
      
      // Dashboard & Reports
      REPORT_GENERATION_FAILED: "Failed to generate sales report",
      REPORT_EXPORT_FAILED: "Failed to export sales report",
      
      // Wallet Management
      WALLET_NOT_FOUND: "Wallet not found",
      WALLET_CREDIT_FAILED: "Failed to add wallet credit",
      WALLET_DEDUCTION_FAILED: "Failed to deduct wallet balance",
      WALLET_EXPORT_FAILED: "Failed to export wallet data",
      TRANSACTION_REVERSAL_FAILED: "Failed to reverse transaction"
    },
    
    INFO: {
      PAGE_NOT_FOUND: "The requested admin page was not found",
      NO_CUSTOMERS: "No customers found",
      NO_ORDERS: "No orders found for the selected period",
      NO_PRODUCTS: "No products found",
      NO_CATEGORIES: "No categories found",
      NO_BRANDS: "No brands found",
      NO_COUPONS: "No coupons found",
      NO_INVENTORY_HISTORY: "No inventory history found for this product",
      NO_COUPON_USERS: "No users have used this coupon yet",
      NO_WALLET_TRANSACTIONS: "No wallet transactions found",
      DASHBOARD_ACCESS: "Welcome to admin dashboard"
    }
  };

  module.exports=MESSAGES;