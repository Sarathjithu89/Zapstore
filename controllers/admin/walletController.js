const Wallet = require("../../models/Wallet.js");
const Transaction = require("../../models/Transactions.js");
const User = require("../../models/User.js");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const HTTP_STATUS = require("../../config/statusCodes.js");
const MESSAGES = require("../../config/adminMessages.js");

// Dashboard
const getWalletDashboard = async (req, res) => {
  try {
    // Parse query parameters for filtering
    const {
      filterType = "all",
      userId = "",
      minBalance = "",
      maxBalance = "",
      transactionType = "all",
      dateRange = "all",
      startDate = "",
      endDate = "",
    } = req.query;

    let walletQuery = {};
    let transactionQuery = {};

    if (filterType === "user" && userId) {
      const user = await User.findOne({
        $or: [
          { email: { $regex: userId, $options: "i" } },
          { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null },
        ],
      });

      if (user) {
        walletQuery.user = user._id;
        transactionQuery.wallet = user.wallet;
      }
    }

    if (filterType === "balance") {
      if (minBalance !== "") {
        walletQuery.balance = { $gte: Number(minBalance) };
      }
      if (maxBalance !== "") {
        walletQuery.balance = walletQuery.balance || {};
        walletQuery.balance.$lte = Number(maxBalance);
      }
    }

    if (transactionType !== "all") {
      transactionQuery.type = transactionType;
    }

    if (dateRange !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (dateRange === "today") {
        transactionQuery.createdAt = { $gte: today };
      } else if (dateRange === "week") {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        transactionQuery.createdAt = { $gte: startOfWeek };
      } else if (dateRange === "month") {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        transactionQuery.createdAt = { $gte: startOfMonth };
      } else if (dateRange === "custom" && startDate && endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1); // Include the full end date

        transactionQuery.createdAt = {
          $gte: new Date(startDate),
          $lt: endDateObj,
        };
      }
    }

    const totalWalletBalance = await Wallet.aggregate([
      { $group: { _id: null, total: { $sum: "$balance" } } },
    ]);

    const activeWallets = await Wallet.countDocuments({ balance: { $gt: 0 } });

    const totalTransactions = await Transaction.countDocuments(
      transactionQuery
    );

    const averageWalletBalanceResult = await Wallet.aggregate([
      { $match: { balance: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: "$balance" } } },
    ]);

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.aggregate([
      { $match: transactionQuery },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "wallets",
          localField: "wallet",
          foreignField: "_id",
          as: "walletDetails",
        },
      },
      { $unwind: "$walletDetails" },
      {
        $lookup: {
          from: "users",
          localField: "walletDetails.user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "orderDetails",
        },
      },
      { $unwind: { path: "$orderDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          transactionId: { $toString: "$_id" },
          type: 1,
          amount: 1,
          balanceAfter: "$walletDetails.balance",
          description: 1,
          createdAt: 1,
          userId: {
            _id: "$userDetails._id",
            name: "$userDetails.name",
            email: "$userDetails.email",
          },
          referenceType: {
            $cond: {
              if: { $ifNull: ["$orderId", false] },
              then: "order",
              else: "admin",
            },
          },
          referenceId: { $toString: { $ifNull: ["$orderId", ""] } },
          reason: { $ifNull: ["$description", "Wallet Transaction"] },
          notes: { $ifNull: ["$description", ""] },
          paymentId: 1,
        },
      },
    ]);

    //top wallet users
    const topUsers = await Wallet.aggregate([
      { $match: { balance: { $gt: 0 } } },
      { $sort: { balance: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $lookup: {
          from: "transactions",
          localField: "_id",
          foreignField: "wallet",
          as: "transactions",
        },
      },
      {
        $project: {
          _id: 1,
          name: "$userDetails.name",
          email: "$userDetails.email",
          walletBalance: "$balance",
          transactionCount: { $size: "$transactions" },
          lastActivity: {
            $ifNull: [{ $max: "$transactions.createdAt" }, "$createdAt"],
          },
        },
      },
    ]);

    const chartData = await getChartData(transactionQuery);

    const totalUsers = await User.countDocuments();
    const activeWalletPercentage = Math.round(
      (activeWallets / totalUsers) * 100
    );

    const totalPages = Math.ceil(totalTransactions / limit);

    const queryString = new URLSearchParams({
      filterType,
      userId,
      minBalance: minBalance || "",
      maxBalance: maxBalance || "",
      transactionType,
      dateRange,
      startDate: startDate || "",
      endDate: endDate || "",
    }).toString();

    res.status(HTTP_STATUS.OK).render("admin/wallet", {
      totalWalletBalance: totalWalletBalance[0]?.total || 0,
      activeWallets,
      totalTransactions,
      averageWalletBalance: averageWalletBalanceResult[0]?.avg || 0,
      transactions,
      topUsers,
      chartData,
      activeWalletPercentage,
      filterType,
      userId,
      minBalance,
      maxBalance,
      transactionType,
      dateRange,
      startDate,
      endDate,
      totalPages,
      page,
      query: queryString,
      message: MESSAGES.SUCCESS.WALLET_DASHBOARD_LOADED,
    });
  } catch (error) {
    console.error("Error in wallet dashboard:", error);
    req.flash(
      "error",
      MESSAGES.ERROR.DASHBOARD_LOAD_FAILED || "Failed to load wallet data"
    );
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/dashboard");
  }
};

