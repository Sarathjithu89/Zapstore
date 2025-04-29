const Product = require("../../models/Products.js");
const User = require("../../models/User.js");
const Order = require("../../models/Order.js");
const PDFDocument = require("pdfkit");
const Transactions = require("../../models/Transactions.js");
const Wallet = require("../../models/Wallet.js");
const Coupon = require("../../models/Coupon.js");
const path = require("path");
const MESSAGES = require("../../config/messages.js");
const HTTP_STATUS = require("../../config/statusCodes.js");

// get Orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = 2;
    const searchQuery = req.query.search ? req.query.search.trim() : "";
    const filterQuery = req.query.filter || "";
    let query = { userId: userId };
    if (filterQuery && filterQuery !== "all") {
      query.status = filterQuery;
    }
    if (searchQuery) {
      const matchingProducts = await Product.find({
        productName: { $regex: searchQuery, $options: "i" },
      }).select("_id");

      const matchingProductIds = matchingProducts.map((product) => product._id);

      if (filterQuery && filterQuery !== "all") {
        query = {
          userId: userId,
          status: filterQuery,
          $or: [
            { orderId: { $regex: searchQuery, $options: "i" } },
            { "orderedItems.product": { $in: matchingProductIds } },
          ],
        };
      } else {
        query = {
          userId: userId,
          $or: [
            { orderId: { $regex: searchQuery, $options: "i" } },
            { "orderedItems.product": { $in: matchingProductIds } },
          ],
        };
      }
    }

    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate({
        path: "orderedItems.product",
        select: "productName productImage",
      })
      .populate("address")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const totalPages = Math.ceil(totalOrders / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.render("orders.ejs", {
      title: "Your Orders",
      orders,
      user: req.user,
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages,
        hasNextPage,
        hasPrevPage,
        searchQuery,
        filterQuery,
      },
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    req.flash("error", MESSAGES.ERROR.SOMETHING_WRONG);
    res.redirect("/");
  }
};

//order cancellation
const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { reason } = req.body;
    const userId = req.user?.userId;

    const order = await Order.findOne({ _id: orderId, userId: userId });

    if (!order) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: MESSAGES.ERROR.INVALID_REQUEST });
    }

    if (order.status !== "Pending" && order.status !== "Processing") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
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
      let wallet = await Wallet.findOne({ user: userId });

      if (!wallet) {
        wallet = new Wallet({
          user: userId,
          balance: 0,
        });
      }
      wallet.balance = (wallet.balance || 0) + order.finalAmount;

      const Transaction = new Transactions({
        wallet: wallet._id,
        amount: order.finalAmount,
        balanceAfter:wallet.balance,
        type: "credit",
        description: `Refund for cancelled order #${order.orderId}`,
        orderId: order._id,
      });

      await wallet.save();
      await Transaction.save();

      order.paymentStatus = "Refunded";
      order.statusHistory.push({
        status: order.status,
        updatedBy: `user:${req.user.email}`,
        date: new Date(),
      });
    }

    await order.save();

    return res.status(HTTP_STATUS.OK).json({ 
      success: true, 
      message: MESSAGES.ORDER.CANCELLED 
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: MESSAGES.ERROR.SOMETHING_WRONG 
    });
  }
};

//request return
const requestReturn = async (req, res) => {
  try {
    const { orderId, reason, comments } = req.body;
    const userId = req.user?.userId;

    const order = await Order.findOne({ _id: orderId, userId: userId });

    if (!order) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: MESSAGES.ERROR.INVALID_REQUEST });
    }

    if (order.status !== "Delivered") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Only delivered orders can be returned",
      });
    }

    const totalorderedItemqty = order.orderedItems
      .map((item) => item.quantity)
      .reduce((acc, curr) => (acc += curr));

    if (totalorderedItemqty >= 10) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Your order Quantity exceeds the allowed return quantity",
      });
    }

    const deliveryDate = order.deliveredAt || order.updatedAt;
    const daysAfterDelivery = Math.floor(
      (new Date() - deliveryDate) / (1000 * 60 * 60 * 24)
    );

    if (daysAfterDelivery > 7) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Returns can only be requested within 7 days of delivery",
      });
    }

    order.status = "Return Requested";
    order.returnReason = reason;
    order.returnComments = comments;
    order.returnRequestedAt = new Date();

    await order.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.OPERATION_SUCCESS,
    });
  } catch (error) {
    console.error("Error requesting return:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: MESSAGES.ERROR.SOMETHING_WRONG 
    });
  }
};

