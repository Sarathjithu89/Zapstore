const Product = require("../../models/Products.js");
const Inventory = require("../../models/Inventory.js");

// Get inventory
const getInventoryPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    let query = { isDeleted: false };
    if (search) {
      query = {
        isDeleted: false,
        $or: [
          { productName: { $regex: search, $options: "i" } },
          { productNumber: { $regex: search, $options: "i" } },
        ],
      };
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(query)
      .populate("category")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render("admin/inventory.ejs", {
      data: products,
      currentPage: page,
      totalPages: totalPages,
      search: search,
    });
  } catch (error) {
    console.error("Error loading inventory page:", error);
    req.flash("error", "Failed to load inventory data");
    res.redirect("/admin/dashboard");
  }
};
// Update quantity
const updateProductQuantity = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.json({ status: false, message: "Invalid input data" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ status: false, message: "Product not found" });
    }

    const previousQuantity = product.quantity;
    const parsedQuantity = parseInt(quantity);

    product.quantity = parsedQuantity;

    if (parsedQuantity <= 0) {
      product.status = "Out of Stock";
    } else if (product.status === "Out of Stock") {
      product.status = "Available";
    }

    await product.save();

    await new Inventory({
      product: productId,
      adjustmentType: "set",
      quantity: parsedQuantity - previousQuantity,
      previousQuantity: previousQuantity,
      newQuantity: parsedQuantity,
      reason: "Manual quantity update",
      performedBy: req.admin._id,
    }).save();

    return res.json({
      status: true,
      message: "Product quantity updated successfully",
    });
  } catch (error) {
    console.error("Error updating product quantity:", error);
    return res.json({
      status: false,
      message: "Failed to update product quantity",
    });
  }
};
// Update status
const updateProductStatus = async (req, res) => {
  try {
    const { productId, status } = req.body;

    if (!productId || !status) {
      return res.json({ status: false, message: "Invalid input data" });
    }

    const validStatuses = ["Available", "Out of Stock", "Discontinued"];
    if (!validStatuses.includes(status)) {
      return res.json({ status: false, message: "Invalid status value" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ status: false, message: "Product not found" });
    }

    const previousStatus = product.status;
    product.status = status;

    if (status === "Out of Stock" && product.quantity > 0) {
      const previousQuantity = product.quantity;
      product.quantity = 0;

      await new Inventory({
        product: productId,
        adjustmentType: "remove",
        quantity: previousQuantity,
        previousQuantity: previousQuantity,
        newQuantity: 0,
        reason: "Status changed to Out of Stock",
        performedBy: req.admin._id,
      }).save();
    }

    if (
      previousStatus === "Out of Stock" &&
      status === "Available" &&
      product.quantity === 0
    ) {
      product.quantity = 1;

      await new Inventory({
        product: productId,
        adjustmentType: "add",
        quantity: 1,
        previousQuantity: 0,
        newQuantity: 1,
        reason: "Status changed to Available",
        performedBy: req.admin._id,
      }).save();
    }

    await product.save();

    return res.json({
      status: true,
      message: "Product status updated successfully",
    });
  } catch (error) {
    console.error("Error updating product status:", error);
    return res.json({
      status: false,
      message: "Failed to update product status",
    });
  }
};

// Adjust inventory
const adjustInventory = async (req, res) => {
  try {
    const { productId, quantity, reason, adjustmentType, adjustmentQuantity } =
      req.body;

    if (!productId || quantity === undefined || !reason || !adjustmentType) {
      return res.json({ status: false, message: "Invalid input data" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ status: false, message: "Product not found" });
    }

    const previousQuantity = product.quantity;
    const parsedQuantity = parseInt(quantity);
    const parsedAdjustmentQuantity = parseInt(adjustmentQuantity);

    product.quantity = parsedQuantity;

    if (parsedQuantity <= 0) {
      product.status = "Out of Stock";
    } else if (product.status === "Out of Stock") {
      product.status = "Available";
    }

    await product.save();

    await new Inventory({
      product: productId,
      adjustmentType: adjustmentType,
      quantity: parsedAdjustmentQuantity,
      previousQuantity: previousQuantity,
      newQuantity: parsedQuantity,
      reason: reason,
      performedBy: req.admin._id,
    }).save();

    return res.json({
      status: true,
      message: "Inventory adjusted successfully",
    });
  } catch (error) {
    console.error("Error adjusting inventory:", error);
    return res.json({
      status: false,
      message: "Failed to adjust inventory",
    });
  }
};

// Restock product
const restockProduct = async (req, res) => {
  try {
    const { productId, quantity, reason } = req.body;

    if (!productId || !quantity) {
      return res.json({ status: false, message: "Invalid input data" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ status: false, message: "Product not found" });
    }

    const previousQuantity = product.quantity;
    const addedQuantity = parseInt(quantity);
    const newQuantity = previousQuantity + addedQuantity;

    product.quantity = newQuantity;

    if (product.status === "Out of Stock" && newQuantity > 0) {
      product.status = "Available";
    }

    await product.save();

    await new Inventory({
      product: productId,
      adjustmentType: "add",
      quantity: addedQuantity,
      previousQuantity: previousQuantity,
      newQuantity: newQuantity,
      reason: reason || "Restock inventory",
      performedBy: req.admin._id,
    }).save();

    return res.json({
      status: true,
      message: "Product restocked successfully",
    });
  } catch (error) {
    console.error("Error restocking product:", error);
    return res.json({
      status: false,
      message: "Failed to restock product",
    });
  }
};

