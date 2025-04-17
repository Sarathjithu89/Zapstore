const User = require("../../models/User.js");
const Wishlist = require("../../models/Wishlist.js");
const Product = require("../../models/Products.js");

//load wishlist
const getWishlist = async (req, res) => {
  try {
    if (!req.user) {
      req.flash("error", "Please login to access your wishlist");
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
    res.status(500).render("error", {
      message: "Failed to load wishlist. Please try again later.",
      error: { status: 500 },
    });
  }
};

const addToWishlist = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login to add products to wishlist",
      });
    }

    const userId = req.user.userId;
    const { productId } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
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
      return res.status(200).json({
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

    res.status(200).json({
      success: true,
      message: "Product added to wishlist successfully",
    });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist",
    });
  }
};

//Remove from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login to remove products from wishlist",
      });
    }

    const userId = req.user.userId;
    const { productId } = req.body;

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const initialLength = wishlist.products.length;
    wishlist.products = wishlist.products.filter(
      (item) => item.productId.toString() !== productId
    );

    if (initialLength === wishlist.products.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    await wishlist.save();

    res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
    });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove product from wishlist",
    });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
