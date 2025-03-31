const express = require("express");
const adminRouter = express.Router();
const adminController = require("../controllers/admin/adminController.js");
const { adminAuth } = require("../middleware/adminAuth.js");
const customerContorller = require("../controllers/admin/customerContorller.js");
const categoryController = require("../controllers/admin/categoryController.js");
const brandController = require("../controllers/admin/brandController.js");
const productContorller = require("../controllers/admin/productContorller.js");

const { BrandUploads, ProductUploads } = require("../uility/multer.js");

//admin login routes
adminRouter.get("/", adminController.loadLogin);
adminRouter.post("/login", adminController.adminLogin);
adminRouter.get("/logout", adminController.adminLogout);
adminRouter.get("/dashboard", adminAuth, adminController.loadDashboard);
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
adminRouter.get("/addProducts", adminAuth, productContorller.getProductAddPage);
adminRouter.post(
  "/addProducts",
  adminAuth,
  ProductUploads.array("images", 4),
  productContorller.addProducts
);

module.exports = adminRouter;