//invoice
const generateInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user?.userId;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate({
        path: "orderedItems.product",
        select: "productName productImage",
      })
      .populate("address");

    if (!order) {
      req.flash("error", MESSAGES.ERROR.INVALID_REQUEST);
      return res.redirect("/orders");
    }

    const userName = req.user?.name || "Customer";
    const userEmail = req.user?.email || "";

    const doc = new PDFDocument({ margin: 50, bufferPages: true, size: "A4" });

    const fontPath = path.join(
      "public",
      "assets",
      "fonts",
      "NotoSans-Regular.ttf"
    );
    doc.registerFont("Unicode", fontPath);
    doc.font("Unicode");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order.orderId || orderId}.pdf`
    );

    doc.pipe(res);

    // Company logo and info
    doc
      .fontSize(10)
      .text("Zapstore", 400, 50, { align: "right" })
      .text("123 Business Street", { align: "right" })
      .text("City, State, 874596", { align: "right" })
      .text("Email:", { align: "right" })
      .text("zapstore@company.com", { align: "right" });

    // Invoice header
    doc.fillColor("#333333").fontSize(25).text("INVOICE", 50, 120);
    doc
      .fontSize(10)
      .fillColor("#555555")
      .text(`Invoice #: ${order.orderId || orderId}`, 50, 150)
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, 165);

    // Customer info
    doc
      .fontSize(12)
      .fillColor("#000")
      .text("Bill To:", 50, 195, { underline: true });

    let currentY = 210;
    doc.fontSize(10).text(userName, 50, currentY);
    currentY += 15;
    doc.text(userEmail, 50, currentY);
    currentY += 15;

    if (order.address) {
      doc.text(
        `${order.address.addressLine}${
          order.address.city ? ", " + order.address.city : ""
        }`,
        50,
        currentY
      );
      currentY += 15;
      doc.text(
        `${order.address.state}${
          order.address.pincode ? " - " + order.address.pincode : ""
        }`,
        50,
        currentY
      );
      currentY += 15;
      doc.text(order.address.country, 50, currentY);
      currentY += 15;
    }

    // Table layout - ensure enough space after address
    const tableTop = currentY + 20;

    // Properly spaced columns - ensuring enough width for each
    const itemCodeX = 50;
    const descriptionX = 120;
    const quantityX = 300;
    const priceX = 350;
    const amountX = 430;

    // Table header background
    doc
      .rect(50, tableTop - 5, 500, 20)
      .fillColor("#f0f0f0")
      .fill()
      .strokeColor("#cccccc")
      .stroke();

    // Table headers
    doc
      .fillColor("#000000")
      .fontSize(10)
      .text("Item", itemCodeX, tableTop, { width: 60 })
      .text("Description", descriptionX, tableTop, { width: 170 })
      .text("Qty", quantityX, tableTop, { width: 40 })
      .text("Price", priceX, tableTop, { width: 70 })
      .text("Amount", amountX, tableTop, { width: 70 });

    // Row data
    let y = tableTop + 20;
    order.orderedItems.forEach((item, i) => {
      const productName = item.product?.productName || "Product";
      const isEven = i % 2 === 0;

      if (isEven) {
        doc
          .rect(50, y - 2, 500, 18)
          .fillColor("#f9f9f9")
          .fill()
          .strokeColor("#cccccc")
          .stroke();
      }

      // Define clear column widths
      doc
        .fillColor("#000")
        .fontSize(10)
        .text(productName.substring(0, 10), itemCodeX, y, { width: 60 })
        .text(productName, descriptionX, y, { width: 170 })
        .text(item.quantity.toString(), quantityX, y, { width: 40 })
        .text(`₹${item.price.toFixed(2)}`, priceX, y, { width: 70 })
        .text(`₹${(item.price * item.quantity).toFixed(2)}`, amountX, y, {
          width: 70,
          align: "left",
        });

      y += 20;
    });

    // Add padding after the table
    y += 20;

    // Totals section - moved to the right side
    // Draw totals with fixed positioning to ensure they appear as expected
    doc
      .rect(350, y, 200, order.discount > 0 ? 80 : 60)
      .fillColor("#f9f9f9")
      .fill()
      .strokeColor("#dddddd")
      .stroke();

    // Make sure totals align properly
    doc
      .fillColor("#000000")
      .fontSize(10)
      .text("Subtotal:", 370, y + 15, { width: 75 })
      .text(`₹ ${order.totalPrice.toFixed()}`, 490, y + 15, {
        width: 50,
        align: "right",
      });

    if (order.discount > 0) {
      doc
        .text("Discount:", 370, y + 35, { width: 75 })
        .text(`-₹ ${order.discount.toFixed()}`, 490, y + 35, {
          width: 50,
          align: "right",
        });

      doc
        .fontSize(11)
        .font("Unicode")
        .text("Total:", 370, y + 60, { width: 75 })
        .text(`₹ ${order.finalAmount.toFixed()}`, 490, y + 60, {
          width: 50,
          align: "right",
        });
    } else {
      doc
        .fontSize(11)
        .font("Unicode")
        .text("Total:", 370, y + 35, { width: 75 })
        .text(`₹ ${order.finalAmount.toFixed()}`, 490, y + 35, {
          width: 50,
          align: "right",
        });
    }

    // Move down to ensure space for payment info
    y = y + (order.discount > 0 ? 100 : 80);

    // Payment info - formatted as a clean section
    doc
      .fontSize(10)
      .font("Unicode")
      .text("Payment Information", 50, y, { underline: true });

    y += 20;
    doc.text(`Payment Status: ${order.status}`, 50, y);
    y += 15;
    doc.text(`Payment Method: ${order.paymentMethod}`, 50, y);

    // Thank you note - centered properly
    y += 30;
    doc.fontSize(12).text("Thank you for your business!", 50, y, {
      align: "center",
      width: 500,
    });

    //Check if we need to add a page for footer
    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 50;
    }

    // Footer with line
    const footerY = doc.page.height - 75;
    doc
      .moveTo(50, footerY)
      .lineTo(550, footerY)
      .strokeColor("#dddddd")
      .stroke();

    doc
      .fontSize(8)
      .fillColor("#888888")
      .text(
        "This is a computer generated invoice and does not require a signature.",
        50,
        footerY + 10,
        { align: "center", width: 500 }
      );

    doc.end();
  } catch (error) {
    console.error("Error generating invoice:", error);
    if (!res.headersSent) {
      req.flash("error", MESSAGES.ERROR.SOMETHING_WRONG);
      return res.redirect("/orders");
    }
  }
};

