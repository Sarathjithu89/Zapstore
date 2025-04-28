const Product = require("../../models/Products.js");
const Category = require("../../models/Category.js");
const Brand = require("../../models/Brand.js");
const User = require("../../models/User.js");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

//get product page
const getProductAddPage = async (req, res) => {
  try {
    const admin = req.admin;
    if (!admin) {
      req.flash("error", "session expired please Login");
      return res.redirect("/admin");
    }
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

//add products
const addProducts = async (req, res) => {
  try {
    const products = req.body;
    const productExists = await Product.findOne({
      productName: products.productName,
      isDeleted: false,
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
        productNumber: products.productNumber,
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

// get products page
const getProducts = async (req, res) => {
  try {
    const admin = req.admin;
    if (!admin) {
      req.flash("error", "session expired please Login");
      return res.redirect("/admin");
    }
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const productData = await Product.find({
      isDeleted: false,
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("category")
      .exec();

    const count = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { isDeleted: false },
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
  } catch (error) {
    console.log("get Product error", error);
    return res.redirect("/admin/pageerror");
  }
};

//add procuct offer
const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    const findProduct = await Product.findOne({
      _id: productId,
      isDeleted: false,
    });
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

    if (findCategory.categoryOffer >= percentage) {
      return res.json({
        status: false,
        message: `This product category already has a category offer,Please add offer greater than ${findCategory.categoryOffer}% to add Product offer`,
      });
    }

    // Calculate new sale price correctly based on regular price
    if (percentage > findCategory.categoryOffer) {
      findProduct.salePrice =
        findProduct.regularPrice -
        Math.floor(findProduct.regularPrice * (percentage / 100));
      findProduct.productOffer = parseInt(percentage);

      await findProduct.save();
    }

    // Only set category offer to 0 if we're changing the category settings
    // if (findCategory.categoryOffer > 0) {
    //   findCategory.categoryOffer = 0;
    //   await findCategory.save();
    // }

    return res.json({ status: true });
  } catch (error) {
    console.error("Error in addProductOffer:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal Server Error" });
  }
};

//remove prodcct offer
const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const findProduct = await Product.findOne({
      _id: productId,
      isDeleted: false,
    });

    if (!findProduct) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    // Reset the sale price
    findProduct.salePrice = findProduct.regularPrice;
    findProduct.productOffer = 0;

    // apply category offer if exist
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

//block product
const toggleProductBlock = async (req, res) => {
  try {
    const { id } = req.query;
    const product = await Product.findById(id);
    if (!product) {
      req.flash("error", "Product not found.");
      return res.redirect("/admin/products");
    }

    product.isBlocked = !product.isBlocked;
    await product.save();

    req.flash(
      "success",
      `Product ${product.isBlocked ? "blocked" : "unblocked"} successfully.`
    );
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error toggling product block:", error);
    res.redirect("/admin/pageerror");
  }
};

//get edit product
const getEditProduct = async (req, res) => {
  try {
    const admin = req.admin;
    const id = req.params.id;
    const product = await Product.findOne({ _id: id, isDeleted: false });
    const category = await Category.find({});
    const brand = await Brand.find({});

    res.render("editproduct.ejs", {
      admin: admin,
      product: product,
      cat: category,
      brand: brand,
    });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let product = await Product.findById(id);
    if (!product) {
      req.flash("error", "Product not found.");
      return res.redirect("/admin/products");
    }

    // Validate inputs
    const {
      productName,
      description,
      productNumber,
      category,
      brand,
      regularPrice,
      salePrice,
      quantity,
      warranty,
      color,
      productOffer,
      existingImages = [],
      deleteImages = [],
    } = req.body;

    if (
      !productName ||
      !description ||
      !category ||
      !brand ||
      !regularPrice ||
      !salePrice
    ) {
      req.flash("error", "Please fill all required fields.");
      return res.redirect(`/admin/editProduct/${id}`);
    }

    if (parseFloat(salePrice) > parseFloat(regularPrice)) {
      req.flash("error", "Sale price must be lower than the regular price.");
      return res.redirect(`/admin/editProduct/${id}`);
    }

    const existingImagesArray = Array.isArray(existingImages)
      ? existingImages
      : [existingImages];

    const deleteImagesArray = Array.isArray(deleteImages)
      ? deleteImages
      : [deleteImages];

    let updatedImages = [];

    // Remove deleted images
    existingImagesArray.forEach((image, index) => {
      if (
        deleteImagesArray[index] === "true" ||
        deleteImagesArray[index] === true
      ) {
        const imagePath = path.join(
          __dirname,
          "..",
          "..",
          "public",
          "uploads",
          "product-images",
          image
        );

        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log("Image deleted:", image);
          } else {
            console.warn("Image not found, skipping:", imagePath);
          }
        } catch (err) {
          console.error("Error deleting image:", err);
        }
      } else {
        updatedImages.push(image);
      }
    });

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        updatedImages.push(file.filename);
      }
    }

    if (updatedImages.length === 0) {
      req.flash("error", "Product must have at least one image.");
      return res.redirect(`/admin/editProduct/${id}`);
    }

    product = await Product.findByIdAndUpdate(
      id,
      {
        productName,
        description,
        productNumber: productNumber || null,
        category,
        brand,
        regularPrice: parseFloat(regularPrice),
        salePrice: parseFloat(salePrice),
        productOffer: parseInt(productOffer),
        quantity: parseInt(quantity),
        warranty: parseInt(warranty),
        color,
        productImage: updatedImages,
        updatedAt: new Date(),
      },
      { new: true }
    );

    req.flash("success", "Product updated successfully.");
    return res.redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product:", error);
    req.flash("error", "Failed to update product.");
    return res.redirect("/admin/products");
  }
};

//delete product soft delete
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let product = await Product.findById(id);

    if (!product) {
      req.flash("error", "Product not found.");
      return res.redirect("/admin/products");
    }
    // Mark as deleted (soft delete)
    product.isDeleted = true;
    product.deletedAt = new Date();
    await product.save();

    req.flash("success", "Product deleted successfully.");
    return res.redirect("/admin/products");
  } catch (error) {
    console.error("Error deleting product:", error);
    req.flash("error", "Failed to delete product.");
    return res.redirect("/admin/products");
  }
};

module.exports = {
  getProductAddPage,
  addProducts,
  getProducts,
  addProductOffer,
  removeProductOffer,
  getEditProduct,
  updateProduct,
  toggleProductBlock,
  deleteProduct,
};
