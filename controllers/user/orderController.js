const Product = require("../../models/Products.js");
const User = require("../../models/User.js");
//const fs = require("fs");
const Order = require("../../models/Order.js");
const PDFDocument = require("pdfkit");

// get Orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const orders = await Order.find({ userId: userId })
      .populate({
        path: "orderedItems.product",
        select: "productName productImage",
      })
      .populate("address")
      .sort({ createdAt: -1 });

    res.render("orders.ejs", {
      title: "Your Orders",
      orders,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    req.flash("error", "Failed to fetch your orders");
    res.redirect("/userProfile");
  }
};

//order cancellation
const cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.user?.userId;

    const order = await Order.findOne({ _id: orderId, userId: userId });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Pending" && order.status !== "Processing") {
      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled in its current status",
      });
    }

    order.status = "Cancelled";
    order.cancelReason = reason;
    order.cancelledAt = new Date();

    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity, sold: -item.quantity },
      });
    }

    if (order.paymentStatus === "Paid") {
      const user = await User.findById(userId);
      user.wallet = (user.wallet || 0) + order.finalAmount;

      user.walletHistory.push({
        amount: order.finalAmount,
        type: "credit",
        description: `Refund for cancelled order #${order.orderId}`,
        date: new Date(),
      });

      await user.save();

      order.paymentStatus = "Refunded";
    }

    await order.save();

    return res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};

const requestReturn = async (req, res) => {
  try {
    const { orderId, reason, comments } = req.body;
    const userId = req.user?.userId;

    const order = await Order.findOne({ _id: orderId, userId: userId });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be returned",
      });
    }

    const deliveryDate = order.deliveredAt || order.updatedAt;
    const daysAfterDelivery = Math.floor(
      (new Date() - deliveryDate) / (1000 * 60 * 60 * 24)
    );

    if (daysAfterDelivery > 7) {
      return res.status(400).json({
        success: false,
        message: "Returns can only be requested within 7 days of delivery",
      });
    }

    order.status = "Return Requested";
    order.returnReason = reason;
    order.returnComments = comments;
    order.returnRequestedAt = new Date();

    await order.save();

    res.json({
      success: true,
      message: "Return request submitted successfully",
    });
  } catch (error) {
    console.error("Error requesting return:", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};

const generateInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user?.userId;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate({
        path: "orderedItems.product",
        select: "productName productImage",
      })
      .populate("address");

    if (!order) {
      req.flash("error", "Order not found");
      return res.redirect("/orders");
    }

    const userName = req.user?.name || "Customer";
    const userEmail = req.user?.email || "";

    const doc = new PDFDocument({ margin: 40, bufferPages: true, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order.orderId || orderId}.pdf`
    );

    doc.pipe(res);

    // Company logo and info
    doc
      .fontSize(10)
      .text("Zapsore", 400, 50, { align: "left" })
      .text("123 Business Street", { align: ";eft" })
      .text("City, State, 874596", { align: "left" })
      .text("Email: zapstore@company.com", { align: "left" });

    doc.moveDown();

    // Invoice header
    doc.fillColor("#333333").fontSize(25).text("INVOICE", 50, 150);
    doc
      .fontSize(10)
      .fillColor("#555555")
      .text(`Invoice #: ${order.orderId || orderId}`, 50, 180)
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, 195);

    doc.moveDown();

    // Customer info
    doc
      .fontSize(12)
      .fillColor("#000")
      .text("Bill To:", 50, 230, { underline: true });
    doc.fontSize(10).text(userName).text(userEmail);
    if (order.address) {
      doc.text(`${order.address.addressLine}, ${order.address.city}`);
      doc.text(`${order.address.state} - ${order.address.pincode}`);
      doc.text(order.address.country);
    }

    doc.moveDown(2);

    // Table layout
    const tableTop = 300;
    const itemCodeX = 50;
    const descriptionX = 150;
    const quantityX = 350;
    const priceX = 400;
    const amountX = 470;

    // Header background
    doc
      .rect(50, tableTop - 5, 500, 20)
      .fill("#f0f0f0")
      .stroke();

    // Table headers
    doc
      .fillColor("#000000")
      .fontSize(10)
      .text("Item", itemCodeX, tableTop)
      .text("Description", descriptionX, tableTop)
      .text("Qty", quantityX, tableTop)
      .text("Price", priceX, tableTop)
      .text("Amount", amountX, tableTop);

    // Row data
    let y = tableTop + 20;
    order.orderedItems.forEach((item, i) => {
      const productName = item.product?.productName || "Product";
      const isEven = i % 2 === 0;

      if (isEven) {
        doc
          .rect(50, y - 2, 500, 18)
          .fill("#f9f9f9")
          .stroke();
      }

      doc
        .fillColor("#000")
        .fontSize(10)
        .text(productName.substring(0, 20), itemCodeX, y)
        .text(productName.substring(0, 30), descriptionX, y)
        .text(item.quantity.toString(), quantityX, y)
        .text(`₹${item.price.toFixed(2)}`, priceX, y)
        .text(`₹${(item.price * item.quantity).toFixed(2)}`, amountX, y);

      y += 20;
    });

    // Totals box
    y += 10;
    doc
      .lineWidth(1)
      .rect(350, y, 200, order.discount > 0 ? 60 : 45)
      .strokeColor("#cccccc")
      .stroke();

    doc
      .fontSize(10)
      .fillColor("#000000")
      .text("Subtotal:", 360, y + 5)
      .text(`₹ ${order.totalPrice.toFixed(2)}`, 530, y + 5, { align: "right" });

    if (order.discount > 0) {
      doc
        .text("Discount:", 360, y + 20)
        .text(`-₹ ${order.discount.toFixed(2)}`, 530, y + 20, {
          align: "right",
        });
    }

    doc
      .fontSize(12)
      .text("Total:", 360, y + (order.discount > 0 ? 40 : 25))
      .text(
        `₹ ${order.finalAmount.toFixed(2)}`,
        530,
        y + (order.discount > 0 ? 40 : 25),
        {
          align: "right",
        }
      );

    // Payment info
    y += order.discount > 0 ? 80 : 60;
    doc.fontSize(10).text("Payment Information", 50, y, { underline: true });
    y += 15;
    doc.text(`Payment Status: ${order.status}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);

    // Thank you note
    doc.moveDown(2);
    doc.fontSize(12).text("Thank you for your business!", { align: "center" });

    // Footer
    const footerY = doc.page.height - 30;
    doc
      .moveTo(50, footerY - 10)
      .lineTo(550, footerY - 10)
      .strokeColor("#dddddd")
      .stroke();

    doc
      .fontSize(8)
      .fillColor("#888888")
      .text(
        "This is a computer generated invoice and does not require a signature.",
        40,
        footerY,
        { align: "center" }
      );

    doc.end();
  } catch (error) {
    console.error("Error generating invoice:", error);
    if (!res.headersSent) {
      req.flash("error", `Failed to generate invoice: ${error.message}`);
      return res.redirect("/orders");
    }
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId).populate({
      path: "orderedItems.product",
      select: "productName productImage",
    });

    if (!order) {
      req.flash("error", "Order not found");
      return res.redirect("/orders");
    }
    if (order.userId.toString() !== req.user.userId.toString()) {
      req.flash("error", "Unauthorized access");
      return res.redirect("/orders");
    }

    const formattedOrder = {
      _id: order._id,
      orderId: order.orderId,
      status: order.status,
      createdAt: order.createdAt,
      deliveredAt: order.deliveredAt,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalPrice: order.totalPrice,
      discount: order.discount || 0,
      couponApplied: order.couponCode ? true : false,
      finalAmount: order.finalAmount,
      address: order.address,
      orderedItems: order.orderedItems,
      statusHistory: order.statusHistory || [],
      returnRequestedAt: order.returnRequestedAt,
      returnReason: order.returnReason,
      returnComments: order.returnComments,
    };
    res.render("singleorder.ejs", {
      title: `Order #${order.orderId} - Your Shop`,
      order: formattedOrder,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    req.flash("error", "Something went wrong. Please try again.");
    res.redirect("/orders");
  }
};