//chart data
async function getChartData(baseQuery = {}) {
  try {
    const dates = [];
    const credits = [];
    const debits = [];

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(
        date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      );

      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const creditResult = await Transaction.aggregate([
        {
          $match: {
            ...baseQuery,
            type: { $in: ["credit", "refund"] },
            createdAt: { $gte: dayStart, $lte: dayEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const debitResult = await Transaction.aggregate([
        {
          $match: {
            ...baseQuery,
            type: { $in: ["debit", "payment"] },
            createdAt: { $gte: dayStart, $lte: dayEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      credits.push(creditResult[0]?.total || 0);
      debits.push(debitResult[0]?.total || 0);
    }

    const transactionSummary = {
      credits: await Transaction.countDocuments({
        ...baseQuery,
        type: "credit",
      }),
      debits: await Transaction.countDocuments({ ...baseQuery, type: "debit" }),
      refunds: await Transaction.countDocuments({
        ...baseQuery,
        type: "refund",
      }),
      payments: await Transaction.countDocuments({
        ...baseQuery,
        type: "payment",
      }),
    };

    return {
      dates,
      credits,
      debits,
      transactionSummary,
    };
  } catch (error) {
    console.error("Error generating chart data:", error);
    return {
      dates: [],
      credits: [],
      debits: [],
      transactionSummary: { credits: 0, debits: 0, refunds: 0, payments: 0 },
    };
  }
}

//credit to wallet
const addWalletCredit = async (req, res) => {
  try {
    const { email, amount, reason, notes } = req.body;
    const amountValue = parseFloat(amount);

    if (!email || !amountValue || amountValue <= 0) {
      req.flash("error", MESSAGES.ERROR.WALLET_CREDIT_FAILED);
      return res.status(HTTP_STATUS.BAD_REQUEST).redirect("/admin/wallet");
    }

    const user = await User.findOne({ email });
    if (!user) {
      req.flash("error", MESSAGES.ERROR.CUSTOMER_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/wallet");
    }

    let wallet = await Wallet.findOne({ user: user._id });
    if (!wallet) {
      wallet = new Wallet({ user: user._id, balance: 0 });
      await wallet.save();

      user.wallet = wallet._id;
      await user.save();
    }

    const newBalance = wallet.balance + amountValue;
    wallet.balance = newBalance;
    await wallet.save();

    const transaction = new Transaction({
      wallet: wallet._id,
      amount: amountValue,
      type: "credit",
      description: notes || "",
      reason: reason || "Admin Credit",
      balanceAfter: newBalance,
      referenceType: "admin",
      performedBy: req.admin._id,
    });

    await transaction.save();

    req.flash("success", MESSAGES.SUCCESS.WALLET_CREDIT_ADDED);
    res.status(HTTP_STATUS.OK).redirect("/admin/wallet");
  } catch (error) {
    console.error("Error adding credit:", error);
    req.flash("error", MESSAGES.ERROR.WALLET_CREDIT_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/wallet");
  }
};

// Deduct from wallet
const deductWalletBalance = async (req, res) => {
  try {
    const { email, amount, reason, notes } = req.body;
    const amountValue = parseFloat(amount);

    if (!email || !amountValue || amountValue <= 0) {
      req.flash("error", MESSAGES.ERROR.WALLET_DEDUCTION_FAILED);
      return res.status(HTTP_STATUS.BAD_REQUEST).redirect("/admin/wallet");
    }

    const user = await User.findOne({ email });
    if (!user) {
      req.flash("error", MESSAGES.ERROR.CUSTOMER_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/wallet");
    }

    const wallet = await Wallet.findOne({ user: user._id });
    if (!wallet) {
      req.flash("error", MESSAGES.ERROR.WALLET_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/wallet");
    }

    if (wallet.balance < amountValue) {
      req.flash("error", MESSAGES.ERROR.WALLET_DEDUCTION_FAILED);
      return res.status(HTTP_STATUS.BAD_REQUEST).redirect("/admin/wallet");
    }

    const newBalance = wallet.balance - amountValue;
    wallet.balance = newBalance;
    await wallet.save();

    const transaction = new Transaction({
      wallet: wallet._id,
      amount: amountValue,
      type: "debit",
      description: notes || "",
      reason: reason || "Admin Deduction",
      balanceAfter: newBalance,
      referenceType: "admin",
      performedBy: req.admin._id,
    });

    await transaction.save();

    req.flash("success", MESSAGES.SUCCESS.WALLET_BALANCE_DEDUCTED);
    res.status(HTTP_STATUS.OK).redirect("/admin/wallet");
  } catch (error) {
    console.error("Error deducting balance:", error);
    req.flash("error", MESSAGES.ERROR.WALLET_DEDUCTION_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/wallet");
  }
};

//user wallet info
const getUserWalletInfo = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: MESSAGES.ERROR.WALLET_NOT_FOUND });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: MESSAGES.ERROR.CUSTOMER_NOT_FOUND });
    }

    const wallet = await Wallet.findOne({ user: user._id });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.USER_WALLET_INFO_FETCHED,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        walletBalance: wallet ? wallet.balance : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching user wallet info:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.WALLET_NOT_FOUND,
    });
  }
};

// Export wallet data
const exportWalletData = async (req, res) => {
  try {
    const { format, ...filters } = req.query;

    let query = {};

    const transactions = await Transaction.find(query)
      .populate("wallet", "user")
      .populate({
        path: "wallet",
        populate: {
          path: "user",
          select: "name email",
        },
      })
      .sort({ createdAt: -1 });

    const formattedData = transactions.map((transaction) => ({
      transactionId: transaction.paymentId,
      date: transaction.createdAt.toLocaleDateString(),
      time: transaction.createdAt.toLocaleTimeString(),
      user: transaction.wallet?.user?.name || "Unknown",
      email: transaction.wallet?.user?.email || "Unknown",
      type: transaction.type,
      amount: transaction.amount,
      balanceAfter: transaction.balanceAfter,
      reason: transaction.reason || transaction.description,
      reference: transaction.referenceType,
      notes: transaction.notes || "",
    }));

    if (format === "excel") {
      // Generate Excel
      const buffer = await generateExcel(formattedData, "Wallet Transactions");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=wallet-transactions-${Date.now()}.xlsx`
      );
      return res.status(HTTP_STATUS.OK).send(buffer);
    } else if (format === "pdf") {
      // Generate PDF
      const buffer = await generatePDF(
        formattedData,
        "Wallet Transactions Report"
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=wallet-transactions-${Date.now()}.pdf`
      );
      return res.status(HTTP_STATUS.OK).send(buffer);
    } else {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ERROR.WALLET_EXPORT_FAILED,
      });
    }
  } catch (error) {
    console.error("Error exporting wallet data:", error);
    req.flash("error", MESSAGES.ERROR.WALLET_EXPORT_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/wallet");
  }
};

// Reverse transaction
const reverseTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      req.flash("error", MESSAGES.ERROR.TRANSACTION_REVERSAL_FAILED);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/wallet");
    }

    const isRecent = transaction.createdAt > Date.now() - 24 * 60 * 60 * 1000;
    if (!isRecent || transaction.referenceType !== "admin") {
      req.flash("error", MESSAGES.ERROR.TRANSACTION_REVERSAL_FAILED);
      return res.status(HTTP_STATUS.BAD_REQUEST).redirect("/admin/wallet");
    }

    const wallet = await Wallet.findOne({ user: transaction.wallet });
    if (!wallet) {
      req.flash("error", MESSAGES.ERROR.WALLET_NOT_FOUND);
      return res.status(HTTP_STATUS.NOT_FOUND).redirect("/admin/wallet");
    }

    let newBalance = wallet.balance;
    let reverseType;
    let reverseAmount = transaction.amount;

    if (transaction.type === "credit" || transaction.type === "refund") {
      newBalance -= transaction.amount;
      reverseType = "debit";

      if (newBalance < 0) {
        req.flash("error", MESSAGES.ERROR.TRANSACTION_REVERSAL_FAILED);
        return res.status(HTTP_STATUS.BAD_REQUEST).redirect("/admin/wallet");
      }
    } else {
      newBalance += transaction.amount;
      reverseType = "credit";
    }

    wallet.balance = newBalance;
    await wallet.save();

    const reverseTransaction = new Transaction({
      wallet: transaction.wallet,
      amount: reverseAmount,
      type: reverseType,
      description: `Reversal of ${transaction.paymentId}`,
      paymentId: `REV${Date.now()}`,
      performedBy: req.user._id,
      referenceType: "admin",
      reason: "Transaction reversal",
      notes: `Reversal of transaction ID: ${transaction.paymentId}`,
      balanceAfter: newBalance,
    });

    await reverseTransaction.save();

    req.flash("success", MESSAGES.SUCCESS.TRANSACTION_REVERSED);
    res.status(HTTP_STATUS.OK).redirect("/admin/wallet");
  } catch (error) {
    console.error("Error reversing transaction:", error);
    req.flash("error", MESSAGES.ERROR.TRANSACTION_REVERSAL_FAILED);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect("/admin/wallet");
  }
};

