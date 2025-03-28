const express = require("express");
const adminRouter = express.Router();
const adminController = require("../controllers/admin/adminController.js");
const { adminAuth } = require("../middleware/adminAuth.js");
const customerContorller = require("../controllers/admin/customerContorller.js");
const categoryController = require("../controllers/admin/categoryController.js");
const brandController = require("../controllers/admin/brandController.js");
const productContorller = require("../controllers/admin/productContorller.js");

const { uploads } = require("../uility/multer.js");

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
  uploads.single("image"),
  brandController.addBrand
);
adminRouter.get("/blockBrand", adminAuth, brandController.blockBrand);
adminRouter.get("/unBlockBrand", adminAuth, brandController.unBlockBrand);
adminRouter.get("/deleteBrand", adminAuth, brandController.deleteBrand);

//products management
adminRouter.get("/addProducts", adminAuth, productContorller.getProductAddPage);

module.exports = adminRouter;

/*
//Refferences

const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const {adminAuth,redirectAuth,} = require("../middlewares/adminAuthMiddleware");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const brandController=require("../controllers/admin/brandController");
const productController=require("../controllers/admin/productController");
const bannerController = require("../controllers/admin/bannerController");
const multer = require("multer");
const storage=require("../helpers/multer")
const uploads=multer({storage:storage});


router.get("/pageerror", adminController.pageError);


//profile
router.get("/login", redirectAuth, adminController.loadLogin);
router.post("/login", redirectAuth, adminController.login);
router.get("/logout", adminController.logout);
router.get("/forgotPassword", adminController.forgotPassword);
router.get("/dashboard", adminAuth, adminController.loadHomepage);



//Coustomer Management
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerUnblocked);


//category Management
router.get("/category",adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth,categoryController.addCategory);
router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer)
router.delete("/removeCategoryOffer", adminAuth,categoryController.removeCategoryOffer);
router.get("/listCategory",adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
router.get("/editCategory", adminAuth,categoryController.loadEditCategory);
router.post("/editCategory/:id", adminAuth,categoryController.editCategory);

//brand Management
router.get("/brands",adminAuth,brandController.loadBrandPage);
router.post('/addBrand',adminAuth,uploads.single("image"),brandController.addBrand)
router.get("/blockBrand",adminAuth,brandController.blockBrand);
router.get("/unblockBrand",adminAuth,brandController.unblockBrand);
router.get("/deleteBrand",adminAuth,brandController.deleteBrand);
router.get('/editbrand',adminAuth,brandController.loadEditBrand)
router.put("/editBrand/:id",adminAuth, uploads.single("image"),brandController.editBrand)


//product management

router.get("/addProduct",adminAuth,productController.loadAddProductPage)
router.post("/addproduct",adminAuth,uploads.array("images",4),productController.addproduct)
router.get('/products',adminAuth,productController.loadAllproducts);
router.post('/addProductOffer',adminAuth,productController.addProductOffer);
router.post('/removeProductOffer',adminAuth,productController.removeProductOffer);
router.get('/blockProduct',adminAuth,productController.blockProduct);
router.get('/unblockProduct',adminAuth,productController.unblockProduct);
router.get('/editProduct',adminAuth,productController.loadEditProduct);
router.post('/editProduct/:id',adminAuth,uploads.array("images",4),productController.editProduct);
router.delete('/deleteImage',adminAuth,productController.deleteSingleImage);

//banner maagement
router.get('/banner',adminAuth,bannerController.loadBannerPage)
router.get('/addBanner',adminAuth,bannerController.loadAddBannerPage);
router.post('/banner',adminAuth,uploads.single("images"),bannerController.addBanner)
router.delete('/banner',adminAuth,bannerController.deleteBanner);

module.exports = router;
*/
