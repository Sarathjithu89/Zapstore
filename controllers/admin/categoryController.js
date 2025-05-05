const Category = require("../../models/Category.js");
const Product = require("../../models/Products.js");
const HTTP_STATUS = require("../../config/statusCodes.js");
const MESSAGES = require("../../config/adminMessages.js");

// Load categories with pagination
const categoryInfo = async (req, res) => {
  try {
    const admin = req.admin;

    if (!admin) {
      req.flash("error", MESSAGES.ERROR.SESSION_EXPIRED);
      return res.status(HTTP_STATUS.UNAUTHORIZED).redirect("/admin");
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

    if (categoryData.length === 0) {
      req.flash("info", MESSAGES.INFO.NO_CATEGORIES);
    }

    res.status(HTTP_STATUS.OK).render("category.ejs", {
      admin: admin,
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.error("Category Error", error);
    req.flash("error", MESSAGES.ERROR.CATEGORY_NOT_FOUND);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .redirect("/admin/pageerror");
  }
};

// Add a new category
const addcategory = async (req, res) => {
  const nameTrimmed = req.body.name.trim();
  const descriptionTrimmed = req.body.description.trim();

  try {
    if (!nameTrimmed || !descriptionTrimmed) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: "Name and Description are required" });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${nameTrimmed}$`, "i") },
    });

    if (existingCategory) {
      return res
        .status(HTTP_STATUS.CONFLICT)
        .json({ error: MESSAGES.ERROR.CATEGORY_EXISTS });
    }

    const newCategory = new Category({
      name: nameTrimmed,
      description: descriptionTrimmed,
    });

    await newCategory.save();
    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.SUCCESS.CATEGORY_ADDED,
    });
  } catch (error) {
    console.error("Add Category Error", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: MESSAGES.ERROR.CATEGORY_ADD_FAILED,
    });
  }
};

//Add offer to a category
const addcategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);

    if (!category) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: MESSAGES.ERROR.CATEGORY_NOT_FOUND });
    }

    const products = await Product.find({ category: category._id });
    const hasProductOffer = Math.max(
      ...products.map((product) => product.productOffer || 0)
    );

    await Category.updateOne(
      { _id: categoryId },
      { $set: { categoryOffer: percentage } }
    );

    for (const product of products) {
      if (!product.productOffer || product.productOffer < percentage) {
        const discountAmount = (percentage / 100) * product.regularPrice;
        product.salePrice = product.regularPrice - discountAmount;
        await product.save();
      }
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.CATEGORY_OFFER_ADDED,
    });
  } catch (error) {
    console.error("Error in addcategoryOffer:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.CATEGORY_OFFER_FAILED,
    });
  }
};

//Remove offer from a category
const removecategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: MESSAGES.ERROR.CATEGORY_NOT_FOUND });
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

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.CATEGORY_OFFER_REMOVED,
    });
  } catch (error) {
    console.error("Error removing category offer:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.CATEGORY_OFFER_FAILED,
    });
  }
};

//List a category (set isListed to false)
const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    const category = await Category.findById(id);

    if (!category) {
      req.flash("error", MESSAGES.ERROR.CATEGORY_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/category");
    }

    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    req.flash("success", MESSAGES.SUCCESS.CATEGORY_LISTED);
    res.status(HTTP_STATUS.OK).redirect("/admin/category");
  } catch (error) {
    console.error("Error listing category:", error);
    req.flash("error", MESSAGES.ERROR.CATEGORY_UPDATE_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/pageerror");
  }
};

//Unlist a category (set isListed to true)
const getUnListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    const category = await Category.findById(id);

    if (!category) {
      req.flash("error", MESSAGES.ERROR.CATEGORY_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/category");
    }

    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    req.flash("success", MESSAGES.SUCCESS.CATEGORY_UNLISTED);
    res.status(HTTP_STATUS.OK).redirect("/admin/category");
  } catch (error) {
    console.error("Error unlisting category:", error);
    req.flash("error", MESSAGES.ERROR.CATEGORY_UPDATE_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/pageerror");
  }
};

//Load edit category page
const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findById(id);

    if (!category) {
      req.flash("error", MESSAGES.ERROR.CATEGORY_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/category");
    }

    return res
      .status(HTTP_STATUS.OK)
      .render("edit-category.ejs", { category: category });
  } catch (error) {
    console.error("Error loading edit category:", error);
    req.flash("error", MESSAGES.ERROR.CATEGORY_NOT_FOUND);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/pageerror");
  }
};

//Update category details
const editCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const { categoryName, description } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      req.flash("error", MESSAGES.ERROR.CATEGORY_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/category");
    }

    const existingCategory = await Category.findOne({
      name: categoryName,
      _id: { $ne: id },
    });

    if (existingCategory) {
      req.flash("error", MESSAGES.ERROR.CATEGORY_EXISTS);
      return res.status(HTTP_STATUS.CONFLICT).redirect("/admin/category");
    }

    const updateCategory = await Category.findByIdAndUpdate(
      id,
      { name: categoryName, description: description },
      { new: true }
    );

    if (updateCategory) {
      req.flash("success", MESSAGES.SUCCESS.CATEGORY_UPDATED);
      return res.status(HTTP_STATUS.OK).redirect("/admin/category");
    } else {
      req.flash("error", MESSAGES.ERROR.CATEGORY_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/category");
    }
  } catch (error) {
    console.error("Error updating category:", error);
    req.flash("error", MESSAGES.ERROR.CATEGORY_UPDATE_FAILED);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .redirect("/admin/category");
  }
};

//Delete a category
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;

    if (!req.admin) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.ERROR.SESSION_EXPIRED,
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ERROR.CATEGORY_NOT_FOUND,
      });
    }

    const productsWithCategory = await Product.countDocuments({
      category: categoryId,
    });
    if (productsWithCategory > 0) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: MESSAGES.ERROR.CATEGORY_DELETE_FAILED,
      });
    }

    const deletedCategory = await Category.findByIdAndDelete(categoryId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.CATEGORY_DELETED,
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.CATEGORY_DELETE_FAILED,
    });
  }
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
