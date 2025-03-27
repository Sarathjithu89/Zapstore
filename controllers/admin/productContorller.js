const Product = require("../../models/Products.js");
const Category = require("../../models/Category.js");
const Brand = require("../../models/Brand.js");
const User = require("../../models/User.js");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.render("addproduct.ejs", {
      cat: category,
      brand: brand,
    });
  } catch (error) {
    res.redirect("/pageerror");
  }
};

module.exports = { getProductAddPage };
