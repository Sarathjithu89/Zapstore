const Brand = require("../../models/Brand.js");
const Product = require("../../models/Products.js");
const fs = require("fs");
const path = require("path");
const HTTP_STATUS = require("../../config/statusCodes.js");
const MESSAGES = require("../../config/adminMessages.js");

const getBrandPage = async (req, res) => {
  try {
    const admin = req.admin;

    if (!admin) {
      req.flash("error", MESSAGES.ERROR.SESSION_EXPIRED);
      return res.status(HTTP_STATUS.UNAUTHORIZED).redirect("/admin");
    }
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const brandData = await Brand.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
    const totalBrands = await Brand.countDocuments();
    const totalPages = Math.ceil(totalBrands / limit);

    if (brandData.length === 0) {
      req.flash("info", MESSAGES.INFO.NO_BRANDS);
    }

    res.status(HTTP_STATUS.OK).render("brand.ejs", {
      admin,
      data: brandData,
      currentPage: page,
      totalPages: totalPages,
      totalBrands: totalBrands,
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("admin/pageerror");
  }
};

const addBrand = async (req, res) => {
  try {
    const brand = req.body.name;
    const findBrand = await Brand.findOne({
      brandName: { $regex: new RegExp(`^${brand}$`, "i") },
    });

    if (findBrand) {
      req.flash("error", MESSAGES.ERROR.BRAND_EXISTS);
      return res.status(HTTP_STATUS.CONFLICT).redirect("/admin/brands");
    }

    if (!req.file) {
      req.flash("error", "Brand image is required.");
      return res.status(HTTP_STATUS.BAD_REQUEST).redirect("/admin/brands");
    }

    const image = req.file.filename;
    const newBrand = new Brand({
      brandName: brand,
      brandImage: image,
    });

    await newBrand.save();
    req.flash("success", MESSAGES.SUCCESS.BRAND_ADDED);
    res.status(HTTP_STATUS.CREATED).redirect("/admin/brands");
  } catch (error) {
    req.flash("error", MESSAGES.ERROR.BRAND_ADD_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/brands");
  }
};

const blockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    const brand = await Brand.findById(id);

    if (!brand) {
      req.flash("error", MESSAGES.ERROR.BRAND_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/brands");
    }

    await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
    req.flash("success", MESSAGES.SUCCESS.BRAND_BLOCKED);
    res.status(HTTP_STATUS.OK).redirect("/admin/brands");
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("admin/pageerror");
  }
};

const unBlockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    const brand = await Brand.findById(id);

    if (!brand) {
      req.flash("error", MESSAGES.ERROR.BRAND_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/brands");
    }

    await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
    req.flash("success", MESSAGES.SUCCESS.BRAND_UNBLOCKED);
    res.status(HTTP_STATUS.OK).redirect("/admin/brands");
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("admin/pageerror");
  }
};

const deleteBrand = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(HTTP_STATUS.BAD_REQUEST).redirect("/pageerror");
    }

    const brand = await Brand.findOne({ _id: id });
    if (!brand) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ERROR.BRAND_NOT_FOUND,
      });
    }

    const productsWithBrand = await Product.countDocuments({ brand: id });
    if (productsWithBrand > 0) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: MESSAGES.ERROR.BRAND_DELETE_FAILED,
      });
    }

    if (brand.brandImage && brand.brandImage.length > 0) {
      const imagePath = path.join(
        __dirname,
        "../../public/uploads/brand-images/",
        brand.brandImage[0]
      );
      fs.unlink(imagePath, (err) => {
        if (err) console.log("Image deletion error", err);
      });
    }

    await Brand.deleteOne({ _id: id });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.BRAND_DELETED,
    });
  } catch (error) {
    console.log("Error Deleting Brand", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.BRAND_DELETE_FAILED,
    });
  }
};

module.exports = {
  getBrandPage,
  addBrand,
  blockBrand,
  unBlockBrand,
  deleteBrand,
};
