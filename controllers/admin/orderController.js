const Order = require("../../models/Order.js");
const User = require("../../models/User.js");
const Product = require("../../models/Products.js");
const mongoose = require("mongoose");
const Wallet = require("../../models/Wallet.js");
const Transaction = require("../../models/Transactions.js");
const { createObjectCsvWriter } = require("csv-writer");
const path = require("path");
const fs = require("fs");
const HTTP_STATUS = require("../../config/statusCodes.js");
const MESSAGES = require("../../config/adminMessages.js");

const getAllOrders = async (req, res) => {
  try {
    const admin = req.admin;
    if (!admin) {
      req.flash("error", MESSAGES.ERROR.SESSION_EXPIRED);
      return res.redirect("/admin");
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const status = req.query.status || "";
    const payment = req.query.payment || "";
    const sort = req.query.sort || "date_desc";

    let query = {};

    if (search) {
      const users = await User.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");

      const userIds = users.map((user) => user._id);

      query = {
        $or: [
          { orderId: { $regex: search, $options: "i" } },
          { userId: { $in: userIds } },
        ],
      };
    }
    if (status) {
      query.status = status;
    }
    if (payment) {
      query.paymentMethod = payment;
    }
    let sortOptions = {};

    switch (sort) {
      case "date_desc":
        sortOptions = { createdAt: -1 };
        break;
      case "date_asc":
        sortOptions = { createdAt: 1 };
        break;
      case "amount_desc":
        sortOptions = { finalAmount: -1 };
        break;
      case "amount_asc":
        sortOptions = { finalAmount: 1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);
    const orders = await Order.find(query)
      .populate("userId", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    res.render("admin/orderManagement.ejs", {
      title: "Order Management",
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      search,
      status,
      payment,
      sort,
      limit,
    });
  } catch (error) {
    console.error("Error in getAllOrders:", error);
    res.render("admin/orders", {
      title: "Order Management",
      orders: [],
      currentPage: 1,
      totalPages: 0,
      totalOrders: 0,
      error: MESSAGES.ERROR.ORDER_UPDATE_FAILED + ": " + error.message,
    });
  }
};

//Get order details
const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: MESSAGES.ERROR.INVALID_PRODUCT_DATA,
      });
    }

    const order = await Order.findById(orderId)
      .populate("userId", "name email")
      .populate({
        path: "orderedItems.product",
        select: "productName productImage",
      });

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: false,
        message: MESSAGES.ERROR.ORDER_NOT_FOUND,
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      status: true,
      order,
      message: MESSAGES.SUCCESS.ORDER_DETAILS_FETCHED,
    });
  } catch (error) {
    console.error("Error in getOrderDetails:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: MESSAGES.ERROR.ORDER_UPDATE_FAILED + ": " + error.message,
    });
  }
};

// Update order
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: MESSAGES.ERROR.INVALID_PRODUCT_DATA,
      });
    }
    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: MESSAGES.ERROR.INVALID_PRODUCT_DATA,
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: false,
        message: MESSAGES.ERROR.ORDER_NOT_FOUND,
      });
    }
    //canceled orders
    if (status === "Cancelled" && order.status !== "Cancelled") {
      if (order.paymentMethod !== "COD" && order.paymentStatus === "Paid") {
        const user = await User.findById(order.userId);
        let wallet = await Wallet.findOne({ user: user._id });
        if (!wallet) {
          wallet = new Wallet({
            user: user._id,
            balance: 0,
          });
        }

        wallet.balance = (wallet.balance || 0) + order.finalAmount;
        const transaction = new Transaction({
          wallet: wallet._id,
          amount: order.finalAmount,
          balanceAfter: wallet.balance,
          type: "credit",
          description: `Refund for cancelled order #${order.orderId}`,
          orderId: order._id,
        });

        await wallet.save();
        await transaction.save();
      }

      order.paymentStatus = "Refunded";
    }

    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    order.status = status;

    if (status === "Delivered" && order.paymentMethod === "COD") {
      order.paymentStatus = "Paid";
      order.deliveredAt = new Date();
    }

    // Add status history
    order.statusHistory.push({
      status: status,
      updatedBy: `Admin:${req.admin.email}`,
      date: new Date(),
    });

    await order.save();

    return res.status(HTTP_STATUS.OK).json({
      status: true,
      message: MESSAGES.SUCCESS.ORDER_STATUS_UPDATED,
    });
  } catch (error) {
    console.error("Error in updateOrderStatus:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: MESSAGES.ERROR.ORDER_UPDATE_FAILED + ": " + error.message,
    });
  }
};