// Low stock
const getLowStockProducts = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;

    const lowStockProducts = await Product.find({
      isDeleted: false,
      quantity: { $lte: threshold, $gt: 0 },
    })
      .populate("category")
      .sort({ quantity: 1 });

    res.render("admin/lowStockProducts", {
      data: lowStockProducts,
      threshold: threshold,
    });
  } catch (error) {
    console.error("Error loading low stock products:", error);
    req.flash("error", "Failed to load low stock products");
    res.redirect("/admin/inventory");
  }
};

// Out of stock
const getOutOfStockProducts = async (req, res) => {
  try {
    const outOfStockProducts = await Product.find({
      isDeleted: false,
      $or: [{ quantity: 0 }, { status: "Out of Stock" }],
    })
      .populate("category")
      .sort({ updatedAt: -1 });

    res.render("admin/outOfStockProducts", {
      data: outOfStockProducts,
    });
  } catch (error) {
    console.error("Error loading out of stock products:", error);
    req.flash("error", "Failed to load out of stock products");
    res.redirect("/admin/inventory");
  }
};

// inventory history
const getInventoryHistory = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!productId) {
      req.flash("error", "Product ID is required");
      return res.redirect("/admin/inventory");
    }

    const product = await Product.findById(productId).populate("category");
    if (!product) {
      req.flash("error", "Product not found");
      return res.redirect("/admin/inventory");
    }

    // Get inventory logs for this product
    const logs = await Inventory.find({ product: productId })
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 });

    res.render("admin/inventoryHistory", {
      product: product,
      logs: logs,
    });
  } catch (error) {
    console.error("Error loading inventory history:", error);
    req.flash("error", "Failed to load inventory history");
    res.redirect("/admin/inventory");
  }
};

// Export inventory report
const exportInventoryReport = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: false })
      .populate("category")
      .sort({ productName: 1 });

    // Create CSV data
    let csvContent =
      "Product Name,Product Number,Category,Brand,Quantity,Status,Regular Price,Sale Price,Sold\n";

    products.forEach((product) => {
      csvContent += `"${product.productName}",`;
      csvContent += `"${product.productNumber}",`;
      csvContent += `"${product.category ? product.category.name : "N/A"}",`;
      csvContent += `"${product.brand}",`;
      csvContent += `${product.quantity},`;
      csvContent += `"${product.status}",`;
      csvContent += `${product.regularPrice},`;
      csvContent += `${product.salePrice},`;
      csvContent += `${product.sold}\n`;
    });

    // Set headers for CSV download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=inventory_report.csv"
    );

    // Send the CSV data
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting inventory report:", error);
    req.flash("error", "Failed to export inventory report");
    res.redirect("/admin/inventory");
  }
};

// Bulk update inventory
const bulkUpdateInventory = async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.json({ status: false, message: "Invalid input data" });
    }

    // Validate all products before updating any
    for (const item of products) {
      if (!item.productId || item.quantity === undefined) {
        return res.json({
          status: false,
          message: "Invalid data for one or more products",
        });
      }
    }

    // Process valid updates
    const updates = [];
    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      const previousQuantity = product.quantity;
      const newQuantity = parseInt(item.quantity);

      // Update product quantity
      product.quantity = newQuantity;

      // Update status based on quantity
      if (newQuantity <= 0) {
        product.status = "Out of Stock";
      } else if (product.status === "Out of Stock") {
        product.status = "Available";
      }

      await product.save();

      // Create inventory log
      await new Inventory({
        product: item.productId,
        adjustmentType: "set",
        quantity: newQuantity - previousQuantity,
        previousQuantity: previousQuantity,
        newQuantity: newQuantity,
        reason: "Bulk inventory update",
        performedBy: req.admin._id,
      }).save();

      updates.push({
        productId: item.productId,
        productName: product.productName,
        previousQuantity,
        newQuantity,
      });
    }

    return res.json({
      status: true,
      message: `Successfully updated ${updates.length} products`,
      updates,
    });
  } catch (error) {
    console.error("Error in bulk inventory update:", error);
    return res.json({
      status: false,
      message: "Failed to update inventory in bulk",
    });
  }
};

// Get inventory stats for dashboard
const getInventoryStats = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments({ isDeleted: false });

    const outOfStockCount = await Product.countDocuments({
      isDeleted: false,
      $or: [{ quantity: 0 }, { status: "Out of Stock" }],
    });

    const lowStockCount = await Product.countDocuments({
      isDeleted: false,
      quantity: { $gt: 0, $lte: 10 },
    });

    const discontinuedCount = await Product.countDocuments({
      isDeleted: false,
      status: "Discontinued",
    });

    // Total inventory value calculation
    const products = await Product.find({ isDeleted: false });
    let totalInventoryValue = 0;

    for (const product of products) {
      totalInventoryValue += product.quantity * product.salePrice;
    }

    // Top selling products
    const topSellingProducts = await Product.find({ isDeleted: false })
      .sort({ sold: -1 })
      .limit(5)
      .select("productName sold salePrice");

    return res.json({
      status: true,
      stats: {
        totalProducts,
        outOfStockCount,
        lowStockCount,
        discontinuedCount,
        totalInventoryValue,
        topSellingProducts,
      },
    });
  } catch (error) {
    console.error("Error getting inventory stats:", error);
    return res.json({
      status: false,
      message: "Failed to retrieve inventory statistics",
    });
  }
};

module.exports = {
  getInventoryPage,
  updateProductStatus,
  adjustInventory,
  restockProduct,
  getLowStockProducts,
  getOutOfStockProducts,
  updateProductQuantity,
  getInventoryHistory,
  exportInventoryReport,
  bulkUpdateInventory,
  getInventoryStats,
};
