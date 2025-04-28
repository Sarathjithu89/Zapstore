const Wallet = require("../../models/Wallet.js");
const Transaction = require("../../models/Transactions.js");
const User = require("../../models/User.js");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

// Dashboard - GET /admin/wallet
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

    // Build query based on filters
    let walletQuery = {};
    let transactionQuery = {};

    // User filter
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

    // Balance range filter
    if (filterType === "balance") {
      if (minBalance !== "") {
        walletQuery.balance = { $gte: Number(minBalance) };
      }
      if (maxBalance !== "") {
        walletQuery.balance = walletQuery.balance || {};
        walletQuery.balance.$lte = Number(maxBalance);
      }
    }

    // Transaction type filter
    if (transactionType !== "all") {
      transactionQuery.type = transactionType;
    }

    // Date range filter
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

    // Get wallet statistics
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

    // Fetch transactions with pagination
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
          transactionId: { $toString: "$_id" }, // Using _id as transactionId
          type: 1,
          amount: 1,
          balanceAfter: "$walletDetails.balance", // Note: This is the current balance, not after transaction
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

    // Get top wallet users
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

    // Prepare chart data for visualization
    // You'll need to implement this function based on your requirements
    const chartData = await getChartData(transactionQuery);

    // Calculate active wallet percentage
    const totalUsers = await User.countDocuments();
    const activeWalletPercentage = Math.round(
      (activeWallets / totalUsers) * 100
    );

    const totalPages=Math.ceil(totalTransactions/limit)

    const queryString = new URLSearchParams({
      filterType,
      userId,
      minBalance: minBalance || '',
      maxBalance: maxBalance || '',
      transactionType,
      dateRange,
      startDate: startDate || '',
      endDate: endDate || ''
    }).toString();

    // Send response
    res.render("admin/wallet", {
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
      query:queryString,
    });
  } catch (error) {
    console.error("Error in wallet dashboard:", error);
    req.flash("error", "Failed to load wallet data");
    res.redirect("/admin/dashboard");
  }
};

// Get chart data for wallet transactions
async function getChartData(baseQuery = {}) {
  try {
    // Dates for chart (last 30 days)
    const dates = [];
    const credits = [];
    const debits = [];

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Create array of 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(
        date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      );

      // Date range for this data point
      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      // Get credits for this day
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

      // Get debits for this day
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

    // Transaction summary by type
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

// Add credit to wallet
const addWalletCredit = async (req, res) => {
  try {
    const { email, amount, reason, notes } = req.body;
    const amountValue = parseFloat(amount);

    if (!email || !amountValue || amountValue <= 0) {
      req.flash("error", "Valid email and amount are required");
      return res.redirect("/admin/wallet");
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/admin/wallet");
    }

    // Find or create wallet
    let wallet = await Wallet.findOne({ user: user._id });
    if (!wallet) {
      wallet = new Wallet({ user: user._id, balance: 0 });
      await wallet.save();

      // Update user with wallet reference
      user.wallet = wallet._id;
      await user.save();
    }

    // Add credit
    const newBalance = wallet.balance + amountValue;
    wallet.balance = newBalance;
    await wallet.save();

    // Create transaction record
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

    req.flash("success", `₹${amountValue} credited to ${user.name}'s wallet`);
    res.redirect("/admin/wallet");
  } catch (error) {
    console.error("Error adding credit:", error);
    req.flash("error", "Failed to add credit");
    res.redirect("/admin/wallet");
  }
};

// Deduct balance from wallet
const deductWalletBalance = async (req, res) => {
  try {
    const { email, amount, reason, notes } = req.body;
    const amountValue = parseFloat(amount);

    if (!email || !amountValue || amountValue <= 0) {
      req.flash("error", "Valid email and amount are required");
      return res.redirect("/admin/wallet");
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/admin/wallet");
    }

    // Find wallet
    const wallet = await Wallet.findOne({ user: user._id });
    if (!wallet) {
      req.flash("error", "User has no wallet");
      return res.redirect("/admin/wallet");
    }

    // Check if sufficient balance
    if (wallet.balance < amountValue) {
      req.flash("error", "Insufficient wallet balance");
      return res.redirect("/admin/wallet");
    }

    // Deduct amount
    const newBalance = wallet.balance - amountValue;
    wallet.balance = newBalance;
    await wallet.save();

    // Create transaction record
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

    req.flash("success", `₹${amountValue} deducted from ${user.name}'s wallet`);
    res.redirect("/admin/wallet");
  } catch (error) {
    console.error("Error deducting balance:", error);
    req.flash("error", "Failed to deduct balance");
    res.redirect("/admin/wallet");
  }
};
// Get user wallet info - GET /admin/api/user-wallet-info
const getUserWalletInfo = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const wallet = await Wallet.findOne({ user: user._id });

    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        walletBalance: wallet ? wallet.balance : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching user wallet info:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Export wallet data - GET /admin/export-wallet-data
const exportWalletData = async (req, res) => {
  try {
    const { format, ...filters } = req.query;

    // Build query based on filters (same logic as in getWalletDashboard)
    let query = {};
    // ... [same filter logic as the dashboard function]

    // Get transactions based on filters
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

    // Format data for export
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
      return res.send(buffer);
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
      return res.send(buffer);
    } else {
      return res.status(400).json({ error: "Invalid export format" });
    }
  } catch (error) {
    console.error("Error exporting wallet data:", error);
    req.flash("error", "Failed to export wallet data");
    res.redirect("/admin/wallet");
  }
};

// Reverse transaction - GET /admin/wallet/reverse-transaction/:id
const reverseTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the transaction to reverse
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      req.flash("error", "Transaction not found");
      return res.redirect("/admin/wallet");
    }

    // Check if transaction is less than 24 hours old and is an admin action
    const isRecent = transaction.createdAt > Date.now() - 24 * 60 * 60 * 1000;
    if (!isRecent || transaction.referenceType !== "admin") {
      req.flash(
        "error",
        "Only recent administrative transactions can be reversed"
      );
      return res.redirect("/admin/wallet");
    }

    // Find the wallet
    const wallet = await Wallet.findOne({ user: transaction.wallet });
    if (!wallet) {
      req.flash("error", "Wallet not found");
      return res.redirect("/admin/wallet");
    }

    // Calculate new balance based on transaction type
    let newBalance = wallet.balance;
    let reverseType;
    let reverseAmount = transaction.amount;

    if (transaction.type === "credit" || transaction.type === "refund") {
      // If it was a credit, we need to deduct
      newBalance -= transaction.amount;
      reverseType = "debit";

      // Check if sufficient balance
      if (newBalance < 0) {
        req.flash(
          "error",
          "Cannot reverse credit: Insufficient wallet balance"
        );
        return res.redirect("/admin/wallet");
      }
    } else {
      // If it was a debit or payment, we need to add back
      newBalance += transaction.amount;
      reverseType = "credit";
    }

    // Update wallet balance
    wallet.balance = newBalance;
    await wallet.save();

    // Create reverse transaction
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

    req.flash("success", "Transaction successfully reversed");
    res.redirect("/admin/wallet");
  } catch (error) {
    console.error("Error reversing transaction:", error);
    req.flash("error", "Failed to reverse transaction");
    res.redirect("/admin/wallet");
  }
};

//functions
// Generate Excel file
const generateExcel = async (data, sheetName = "Data") => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Add headers
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