// Process return request
const processReturn = async (req, res) => {
  try {
    const { orderId, returnAction, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: MESSAGES.ERROR.INVALID_PRODUCT_DATA,
      });
    }

    const order = await Order.findById({ _id: orderId });

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: false,
        message: MESSAGES.ERROR.ORDER_NOT_FOUND,
      });
    }

    if (order.status !== "Return Requested") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: false,
        message: MESSAGES.ERROR.ORDER_UPDATE_FAILED,
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (returnAction === "approve") {
        order.status = "Returned";
        const user = await User.findById(order.userId).session(session);

        if (user) {
          const wallet = await Wallet.findOne({ user: user._id }).session(
            session
          );

          if (!wallet) {
            const newWallet = new Wallet({
              user: user._id,
              balance: order.finalAmount,
            });
            await newWallet.save({ session });

            user.wallet = newWallet._id;
            await user.save({ session });

            await Transaction.create(
              [
                {
                  wallet: newWallet._id,
                  amount: order.finalAmount,
                  type: "credit",
                  balanceAfter: newWallet.balance,
                  description: `Refund for returned order #${order.orderId}`,
                  orderId: order._id,
                },
              ],
              { session }
            );
          } else {
            wallet.balance += order.finalAmount;
            await wallet.save({ session });

            await Transaction.create(
              [
                {
                  wallet: wallet._id,
                  amount: order.finalAmount,
                  balanceAfter: wallet.balance,
                  type: "credit",
                  description: `Refund for returned order #${order.orderId}`,
                  orderId: order._id,
                },
              ],
              { session }
            );
          }
        }

        order.paymentStatus = "Refunded";

        for (const item of order.orderedItems) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } },
            { session }
          );
        }
      } else {
        order.status = "Delivered";
      }

      order.returnDetails = {
        ...order.returnDetails,
        processedBy: req.admin.email,
        processedAt: new Date(),
        adminNotes: notes,
        approved: returnAction === "approve",
      };

      order.statusHistory.push({
        status: order.status,
        updatedBy: req.admin.email,
        date: new Date(),
        notes: `Return ${returnAction === "approve" ? "approved" : "rejected"}${
          notes ? ": " + notes : ""
        }`,
      });

      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(HTTP_STATUS.OK).json({
        status: true,
        message: MESSAGES.SUCCESS.RETURN_PROCESSED,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Error in processReturn:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: MESSAGES.ERROR.RETURN_PROCESS_FAILED + ": " + error.message,
    });
  }
};

// Export orders to CSV
const exportOrders = async (req, res) => {
  try {
    const search = req.query.search || "";
    const status = req.query.status || "";
    const payment = req.query.payment || "";
    const sort = req.query.sort || "date_desc";

    let query = {};

    if (search) {
      const users = await User.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");

      const userIds = users.map((user) => user._id);

      query = {
        $or: [
          { orderId: { $regex: search, $options: "i" } },
          { userId: { $in: userIds } },
        ],
      };
    }

    if (status) {
      query.status = status;
    }

    if (payment) {
      query.paymentMethod = payment;
    }

    let sortOptions = {};

    switch (sort) {
      case "date_desc":
        sortOptions = { createdAt: -1 };
        break;
      case "date_asc":
        sortOptions = { createdAt: 1 };
        break;
      case "amount_desc":
        sortOptions = { finalAmount: -1 };
        break;
      case "amount_asc":
        sortOptions = { finalAmount: 1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const orders = await Order.find(query)
      .populate("userId", "name email")
      .sort(sortOptions);

    const csvData = [];

    for (const order of orders) {
      const itemCount = order.orderedItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      const orderDate = new Date(order.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      csvData.push({
        orderId: order.orderId,
        date: orderDate,
        customer: order.userId ? order.userId.name : "N/A",
        email: order.userId ? order.userId.email : "N/A",
        items: itemCount,
        totalAmount: order.finalAmount.toFixed(2),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.status,
      });
    }
    // Create CSV file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `orders_export_${timestamp}.csv`;
    const filePath = path.join(__dirname, "../public/exports", fileName);

    // check directory exists
    if (!fs.existsSync(path.join(__dirname, "../public/exports"))) {
      fs.mkdirSync(path.join(__dirname, "../public/exports"), {
        recursive: true,
      });
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: "orderId", title: "Order ID" },
        { id: "date", title: "Order Date" },
        { id: "customer", title: "Customer Name" },
        { id: "email", title: "Email" },
        { id: "items", title: "Items" },
        { id: "totalAmount", title: "Total Amount (₹)" },
        { id: "paymentMethod", title: "Payment Method" },
        { id: "paymentStatus", title: "Payment Status" },
        { id: "orderStatus", title: "Order Status" },
      ],
    });

    await csvWriter.writeRecords(csvData);

    // download file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        req.flash("error", MESSAGES.ERROR.ORDERS_EXPORT_FAILED);
      }

      // Delete file after downloading
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Error deleting exported file:", unlinkErr);
        }
      });
    });
  } catch (error) {
    console.error("Error in exportOrders:", error);
    req.flash("error", MESSAGES.ERROR.ORDERS_EXPORT_FAILED);
    res.redirect(
      "/admin/orders?error=" +
        encodeURIComponent(
          MESSAGES.ERROR.ORDERS_EXPORT_FAILED + ": " + error.message
        )
    );
  }
};

module.exports = {
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  exportOrders,
  processReturn,
};