const orderSuccess = async (req, res) => {
  try {
    // Get order details from session
    const orderSuccess = req.session.orderSuccess;

    if (
      !orderSuccess ||
      !orderSuccess.orderIds ||
      orderSuccess.orderIds.length === 0
    ) {
      return res.redirect("/orders");
    }

    const userId = req.user.userId;
    const user = await User.findById(userId);

    // Fetch orders with populated product information
    const orders = await Order.find({
      orderId: { $in: orderSuccess.orderIds },
    }).populate({
      path: "orderedItems.product",
      populate: {
        path: "category",
      },
    });

    if (!orders || orders.length === 0) {
      return res.redirect("/orders");
    }

    // Get shipping address
    const shippingAddress = orders[0].address;

    // Calculate total amounts
    let subtotal = 0;
    let discount = 0;
    let shipping = orders.length * 50; // Each order has shipping cost of 50

    orders.forEach((order) => {
      subtotal += order.totalPrice;
      discount += order.discount;
    });

    const totalAmount = {
      subtotal,
      discount,
      shipping,
      total: subtotal + shipping - discount,
    };

    // Clear the session data to prevent revisiting
    req.session.orderSuccess = null;

    // Render the success page with order details
    res.render("ordersuccess.ejs", {
      orders,
      userEmail: user.email,
      shippingAddress,
      totalAmount,
    });
  } catch (error) {
    console.error("Error rendering order success page:", error);
    res.redirect("/orders");
  }
};

module.exports = {
  getUserOrders,
  cancelOrder,
  generateInvoice,
  requestReturn,
  getOrderDetails,
  orderSuccess,
};