//order details
const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId).populate({
      path: "orderedItems.product",
      select: "productName productImage",
    });

    if (!order) {
      req.flash("error", MESSAGES.ERROR.INVALID_REQUEST);
      return res.redirect("/orders");
    }
    if (order.userId.toString() !== req.user.userId.toString()) {
      req.flash("error", MESSAGES.ERROR.UNAUTHORIZED_ACCESS);
      return res.redirect("/orders");
    }

    const formattedOrder = {
      _id: order._id,
      orderId: order.orderId,
      status: order.status,
      createdAt: order.createdAt,
      deliveredAt: order.deliveredAt,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus || "Not Paid",
      totalPrice: order.totalPrice,
      discount: order.discount || 0,
      couponApplied: order.couponApplied ? true : false,
      couponName: order.couponApplied ? order.couponName : null,
      finalAmount: order.finalAmount,
      address: order.address,
      orderedItems: order.orderedItems,
      statusHistory: order.statusHistory || [],
      returnRequestedAt: order.returnRequestedAt,
      returnReason: order.returnReason,
      returnComments: order.returnComments,
      shippingCost: order.shippingCost,
    };

    res.render("singleorder.ejs", {
      title: `Order #${order.orderId} - Your Shop`,
      order: formattedOrder,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    req.flash("error", MESSAGES.ERROR.SOMETHING_WRONG);
    res.redirect("/orders");
  }
};

//order success
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

    let couponDiscount = 0;
    const coupon = await Coupon.findOne({ name: orderSuccess.couponName });

    if (coupon) {
      couponDiscount = coupon.offerPrice;
    }

    const shippingAddress = orders[0].address;

    let subtotal = 0;
    let discount = 0;
    let shipping = orders.length * 50; // Each order has shipping cost of 50
    let totalRegularPrice = orderSuccess.totalRegularPrice;

    orders.forEach((order) => {
      subtotal += order.totalPrice;
      discount += order.discount;
    });

    const totalAmount = {
      totalRegularPrice,
      subtotal,
      discount,
      shipping,
      total: subtotal + shipping - couponDiscount,
    };

    delete req.session.orderSuccess;

    res.render("ordersuccess.ejs", {
      orders,
      userEmail: user.email,
      shippingAddress,
      totalAmount,
    });
  } catch (error) {
    console.error("Error rendering order success page:", error);
    req.flash("error", MESSAGES.ERROR.SOMETHING_WRONG);
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