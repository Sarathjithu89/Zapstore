const express = require("express");
const adminRouter = express.Router();
const adminController = require("../controllers/admin/adminController.js");
const { adminAuth } = require("../middleware/adminAuth.js");
const customerContorller = require("../controllers/admin/customerContorller.js");
const categoryController = require("../controllers/admin/categoryController.js");
const brandController = require("../controllers/admin/brandController.js");
const productController = require("../controllers/admin/productController.js");
const orderController = require("../controllers/admin/orderController.js");
const inventoryController = require("../controllers/admin/inventoryController.js");
const couponController = require("../controllers/admin/couponController.js");
const dashboardController = require("../controllers/admin/dashboardController.js");

const { BrandUploads, ProductUploads } = require("../uility/multer.js");

//admin login routes
adminRouter.get("/", adminAuth, adminController.loadLogin);
adminRouter.post("/login", adminController.adminLogin);
adminRouter.get("/logout", adminController.adminLogout);
// adminRouter.get("/dashboard", adminAuth, adminController.loadDashboard);
adminRouter.get("/pageerror", adminController.pageError);
//list users
adminRouter.get("/users", adminAuth, customerContorller.customerInfo);
adminRouter;
//block |unblock users
adminRouter.get(
  "/blockCustomer",
  adminAuth,
  customerContorller.custormerBlocked
);
adminRouter.get(
  "/unBlockCustomer",
  adminAuth,
  customerContorller.custormerUnblocked
);

//category Mangment
adminRouter.get("/category", adminAuth, categoryController.categoryInfo);
adminRouter.post("/addcategory", adminAuth, categoryController.addcategory);
adminRouter.post(
  "/addCategoryOffer",
  adminAuth,
  categoryController.addcategoryOffer
);
adminRouter.post(
  "/removeCategoryOffer",
  adminAuth,
  categoryController.removecategoryOffer
);
adminRouter.get("/listCategory", adminAuth, categoryController.getListCategory);
adminRouter.get(
  "/unListCategory",
  adminAuth,
  categoryController.getUnListCategory
);
adminRouter.get("/editCategory", adminAuth, categoryController.getEditCategory);
adminRouter.post("/editCategory", adminAuth, categoryController.editCategory);
adminRouter.post(
  "/delete-category",
  adminAuth,
  categoryController.deleteCategory
);

//Brand Managment
adminRouter.get("/brands", adminAuth, brandController.getBrandPage);
adminRouter.post(
  "/addBrand",
  adminAuth,
  BrandUploads.single("image"),
  brandController.addBrand
);
adminRouter.get("/blockBrand", adminAuth, brandController.blockBrand);
adminRouter.get("/unBlockBrand", adminAuth, brandController.unBlockBrand);
adminRouter.get("/deleteBrand", adminAuth, brandController.deleteBrand);

//products management
adminRouter.get("/addProducts", adminAuth, productController.getProductAddPage);
adminRouter.post(
  "/addProducts",
  adminAuth,
  ProductUploads.array("images", 4),
  productController.addProducts
);
adminRouter.get("/products", adminAuth, productController.getProducts);
adminRouter.post(
  "/addProductOffer",
  adminAuth,
  productController.addProductOffer
);
adminRouter.post(
  "/removeProductOffer",
  adminAuth,
  productController.removeProductOffer
);
adminRouter.get(
  "/blockProduct",
  adminAuth,
  productController.toggleProductBlock
);
adminRouter.get(
  "/editProduct/:id",
  adminAuth,
  productController.getEditProduct
);
adminRouter.post(
  "/updateProduct/:id",
  adminAuth,
  ProductUploads.array("images", 4),
  productController.updateProduct
);
adminRouter.get(
  "/deleteProduct/:id",
  adminAuth,
  productController.deleteProduct
);

// orders managment

adminRouter.get("/orders", adminAuth, orderController.getAllOrders);
adminRouter.get(
  "/getOrderDetails/:id",
  adminAuth,
  orderController.getOrderDetails
);
adminRouter.post(
  "/updateOrderStatus",
  adminAuth,
  orderController.updateOrderStatus
);
adminRouter.get("/exportOrders", adminAuth, orderController.exportOrders);
adminRouter.post("/processReturn", adminAuth, orderController.processReturn);

//inventory

adminRouter.get("/inventory", adminAuth, inventoryController.getInventoryPage);
adminRouter.post(
  "/updateProductQuantity",
  adminAuth,
  inventoryController.updateProductQuantity
);
adminRouter.post(
  "/updateProductStatus",
  adminAuth,
  inventoryController.updateProductStatus
);
adminRouter.post(
  "/adjustInventory",
  adminAuth,
  inventoryController.adjustInventory
);
adminRouter.get(
  "/inventoryHistory/:id",
  adminAuth,
  inventoryController.getInventoryHistory
);

//coupons
adminRouter.get("/coupons", adminAuth, couponController.getCoupons);
adminRouter.post("/add-coupon", adminAuth, couponController.addCoupon);
adminRouter.post("/edit-coupon", adminAuth, couponController.editCoupon);
adminRouter.get(
  "/toggle-coupon-status",
  adminAuth,
  couponController.toggleCouponStatus
);
adminRouter.get("/delete-coupon/:id", adminAuth, couponController.deleteCoupon);
adminRouter.get(
  "/coupon-users/:id",
  adminAuth,
  couponController.getCouponUsers
);

adminRouter.get("/dashboard", adminAuth, dashboardController.getSalesReport);
adminRouter.get("/sales-report", adminAuth, dashboardController.getSalesReport);
adminRouter.get(
  "/export-sales-report",
  adminAuth,
  dashboardController.exportSalesReport
);
adminRouter.get(
  "/export-sales-report",
  adminAuth,
  dashboardController.exportSalesReport
);

module.exports = adminRouter;
