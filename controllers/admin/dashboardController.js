const Order = require("../../models/Order.js");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { name } = require("ejs");

// Main sales report page
const getSalesReport = async (req, res) => {
  try {
    const {
      reportType = "daily",
      singleDate = new Date().toISOString().split("T")[0],
      startDate,
      endDate,
      paymentMethod = "all",
      orderStatus = "all",
    } = req.query;

    const { start, end } = getDateRange(
      reportType,
      singleDate,
      startDate,
      endDate
    );

    const query = {
      createdAt: { $gte: start, $lte: end },
    };

    if (paymentMethod !== "all") {
      query.paymentMethod = paymentMethod;
    }

    if (orderStatus !== "all") {
      query.status = orderStatus;
    }

    const orders = await Order.find(query)
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    // totals
    const totalOrders = orders.length;
    const totalSubtotal = orders.reduce(
      (sum, order) => sum + order.totalPrice,
      0
    );
    const totalDiscounts = orders.reduce(
      (sum, order) => sum + order.discount,
      0
    );
    const totalRevenue = orders.reduce(
      (sum, order) => sum + order.finalAmount,
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const discountPercentage =
      totalSubtotal > 0
        ? ((totalDiscounts / totalSubtotal) * 100).toFixed(2)
        : 0;

    const chartData = prepareChartData(orders, reportType, start, end);

    chartData.totalRevenue = totalRevenue;
    chartData.totalDiscounts = totalDiscounts;

    const topSellingProducts = await getTopSellingProducts(start, end);

    res.render("admin/dashboard.ejs", {
      title: "Sales Report",
      orders,
      totalOrders,
      totalSubtotal,
      totalDiscounts,
      totalRevenue,
      averageOrderValue,
      discountPercentage,
      chartData,
      reportType,
      singleDate,
      startDate,
      endDate,
      paymentMethod,
      orderStatus,
      topProducts: topSellingProducts.products,
      topCategories: topSellingProducts.categories,
      topBrands: topSellingProducts.brands,
    });
  } catch (error) {
    console.error("Error generating sales report:", error);
    res.status(500).render("error", {
      message: "Error generating sales report",
      error,
    });
  }
};

//Top selling prducts
async function getTopSellingProducts(startDate, endDate) {
  const orders = await Order.find({
    createdAt: { $gte: startDate, $lte: endDate },
    status: { $ne: "cancelled" },
  }).populate({
    path: "orderedItems.product",
    populate: [{ path: "category", select: "name" }],
  });

  const productSales = {};
  const categorySales = {};
  const brandSales = {};

  orders.forEach((order) => {
    order.orderedItems.forEach((item) => {
      if (item.product) {
        const productId = item.product._id.toString();
        if (!productSales[productId]) {
          productSales[productId] = {
            _id: productId,
            name: item.product.productName,
            quantity: 0,
            revenue: 0,
            image: item.product.productImage || "",
          };
        }

        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue += item.price * item.quantity;

        if (item.product.category) {
          const categoryId = item.product.category._id.toString();
          if (!categorySales[categoryId]) {
            categorySales[categoryId] = {
              _id: categoryId,
              name: item.product.category.name,
              quantity: 0,
              revenue: 0,
            };
          }
          categorySales[categoryId].quantity += item.quantity;
          categorySales[categoryId].revenue += item.price * item.quantity;
        }

        if (item.product.brand) {
          const brandName = item.product.brand;
          if (!brandSales[brandName]) {
            brandSales[brandName] = {
              name: brandName,
              quantity: 0,
              revenue: 0,
            };
          }
          brandSales[brandName].quantity += item.quantity;
          brandSales[brandName].revenue += item.price * item.quantity;
        }
      }
    });
  });

  const products = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const categories = Object.values(categorySales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const brands = Object.values(brandSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return { products, categories, brands };
}

//chart data function
function prepareChartData(orders, reportType, startDate, endDate) {
  const chartData = {
    dates: [],
    revenue: [],
    paymentMethods: {},
    orderStatuses: {},
  };

  if (orders.length === 0) {
    return chartData;
  }
  const groupedData = {};

  let currentDate = new Date(startDate);
  const lastDate = new Date(endDate);

  let formatKey;
  let incrementDate;

  if (reportType === "daily") {
    formatKey = (date) => `${date.getHours()}:00`;
    incrementDate = (date) => date.setHours(date.getHours() + 1);

    for (let hour = 0; hour < 24; hour++) {
      const hourKey = `${hour}:00`;
      groupedData[hourKey] = { revenue: 0, count: 0 };
    }
  } else if (reportType === "weekly") {
    formatKey = (date) => date.toLocaleDateString();
    incrementDate = (date) => date.setDate(date.getDate() + 1);

    while (currentDate <= lastDate) {
      const dateKey = currentDate.toLocaleDateString();
      groupedData[dateKey] = { revenue: 0, count: 0 };
      currentDate = new Date(incrementDate(currentDate));
    }
  } else if (reportType === "monthly") {
    formatKey = (date) => date.toLocaleDateString();
    incrementDate = (date) => date.setDate(date.getDate() + 1);
    while (currentDate <= lastDate) {
      const dateKey = currentDate.toLocaleDateString();
      groupedData[dateKey] = { revenue: 0, count: 0 };
      currentDate = new Date(incrementDate(currentDate));
    }
  } else if (reportType === "yearly") {
    formatKey = (date) => `${date.getMonth() + 1}/${date.getFullYear()}`;
    incrementDate = (date) => date.setMonth(date.getMonth() + 1);

    currentDate = new Date(startDate.getFullYear(), 0, 1); // Start from January
    while (currentDate <= lastDate) {
      const dateKey = `${
        currentDate.getMonth() + 1
      }/${currentDate.getFullYear()}`;
      groupedData[dateKey] = { revenue: 0, count: 0 };
      currentDate = new Date(incrementDate(currentDate));
    }
  } else {
    formatKey = (date) => date.toLocaleDateString();
    incrementDate = (date) => date.setDate(date.getDate() + 1);

    while (currentDate <= lastDate) {
      const dateKey = currentDate.toLocaleDateString();
      groupedData[dateKey] = { revenue: 0, count: 0 };
      currentDate = new Date(incrementDate(currentDate));
    }
  }

  orders.forEach((order) => {
    const orderDate = new Date(order.createdAt);
    const dateKey = formatKey(orderDate);

    if (!groupedData[dateKey]) {
      groupedData[dateKey] = { revenue: 0, count: 0 };
    }

    groupedData[dateKey].revenue += order.finalAmount;
    groupedData[dateKey].count += 1;

    if (!chartData.paymentMethods[order.paymentMethod]) {
      chartData.paymentMethods[order.paymentMethod] = 0;
    }
    chartData.paymentMethods[order.paymentMethod]++;

    if (!chartData.orderStatuses[order.status]) {
      chartData.orderStatuses[order.status] = 0;
    }
    chartData.orderStatuses[order.status]++;
  });

  const sortedDates = Object.keys(groupedData).sort((a, b) => {
    if (reportType === "daily") {
      return parseInt(a) - parseInt(b);
    }
    return new Date(a) - new Date(b);
  });

  chartData.dates = sortedDates;
  chartData.revenue = sortedDates.map((date) => groupedData[date].revenue);
  chartData.orderCounts = sortedDates.map((date) => groupedData[date].count);

  return chartData;
}

// Export sales report
const exportSalesReport = async (req, res) => {
  try {
    const {
      reportType = "daily",
      singleDate = new Date().toISOString().split("T")[0],
      startDate,
      endDate,
      paymentMethod = "all",
      orderStatus = "all",
      format = "excel",
    } = req.query;

    // Get date range based on report type
    const { start, end } = getDateRange(
      reportType,
      singleDate,
      startDate,
      endDate
    );

    // Build query
    const query = {
      createdAt: { $gte: start, $lte: end },
    };

    // Add payment method filter if specified
    if (paymentMethod !== "all") {
      query.paymentMethod = paymentMethod;
    }

    // Add order status filter if specified
    if (orderStatus !== "all") {
      query.status = orderStatus;
    }

    // Fetch orders based on filters
    const orders = await Order.find(query)
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    // Calculate totals
    const totalOrders = orders.length;
    const totalSubtotal = orders.reduce(
      (sum, order) => sum + order.totalPrice,
      0
    );
    const totalDiscounts = orders.reduce(
      (sum, order) => sum + order.discount,
      0
    );
    const totalRevenue = orders.reduce(
      (sum, order) => sum + order.finalAmount,
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Format date range for filename
    let dateRangeStr;
    if (reportType === "custom") {
      dateRangeStr = `${startDate}_to_${endDate}`;
    } else {
      dateRangeStr = singleDate;
    }

    // Generate the appropriate file format
    if (format === "excel") {
      await exportToExcel(res, orders, {
        reportType,
        dateRange: dateRangeStr,
        totalOrders,
        totalSubtotal,
        totalDiscounts,
        totalRevenue,
        averageOrderValue,
      });
    } else if (format === "pdf") {
      await exportToPdf(res, orders, {
        reportType,
        dateRange: dateRangeStr,
        totalOrders,
        totalSubtotal,
        totalDiscounts,
        totalRevenue,
        averageOrderValue,
      });
    } else {
      return res.status(400).send("Invalid export format");
    }
  } catch (error) {
    console.error("Error exporting sales report:", error);
    res.status(500).send("Error exporting sales report");
  }
};

//function for date range
function getDateRange(reportType, singleDate, startDate, endDate) {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (reportType === "custom" && startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  } else if (singleDate) {
    start = new Date(singleDate);
    start.setHours(0, 0, 0, 0);

    if (reportType === "daily") {
      end = new Date(singleDate);
      end.setHours(23, 59, 59, 999); // Day end
    } else if (reportType === "weekly") {
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (reportType === "monthly") {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
      start.setHours(0, 0, 0, 0);

      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else if (reportType === "yearly") {
      start = new Date(start.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);

      end = new Date(start.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
    }
  } else {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

//function export to Excel
async function exportToExcel(res, orders, summary) {
  // Create a new Excel workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sales Report");

  // Add title
  worksheet.mergeCells("A1:I1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `Sales Report - ${summary.reportType.toUpperCase()}`;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "center" };

  // Add summary section
  worksheet.mergeCells("A2:I2");
  worksheet.getCell("A2").value = "Summary";
  worksheet.getCell("A2").font = { size: 12, bold: true };

  worksheet.getCell("A3").value = "Date Range:";
  worksheet.getCell("B3").value = summary.dateRange;

  worksheet.getCell("A4").value = "Total Orders:";
  worksheet.getCell("B4").value = summary.totalOrders;

  worksheet.getCell("A5").value = "Total Subtotal:";
  worksheet.getCell("B5").value = summary.totalSubtotal;
  worksheet.getCell("B5").numFmt = "₹#,##0.00";

  worksheet.getCell("A6").value = "Total Discounts:";
  worksheet.getCell("B6").value = summary.totalDiscounts;
  worksheet.getCell("B6").numFmt = "₹#,##0.00";

  worksheet.getCell("A7").value = "Total Revenue:";
  worksheet.getCell("B7").value = summary.totalRevenue;
  worksheet.getCell("B7").numFmt = "₹#,##0.00";

  worksheet.getCell("A8").value = "Average Order Value:";
  worksheet.getCell("B8").value = summary.averageOrderValue;
  worksheet.getCell("B8").numFmt = "₹#,##0.00";

  // Style summary section
  for (let i = 3; i <= 8; i++) {
    worksheet.getCell(`A${i}`).font = { bold: true };
  }

  // Add a gap
  worksheet.addRow([]);

  // Add order details header
  const headerRow = worksheet.addRow([
    "Order ID",
    "Date",
    "Customer",
    "Payment Method",
    "Status",
    "Items",
    "Subtotal",
    "Discount",
    "Total",
  ]);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center" };

  // Add header styling
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFCCCCCC" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Add order data
  orders.forEach((order) => {
    const items = order.items ? order.items.length : 0;
    const row = worksheet.addRow([
      order._id.toString(),
      new Date(order.createdAt).toLocaleString(),
      order.userId ? order.userId.name : "Guest",
      order.paymentMethod,
      order.status,
      items,
      order.totalPrice,
      order.discount,
      order.finalAmount,
    ]);

    // Format currency cells
    row.getCell(7).numFmt = "₹#,##0.00"; // Subtotal
    row.getCell(8).numFmt = "₹#,##0.00"; // Discount
    row.getCell(9).numFmt = "₹#,##0.00"; // Total

    // Add alternating row colors
    if (worksheet.rowCount % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEEEEEE" },
        };
      });
    }
  });

  // Adjust column widths
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = Math.min(maxLength + 2, 30);
  });

  // Set response headers for file download
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=sales_report_${summary.dateRange}.xlsx`
  );

  // Write to response
  await workbook.xlsx.write(res);
}

//export to PDF
async function exportToPdf(res, orders, summary) {
  // Create a new PDF document
  const doc = new PDFDocument({ margin: 50 });

  const fontPath = path.join(
    "public",
    "assets",
    "fonts",
    "NotoSans-Regular.ttf"
  );
  doc.registerFont("Unicode", fontPath);
  doc.font("Unicode");

  // Set response headers for file download
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=sales_report_${summary.dateRange}.pdf`
  );

  // Pipe the PDF document to the response
  doc.pipe(res);

  // Add title
  doc
    .fontSize(18)
    .font("Unicode")
    .text(`Sales Report - ${summary.reportType.toUpperCase()}`, {
      align: "center",
    });
  doc.moveDown();

  // Add summary section
  doc.fontSize(14).font("Unicode").text("Summary", { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(12).font("Unicode");
  doc.text(`Date Range: ${summary.dateRange}`);
  doc.text(`Total Orders: ${summary.totalOrders}`);
  doc.text(`Total Subtotal: ₹${summary.totalSubtotal.toFixed(2)}`);
  doc.text(`Total Discounts: ₹${summary.totalDiscounts.toFixed(2)}`);
  doc.text(`Total Revenue: ₹${summary.totalRevenue.toFixed(2)}`);
  doc.text(`Average Order Value: ₹${summary.averageOrderValue.toFixed(2)}`);
  doc.moveDown(2);

  // Add orders table
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("Order Details", { underline: true });
  doc.moveDown();

  // Define table columns
  const tableTop = doc.y;
  const tableColumns = ["Order ID", "Date", "Customer", "Status", "Total"];
  const columnWidths = [100, 100, 120, 80, 80];
  let currentLeft = 50; // starting from left margin

  // Draw table header
  doc.fontSize(10).font("Unicode");
  tableColumns.forEach((column, i) => {
    doc.text(column, currentLeft, tableTop, {
      width: columnWidths[i],
      align: "left",
    });
    currentLeft += columnWidths[i];
  });

  const headerHeight = 20;
  doc
    .moveTo(50, tableTop - 5)
    .lineTo(
      50 + columnWidths.reduce((sum, width) => sum + width, 0),
      tableTop - 5
    )
    .stroke();

  doc
    .moveTo(50, tableTop + headerHeight)
    .lineTo(
      50 + columnWidths.reduce((sum, width) => sum + width, 0),
      tableTop + headerHeight
    )
    .stroke();

  // Draw table rows
  let rowTop = tableTop + headerHeight + 5;
  doc.fontSize(9).font("Unicode");

  // Function to check if we need a new page
  const checkNewPage = (y, height = 20) => {
    if (y + height > doc.page.height - 50) {
      doc.addPage();
      rowTop = 50;
      return 50;
    }
    return y;
  };

  // Add order data
  orders.forEach((order, index) => {
    // Check if we need a new page
    rowTop = checkNewPage(rowTop);

    // Format date
    const orderDate = new Date(order.createdAt).toLocaleDateString();

    // Draw row
    currentLeft = 50;
    [
      order._id.toString().substring(0, 8) + "...",
      orderDate,
      order.userId ? order.userId.name : "Guest",
      order.status,
      `₹${order.finalAmount.toFixed(2)}`,
    ].forEach((text, i) => {
      doc.text(text, currentLeft, rowTop, {
        width: columnWidths[i],
        align: "left",
      });
      currentLeft += columnWidths[i];
    });

    // Add row separator
    rowTop += 20;
    doc
      .moveTo(50, rowTop)
      .lineTo(50 + columnWidths.reduce((sum, width) => sum + width, 0), rowTop)
      .stroke();

    // Move down for the next row
    rowTop += 5;
  });

  // Finalize the PDF and end the stream
  doc.end();
}

// Add export endpoint for detailed order report
exports.exportOrderDetails = async (req, res) => {
  try {
    const { orderId, format = "excel" } = req.params;

    // Find the order
    const order = await Order.findById(orderId)
      .populate("userId", "name email")
      .populate("items.productId");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    // Generate the report based on format
    if (format === "excel") {
      await exportOrderToExcel(res, order);
    } else if (format === "pdf") {
      await exportOrderToPdf(res, order);
    } else {
      return res.status(400).send("Invalid export format");
    }
  } catch (error) {
    console.error("Error exporting order details:", error);
    res.status(500).send("Error exporting order details");
  }
};

// Helper function to export a single order to Excel
async function exportOrderToExcel(res, order) {
  // Create a new Excel workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Order Details");

  // Add title
  worksheet.mergeCells("A1:F1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `Order Details - ${order._id}`;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "center" };

  // Add order information
  worksheet.getCell("A3").value = "Order ID:";
  worksheet.getCell("B3").value = order._id.toString();

  worksheet.getCell("A4").value = "Date:";
  worksheet.getCell("B4").value = new Date(order.createdAt).toLocaleString();

  worksheet.getCell("A5").value = "Customer:";
  worksheet.getCell("B5").value = order.userId ? order.userId.name : "Guest";

  worksheet.getCell("A6").value = "Email:";
  worksheet.getCell("B6").value = order.userId
    ? order.userId.email
    : order.guestEmail || "";

  worksheet.getCell("A7").value = "Shipping Address:";
  worksheet.getCell("B7").value = order.shippingAddress
    ? `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`
    : "";

  worksheet.getCell("A8").value = "Payment Method:";
  worksheet.getCell("B8").value = order.paymentMethod;

  worksheet.getCell("A9").value = "Status:";
  worksheet.getCell("B9").value = order.status;

  // Style order info
  for (let i = 3; i <= 9; i++) {
    worksheet.getCell(`A${i}`).font = { bold: true };
  }

  // Add a gap
  worksheet.addRow([]);

  // Add items section title
  worksheet.mergeCells("A11:F11");
  worksheet.getCell("A11").value = "Order Items";
  worksheet.getCell("A11").font = { size: 14, bold: true };
  worksheet.getCell("A11").alignment = { horizontal: "center" };

  // Add items header
  const headerRow = worksheet.addRow([
    "Product ID",
    "Product Name",
    "Price",
    "Quantity",
    "Discount",
    "Total",
  ]);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center" };

  // Style header
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFCCCCCC" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Add items data
  order.items.forEach((item) => {
    const productName = item.productId
      ? item.productId.name
      : item.productName || "Unknown Product";
    const row = worksheet.addRow([
      item.productId ? item.productId._id.toString() : "N/A",
      productName,
      item.price,
      item.quantity,
      item.discount || 0,
      item.price * item.quantity - (item.discount || 0),
    ]);

    // currency cells
    row.getCell(3).numFmt = "₹#,##0.00"; // Price
    row.getCell(5).numFmt = "₹#,##0.00"; // Discount
    row.getCell(6).numFmt = "₹#,##0.00"; // Total
  });

  // Add totals
  const lastRow = worksheet.rowCount + 2;
  worksheet.getCell(`D${lastRow}`).value = "Subtotal:";
  worksheet.getCell(`F${lastRow}`).value = order.totalPrice;
  worksheet.getCell(`F${lastRow}`).numFmt = "₹#,##0.00";

  worksheet.getCell(`D${lastRow + 1}`).value = "Discount:";
  worksheet.getCell(`F${lastRow + 1}`).value = order.discount;
  worksheet.getCell(`F${lastRow + 1}`).numFmt = "₹#,##0.00";

  worksheet.getCell(`D${lastRow + 2}`).value = "Shipping:";
  worksheet.getCell(`F${lastRow + 2}`).value = order.shippingCost || 0;
  worksheet.getCell(`F${lastRow + 2}`).numFmt = "₹#,##0.00";

  worksheet.getCell(`D${lastRow + 3}`).value = "Total:";
  worksheet.getCell(`F${lastRow + 3}`).value = order.finalAmount;
  worksheet.getCell(`F${lastRow + 3}`).numFmt = "₹#,##0.00";
  worksheet.getCell(`D${lastRow + 3}`).font = { bold: true };
  worksheet.getCell(`F${lastRow + 3}`).font = { bold: true };

  // column widths
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = Math.min(maxLength + 2, 30);
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=order_${order._id}.xlsx`
  );

  await workbook.xlsx.write(res);
}

//export to pdf
async function exportOrderToPdf(res, order) {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=order_${order._id}.pdf`
  );

  doc.pipe(res);

  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .text(`Order Details - ${order._id}`, { align: "center" });
  doc.moveDown();

  doc.fontSize(12).font("Helvetica");

  const addKeyValue = (key, value) => {
    doc.font("Helvetica-Bold").text(key, { continued: true });
    doc.font("Helvetica").text(`: ${value}`);
  };

  addKeyValue("Order ID", order._id.toString());
  addKeyValue("Date", new Date(order.createdAt).toLocaleString());
  addKeyValue("Customer", order.userId ? order.userId.name : "Guest");
  addKeyValue(
    "Email",
    order.userId ? order.userId.email : order.guestEmail || ""
  );

  if (order.shippingAddress) {
    addKeyValue(
      "Shipping Address",
      `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`
    );
  }

  addKeyValue("Payment Method", order.paymentMethod);
  addKeyValue("Status", order.status);

  doc.moveDown(2);

  // Add items section title
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("Order Items", { align: "center" });
  doc.moveDown();

  // Define table columns
  const tableTop = doc.y;
  const tableColumns = ["Product", "Price", "Qty", "Total"];
  const columnWidths = [220, 100, 50, 100];
  let currentLeft = 50;

  // Draw table header
  doc.fontSize(10).font("Helvetica-Bold");
  tableColumns.forEach((column, i) => {
    doc.text(column, currentLeft, tableTop, {
      width: columnWidths[i],
      align: "left",
    });
    currentLeft += columnWidths[i];
  });

  const headerHeight = 20;
  doc
    .moveTo(50, tableTop - 5)
    .lineTo(
      50 + columnWidths.reduce((sum, width) => sum + width, 0),
      tableTop - 5
    )
    .stroke();

  doc
    .moveTo(50, tableTop + headerHeight)
    .lineTo(
      50 + columnWidths.reduce((sum, width) => sum + width, 0),
      tableTop + headerHeight
    )
    .stroke();

  // table rows
  let rowTop = tableTop + headerHeight + 5;
  doc.fontSize(9).font("Helvetica");
  order.items.forEach((item) => {
    const productName = item.productId
      ? item.productId.name
      : item.productName || "Unknown Product";
    const total = item.price * item.quantity - (item.discount || 0);

    // Draw row
    currentLeft = 50;
    [
      productName,
      `₹${item.price.toFixed(2)}`,
      item.quantity,
      `₹${total.toFixed(2)}`,
    ].forEach((text, i) => {
      doc.text(text, currentLeft, rowTop, {
        width: columnWidths[i],
        align: "left",
      });
      currentLeft += columnWidths[i];
    });

    rowTop += 20;
    doc
      .moveTo(50, rowTop)
      .lineTo(50 + columnWidths.reduce((sum, width) => sum + width, 0), rowTop)
      .stroke();

    rowTop += 5;
  });

  rowTop += 10;
  const totalsX = 50 + columnWidths[0] + columnWidths[1] + columnWidths[2];
  const labelsX = totalsX - 100;

  doc.fontSize(10).font("Helvetica-Bold").text("Subtotal:", labelsX, rowTop);
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`₹${order.totalPrice.toFixed(2)}`, totalsX, rowTop);

  rowTop += 20;
  doc.fontSize(10).font("Helvetica-Bold").text("Discount:", labelsX, rowTop);
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`₹${order.discount.toFixed(2)}`, totalsX, rowTop);

  rowTop += 20;
  doc.fontSize(10).font("Helvetica-Bold").text("Shipping:", labelsX, rowTop);
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`₹${(order.shippingCost || 0).toFixed(2)}`, totalsX, rowTop);

  rowTop += 20;
  doc.fontSize(12).font("Helvetica-Bold").text("Total:", labelsX, rowTop);
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`₹${order.finalAmount.toFixed(2)}`, totalsX, rowTop);

  // Add footer
  doc
    .fontSize(8)
    .font("Helvetica")
    .text(
      `Generated on ${new Date().toLocaleString()}`,
      50,
      doc.page.height - 50,
      { align: "center" }
    );

  doc.end();
}

module.exports = {
  getSalesReport,
  exportSalesReport,
};
