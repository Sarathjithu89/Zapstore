const User = require("../../models/User.js");
const Wishlist = require("../../models/Wishlist.js");
const Product = require("../../models/Products.js");
const HTTP_STATUS = require("../../config/statusCodes.js");
const MESSAGES = require("../../config/messages.js");

// Load wishlist
const getWishlist = async (req, res) => {
  try {
    if (!req.user) {
      req.flash("error", MESSAGES.ERROR.AUTHENTICATION_REQUIRED);
      return res.redirect("/");
    }
    const userId = req.user.userId;

    let wishlist = await Wishlist.findOne({ userId }).populate({
      path: "products.productId",
      select: "productName productImage regularPrice salePrice",
    });

    if (!wishlist) {
      wishlist = { userId, products: [] };
    }

    res.render("user/wishlist.ejs", {
      wishlist,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("error", {
      message: MESSAGES.ERROR.SOMETHING_WRONG,
      error: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
  }
};

const addToWishlist = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.ERROR.AUTHENTICATION_REQUIRED,
      });
    }

    const userId = req.user.userId;
    const { productId } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ERROR.PRODUCT_NOT_FOUND,
      });
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        products: [],
      });
    }

    const existingProduct = wishlist.products.find(
      (item) => item.productId.toString() === productId
    );

    if (existingProduct) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: "Product already in your wishlist",
      });
    }

    wishlist.products.push({
      productId,
      addedOn: new Date(),
    });

    await wishlist.save();

    const user = await User.findById(userId);
    if (!user.wishlist.includes(wishlist._id)) {
      user.wishlist.push(wishlist._id);
      await user.save();
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Product added to wishlist successfully",
    });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
    });
  }
};

// Remove from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.ERROR.AUTHENTICATION_REQUIRED,
      });
    }

    const userId = req.user.userId;
    const productId = req.params.id;

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const initialLength = wishlist.products.length;
    wishlist.products = wishlist.products.filter(
      (item) => item.productId.toString() !== productId
    );

    if (initialLength === wishlist.products.length) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    await wishlist.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Product removed from wishlist successfully",
    });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SOMETHING_WRONG,
    });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
