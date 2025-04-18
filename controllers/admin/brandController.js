const Brand = require("../../models/Brand.js");
const Product = require("../../models/Products.js");
const fs = require("fs");
const path = require("path");
const getBrandPage = async (req, res) => {
  try {
    const admin = req.admin;

    if (!admin) {
      req.flash("error", "session expired please Login");
      return res.redirect("/admin");
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

    res.render("brand.ejs", {
      admin,
      data: brandData,
      currentPage: page,
      totalPages: totalPages,
      totalBrands: totalBrands,
    });
  } catch (error) {
    res.redirect("admin/pageerror");
  }
};

const addBrand = async (req, res) => {
  try {
    const brand = req.body.name;
    const findBrand = await Brand.findOne({
      brandName: { $regex: new RegExp(`^${brand}$`, "i") },
    });

    if (findBrand) {
      req.flash("error", "This Brand already exists");
      return res.redirect("/admin/brands");
    }

    if (!req.file) {
      req.flash("error", "Brand image is required.");
      return res.redirect("/admin/brands");
    }

    const image = req.file.filename;
    const newBrand = new Brand({
      brandName: brand,
      brandImage: image,
    });

    await newBrand.save();
    req.flash("success", "Brand added successfully");
    res.redirect("/admin/brands");
  } catch (error) {
    console.log("Adding brand Error", error);
    req.flash("error", "An error occurred while adding the brand");
    res.redirect("/admin/brands");
  }
};

//block brand
const blockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
    req.flash("success", "Brand Blocked successfully");
    res.redirect("/admin/brands");
  } catch (error) {
    res.redirect("admin/pageerror");
  }
};
const unBlockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
    req.flash("success", "Brand Unblocked successfully");
    res.redirect("/admin/brands");
  } catch (error) {
    res.redirect("admin/pageerror");
  }
};
//delete brand
const deleteBrand = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).redirect("/pageerror");
    }

    const brand = await Brand.findOne({ _id: id });

    if (brand.brandImage && brand.brandImage.length > 0) {
      const imagePath = path.join(
        __dirname,
        "../../public/uploads/brand-images/",
        brand.brandImage[0]
      );
      await fs.unlink(imagePath, (err) => {
        if (err) console.log("Image deletion error", err);
      });
    }

    await Brand.deleteOne({ _id: id });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.log("Error Deleting Brand", error);
    res.redirect("admin/pageerror");
  }
};

module.exports = {
  getBrandPage,
  addBrand,
  blockBrand,
  unBlockBrand,
  deleteBrand,
};
