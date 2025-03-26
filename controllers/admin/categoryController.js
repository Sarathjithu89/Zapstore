const Category = require("../../models/Category.js");
const Product = require("../../models/Products.js");

const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);
    res.render("category.ejs", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.log("category Error", error);
    return res.redirect("/pageerror");
  }
};

const addcategory = async (req, res) => {
  const nameTrimmed = req.body.name.trim();
  const descriptionTrimmed = req.body.description.trim();

  try {
    if (!nameTrimmed || !descriptionTrimmed) {
      return res
        .status(400)
        .json({ error: "Name and Description are required" });
    }

    const existingCategory = await Category.findOne({ name: nameTrimmed });
    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const newCategory = new Category({
      name: nameTrimmed,
      description: descriptionTrimmed,
    });

    await newCategory.save();
    return res.json({ message: "Category added" });
  } catch (error) {
    console.log("Add Category Error", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//add category offer
const addcategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ status: false, message: "Category not found" });
    }
    const products = await Product.find({ category: category._id });
    const hasProductOffer = products.some(
      (product) => product.productOffer > percentage
    );
    if (hasProductOffer) {
      return res.json({
        status: false,
        message: "Products within this category already have product offer",
      });
    }
    await Category.updateOne(
      { _id: categoryId },
      { $set: { categoryOffer: percentage } }
    );
    for (const product of products) {
      product.productOffer = 0;
      product.salePrice = product.regularPrice;
      await product.save();
    }
    res.json({ status: true });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//remove offer function
const removecategoryOffer = async (req, res) => {
  try {
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ status: false, message: "Category not found" });
    }
    const percentage = category.categoryOffer;
    const products = await Product.find({ category: category._id });
    if (products.length > 0) {
      for (const product of products) {
        {
          product.salePrice += Math.floor(
            product.regularPrice * (percentage / 100)
          );
          product.productOffer = 0;
          await product.save();
        }
      }
    }
    category.categoryOffer = 0;
    await category.save();
    res.json({ status: true });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

module.exports = {
  categoryInfo,
  addcategory,
  addcategoryOffer,
  removecategoryOffer,
};
