const User = require("../../models/User.js");
const Wishlist = require("../../models/Wishlist.js");
const Product = require("../../models/Products.js");

//Display user's wishlist
const getWishlist = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/login");
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

//Add product to wishlist
const addToWishlist = async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login to add products to wishlist",
      });
    }

    const userId = req.user.userId;
    const { productId } = req.body;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find user's wishlist or create a new one
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        products: [],
      });
    }

    // Check if product already exists in wishlist
    const existingProduct = wishlist.products.find(
      (item) => item.productId.toString() === productId
    );

    if (existingProduct) {
      return res.status(200).json({
        success: false,
        message: "Product already in your wishlist",
      });
    }

    // Add the product to wishlist
    wishlist.products.push({
      productId,
      addedOn: new Date(),
    });

    await wishlist.save();

    // Update user model if needed
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

//Remove product from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: "Please login to remove products from wishlist",
      });
    }

    const userId = req.session.user._id;
    const { productId } = req.body;

    // Find user's wishlist
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    // Remove the product from wishlist
    const initialLength = wishlist.products.length;
    wishlist.products = wishlist.products.filter(
      (item) => item.productId.toString() !== productId
    );

    // Check if product was actually in the wishlist
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

//Move product from wishlist to cart
const moveToCart = async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: "Please login to add products to cart",
      });
    }

    const userId = req.session.user._id;
    const { productId } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Add to cart (assuming you have a cart controller with this function)
    // This is a simplified example - you'd need to integrate with your actual cart controller
    const cartResponse = await addToCartFunction(userId, productId, 1);

    if (!cartResponse.success) {
      return res.status(400).json({
        success: false,
        message: "Failed to add product to cart",
      });
    }

    // Optionally remove from wishlist after adding to cart
    // You could make this configurable based on user preference
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    );

    res.status(200).json({
      success: true,
      message: "Product moved to cart successfully",
      cartCount: cartResponse.cartCount, // If your cart function returns this
    });
  } catch (error) {
    console.error("Error moving product to cart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move product to cart",
    });
  }
};

// Helper function (placeholder) - replace with your actual cart adding logic
// async function addToCartFunction(userId, productId, quantity) {
//   try {
//     // This would call your actual cart controller logic
//     // Return a mock response for now
//     return {
//       success: true,
//       message: 'Product added to cart',
//       cartCount: 1 // This would be the actual count from your cart controller
//     };
//   } catch (error) {
//     console.error('Error in add to cart function:', error);
//     return {
//       success: false,
//       message: 'Failed to add product to cart'
//     };
//   }
// }

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
};
