const Category = require("../../models/Category.js");
const Product = require("../../models/Products.js");

//load category
const categoryInfo = async (req, res) => {
  try {
    const admin = req.admin;

    if (!admin) {
      req.flash("error", "session expired please Login");
      return res.redirect("/admin");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category.ejs", {
      admin: admin,
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.log("category Error", error);
    return res.redirect("admin/pageerror");
  }
};

//add new category
const addcategory = async (req, res) => {
  const nameTrimmed = req.body.name.trim();
  const descriptionTrimmed = req.body.description.trim();

  try {
    if (!nameTrimmed || !descriptionTrimmed) {
      return res
        .status(400)
        .json({ error: "Name and Description are required" });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${nameTrimmed}$`, "i") },
    });

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
    const hasProductOffer = Math.max(
      ...products.map((product) => product.productOffer)
    );

    // if (hasProductOffer > percentage) {
    //   return res.json({
    //     status: false,
    //     message: `Products within this category already have product offer, please add offer greater than ${hasProductOffer}% category offer`,
    //   });
    // } else {
    await Category.updateOne(
      { _id: categoryId },
      { $set: { categoryOffer: percentage } }
    );

    for (const product of products) {
      if (product.productOffer || product.productOffer < percentage) {
        const discountAmount = (percentage / 100) * product.regularPrice;
        product.salePrice = product.regularPrice - discountAmount;
      }

      await product.save();
    }
    // }

    res.json({ status: true });
  } catch (error) {
    console.error("Error in addcategoryOffer:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};
//remove offer function
const removecategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ status: false, message: "Category not found" });
    }

    const products = await Product.find({ category: category._id });

    if (products.length > 0) {
      const bulkOps = products.map((product) => {
        let updatedSalePrice = product.regularPrice;

        if (product.productOffer && product.productOffer > 0) {
          updatedSalePrice =
            product.regularPrice -
            (product.regularPrice * product.productOffer) / 100;
        }

        return {
          updateOne: {
            filter: { _id: product._id },
            update: { $set: { salePrice: updatedSalePrice } },
          },
        };
      });

      await Product.bulkWrite(bulkOps);
    }

    category.categoryOffer = 0;
    await category.save();

    res.json({
      status: true,
      message: "Category offer removed and product prices updated.",
    });
  } catch (error) {
    console.error("Error removing category offer:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//load category list
const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("admin/pageerror");
  }
};
//unlist category
const getUnListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/category");
  } catch (error) {
    console.log(error);
    res.redirect("admin/pageerror");
  }
};

//Load Edit category
const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findById(id);
    return res.render("edit-category.ejs", { category: category });
  } catch (error) {
    console.log(error);
    res.redirect("admin/pageerror");
  }
};

//Edit category
const editCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const { categoryName, description } = req.body;

    // Check if the category name already exists
    const existingCategory = await Category.findOne({
      name: categoryName,
    });

    const updateCategory = await Category.findByIdAndUpdate(
      id,
      { name: categoryName, description: description },
      { new: true }
    );

    if (updateCategory) {
      req.flash("success", "Category updated successfully");
      return res.redirect("/admin/category");
    } else {
      req.flash("error", "Category not found");
      return res.redirect("/admin/category");
    }
  } catch (error) {
    console.error("Error updating category:", error);
    req.flash("error", "Internal server error");
    return res.redirect("/admin/category");
  }
};

//delete category
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;
    if (!req.admin) {
      req.flash("error", "please login to delete");
      return res.redirect("/admin");
    }

    const deletedCategory = await Category.findByIdAndDelete(categoryId);

    if (!deletedCategory) {
      return res
        .status(404)
        .json({ status: false, message: "Category not found" });
    }

    res.json({
      status: true,
    });
  } catch (error) {}
};

module.exports = {
  categoryInfo,
  addcategory,
  addcategoryOffer,
  removecategoryOffer,
  getListCategory,
  getUnListCategory,
  getEditCategory,
  editCategory,
  deleteCategory,
};
