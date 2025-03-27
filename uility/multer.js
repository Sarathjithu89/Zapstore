const multer = require("multer");
const path = require("path");
const fs=require('fs');


const UPLOAD_DIR = path.join(__dirname, "../public/uploads/re-image");


if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    return cb(null,UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    return cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const uploads = multer({ storage });
module.exports = { uploads };
