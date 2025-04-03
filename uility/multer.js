const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

/*---------------------BRAND UPLOAD--------------*/
const BRAND_UPLOAD_DIR = path.join(__dirname, "../public/uploads/brand-images");

//check if dir exists
if (!fs.existsSync(BRAND_UPLOAD_DIR)) {
  fs.mkdirSync(BRAND_UPLOAD_DIR, { recursive: true });
}
//storage
const BrandStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    return cb(null, BRAND_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    return cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const BrandUploads = multer({ storage: BrandStorage });

/*---------------------PRODUCT UPLOAD--------------*/
const PRODUCT_UPLOAD_DIR = path.join(
  __dirname,
  "../public/uploads/product-images"
);
if (!fs.existsSync(PRODUCT_UPLOAD_DIR)) {
  fs.mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });
}

const ProductStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    return cb(null, PRODUCT_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uuid = uuidv4();
    return cb(null, `${uuid}-${file.originalname}`);
  },
});

const ProductUploads = multer({ storage: ProductStorage });
module.exports = { BrandUploads, ProductUploads };

// Middleware for handling file uploads

// Configure storage
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "public/uploads/product-images/");
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     const fileExt = path.extname(file.originalname);
//     cb(null, file.fieldname + "-" + uniqueSuffix + fileExt);
//   },
// });

// File filter
// const fileFilter = (req, file, cb) => {
//   const allowedFileTypes = /jpeg|jpg|png/;
//   const extname = allowedFileTypes.test(
//     path.extname(file.originalname).toLowerCase()
//   );
//   const mimetype = allowedFileTypes.test(file.mimetype);

//   if (extname && mimetype) {
//     return cb(null, true);
//   } else {
//     cb(new Error("Only JPEG, JPG, and PNG files are allowed"));
//   }
// };

// Initialize upload middleware
// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB limit
//   },
// });

// Export controller function with middleware
// module.exports = {
//   updateProduct: [upload.array("newImages", 4), updateProduct],
// };

//Exports
