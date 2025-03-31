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

//Exports
module.exports = { BrandUploads, ProductUploads };
