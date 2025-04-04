const getSingleProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Find the product by ID and populate any related data
    const product = await Product.findById(productId)
      .populate("category")
      .populate("brand");

    if (!product) {
      req.flash("error", "Product not found");
      return res.redirect("/shop");
    }

    // Find related products (products in same category, excluding current product)
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: productId },
    }).limit(8);

    // Render the product page with the data
    res.render("user/product", {
      title: product.productName,
      product,
      relatedProducts,
      user: req.user || null,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    req.flash("error", "Something went wrong");
    res.redirect("/shop");
  }
};

const postProductReview = async (req, res) => {
  try {
    const productId = req.params.id;
    const { rating, title, comment, name, email } = req.body;

    // Find the product
    const product = await Product.findById(productId);

    if (!product) {
      req.flash("error", "Product not found");
      return res.redirect("/shop");
    }

    // Create a new review object
    const newReview = {
      name,
      email,
      rating: parseInt(rating),
      title,
      comment,
      date: new Date(),
    };

    // Add the review to the product's reviews array
    if (!product.reviews) {
      product.reviews = [];
    }

    product.reviews.push(newReview);

    // Update the product's overall rating
    const totalRating = product.reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    product.rating = totalRating / product.reviews.length;

    // Save the updated product
    await product.save();

    req.flash("success", "Review added successfully");
    res.redirect(`/product/${productId}`);
  } catch (error) {
    console.error("Error adding review:", error);
    req.flash("error", "Failed to add review");
    res.redirect(`/product/${req.params.id}`);
  }
};

module.exports = {
  getSingleProduct,
  postProductReview,
};
