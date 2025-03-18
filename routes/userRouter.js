const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");

router.get("/", userController.loadHomepage);
router.get("/login", userController.laoadLogin);
router.get("/register", userController.laoadregister);
router.get("/pageNotFound", userController.pageNotFound);
router.post("/register", userController.register);
module.exports = router;
