const env = require("dotenv").config();
const User = require("../models/User.js");

const adminAuth = (req, res, next) => {
  const admin = req.session.admin ? req.session.admin : null;
  if (admin) {
    User.findOne({ email: admin.email, isAdmin: true })
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
  } else {
    return res.redirect("/admin");
  }
};
module.exports = { adminAuth };
