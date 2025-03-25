const env = require("dotenv").config();
const User = require("../models/User.js");

const adminAuth = (req, res, next) => {
  User.findOne({ isAdmin: true })
    .then((data) => {
      if (data) {
        next();
      } else {
        res.redirect("/admin");
      }
    })
    .catch((error) => {
      console.log("Error in Admin Auth", error);
      res.status(500).send("Internal server error");
    });
};
module.exports = { adminAuth };
