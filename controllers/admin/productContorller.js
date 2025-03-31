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
const addProducts = async (req, res) => {
  try {
    const products = req.body;
    const productExists = await Product.findOne({
      productName: products.productName,
    });

    if (!productExists) {
      const images = [];
      if (req.files && req.files.length > 0) {
        const uploadDir = path.join("public", "uploads", "product-images");
        // Create the directory if not exists
        // if (!fs.existsSync(uploadDir)) {
        //   fs.mkdirSync(uploadDir, { recursive: true });
        // }
        for (let i = 0; i < req.files.length; i++) {
          const originalImagePath = req.files[i].path;
          const resizedImagePath = path.join(uploadDir, req.files[i].filename);

          //image manipulation with sharp
          // await sharp(originalImagePath)
          //   .resize({ width: 440, height: 440 })
          //   .toFile(resizedImagePath);

          images.push(req.files[i].filename);
        }
      }
      const category = await Category.findOne({ name: products.category });

      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        brand: products.brand,
        category: category._id,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice, // Fixed typo here
        quantity: products.quantity,
        color: products.color,
        productImage: images,
        status: "Available",
        warranty: products.warranty,
      });

      await newProduct.save();
      req.flash("success", "Product added successfully");
      return res.redirect("/admin/addProducts");
    } else {
      req.flash(
        "error",
        "Product already exists. Please try with another name"
      );
      return res.redirect("/admin/addProducts");
    }
  } catch (error) {
    console.log("Error saving Product ", error);
    return res.redirect("/admin/pageerror");
  }
};

module.exports = { getProductAddPage, addProducts };