//  functions
// Generate Excel file
const generateExcel = async (data, sheetName = "Data") => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.addRow(
      headers.map((header) => header.charAt(0).toUpperCase() + header.slice(1))
    );
  }

  // Add data rows
  data.forEach((item) => {
    worksheet.addRow(Object.values(item));
  });

  // Style headers
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0070C0" },
  };
  headerRow.font = {
    color: { argb: "FFFFFFFF" },
    bold: true,
  };

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = maxLength < 10 ? 10 : maxLength + 2;
  });

  return await workbook.xlsx.writeBuffer();
};

// Generate PDF file
const generatePDF = async (data, title = "Report") => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 30,
        size: "A4",
        layout: "landscape",
      });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Add title
      doc.fontSize(18).text(title, { align: "center" });
      doc.moveDown();

      // Add date
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, {
        align: "right",
      });
      doc.moveDown(2);

      // Add table headers
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const columnWidth = (doc.page.width - 60) / headers.length;

        // Draw header background
        doc
          .fillColor("#0070C0")
          .rect(30, doc.y, doc.page.width - 60, 20)
          .fill();

        // Draw header text
        doc.fillColor("white");
        let xPos = 35;
        headers.forEach((header) => {
          const displayHeader =
            header.charAt(0).toUpperCase() + header.slice(1);
          doc.text(displayHeader, xPos, doc.y - 15, {
            width: columnWidth,
            align: "left",
          });
          xPos += columnWidth;
        });
        doc.fillColor("black");
        doc.moveDown();

        // Add data rows
        let rowCount = 0;
        data.forEach((item) => {
          // Add alternating row background
          if (rowCount % 2 === 0) {
            doc
              .fillColor("#F2F2F2")
              .rect(30, doc.y, doc.page.width - 60, 15)
              .fill();
            doc.fillColor("black");
          }

          // Add row data
          let xPos = 35;
          Object.values(item).forEach((value) => {
            doc.fontSize(8).text(String(value), xPos, doc.y - 15, {
              width: columnWidth,
              align: "left",
            });
            xPos += columnWidth;
          });
          doc.moveDown(0.5);
          rowCount++;

          // Add a new page if needed
          if (doc.y > doc.page.height - 50 && rowCount < data.length) {
            doc.addPage();
            doc.moveDown();
          }
        });
      } else {
        doc.text("No data available", { align: "center" });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  getWalletDashboard,
  addWalletCredit,
  deductWalletBalance,
  getUserWalletInfo,
  exportWalletData,
  reverseTransaction,
};
