const Product = require("../../models/Products.js");
const Category = require("../../models/Category.js");
const Brand = require("../../models/Brand.js");
const User = require("../../models/User.js");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const admin = req.session.admin;
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.render("addproduct.ejs", {
      admin: admin,
      cat: category,
      brand: brand,
    });
  } catch (error) {
    res.redirect("/admin/pageerror");
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

const getProducts = async (req, res) => {
  try {
    const admin = req.session.admin;
    const search = req.query.search || "";
    const page = req.query.page || 1;
    const limit = 4;

    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("category")
      .exec();

    const count = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    }).countDocuments();

    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    if (category && brand) {
      res.render("products.ejs", {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        admin: admin,
      });
    } else {
      res.render("404.ejs");
    }

    // const admin=req.session.admin;

    // const currentPage=1;
    // const totalPages=1;

    // const cat=await Category.find({})

    // const data=await Product.find({});

    // return res.render("products.ejs",{admin:admin,data:data,currentPage:currentPage,totalPages:totalPages,cat:cat});
  } catch (error) {
    console.log("get Product error", error);
    return res.redirect("/admin/pageerror");
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    if (!findProduct) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const findCategory = await Category.findOne({ _id: findProduct.category });
    if (!findCategory) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    if (findCategory.categoryOffer > percentage) {
      return res.json({
        status: false,
        message: "This product category already has a category offer",
      });
    }

    // Calculate new sale price correctly based on regular price
    findProduct.salePrice =
      findProduct.regularPrice -
      Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = parseInt(percentage);

    await findProduct.save();

    // Only set category offer to 0 if we're changing the category settings
    if (findCategory.categoryOffer > 0) {
      findCategory.categoryOffer = 0;
      await findCategory.save();
    }

    return res.json({ status: true });
  } catch (error) {
    console.error("Error in addProductOffer:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal Server Error" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    if (!findProduct) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    // Reset the sale price based on regular price
    findProduct.salePrice = findProduct.regularPrice;
    findProduct.productOffer = 0;

    // If there's a category offer, apply it after removing product offer
    const findCategory = await Category.findOne({ _id: findProduct.category });
    if (findCategory && findCategory.categoryOffer > 0) {
      findProduct.salePrice =
        findProduct.regularPrice -
        Math.floor(
          findProduct.regularPrice * (findCategory.categoryOffer / 100)
        );
    }

    await findProduct.save();
    return res.json({ status: true });
  } catch (error) {
    console.error("Error in removeProductOffer:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal Server Error" });
  }
};

const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    req.flash("success", "Procduct blocked successfully");
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    req.flash("success", "Product Unblocked Successfully");
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("admin/pageerror");
  }
};

module.exports = {
  getProductAddPage,
  addProducts,
  getProducts,
  addProductOffer,
  removeProductOffer,
  unblockProduct,
  blockProduct,
};
