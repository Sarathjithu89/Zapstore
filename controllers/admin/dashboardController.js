const Order = require("../../models/Order.js");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const HTTP_STATUS = require("../../config/statusCodes.js");
const MESSAGES = require("../../config/adminMessages.js");

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

    res.status(HTTP_STATUS.OK).render("admin/dashboard.ejs", {
      title: "Sales Report",
      message: MESSAGES.SUCCESS.SALES_REPORT_GENERATED,
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("error", {
      message: MESSAGES.ERROR.REPORT_GENERATION_FAILED,
      error,
    });
  }
};

//Top selling products
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

//Chart data function
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

    if (orders.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        message: MESSAGES.INFO.NO_ORDERS,
      });
    }

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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: "Invalid export format",
      });
    }
  } catch (error) {
    console.error("Error exporting sales report:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGES.ERROR.REPORT_EXPORT_FAILED,
      error: error.message,
    });
  }
};

//Function for date range
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

//Function export to Excel
async function exportToExcel(res, orders, summary) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    // title
    worksheet.mergeCells("A1:I1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = `Sales Report - ${summary.reportType.toUpperCase()}`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: "center" };

    //summary section
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

    //Style summary section
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
  } catch (error) {
    console.error("Error generating Excel export:", error);
    throw new Error("Failed to generate Excel export");
  }
}

//Export to PDF
async function exportToPdf(res, orders, summary) {
  try {
    // Create a new PDF document (explicitly set to portrait)
    const doc = new PDFDocument({ margin: 50, layout: "portrait" });

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
    doc.fontSize(14).font("Unicode").text("Order Details", { underline: true });
    doc.moveDown();

    // Define table columns - UPDATED to include Payment Method and Discount
    const tableTop = doc.y;
    const tableColumns = [
      "Order ID",
      "Date",
      "Customer",
      "Payment Method",
      "Status",
      "Discount",
      "Total",
    ];
    // Adjusted column widths to fit payment method and discount while maintaining portrait layout
    const columnWidths = [70, 70, 80, 75, 60, 60, 65];
    let currentLeft = 50; // starting from left margin

    // Draw table header
    doc.fontSize(9).font("Unicode");
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
    doc.fontSize(8).font("Unicode");

    // Function to check if we need a new page
    const checkNewPage = (y, height = 20) => {
      if (y + height > doc.page.height - 50) {
        doc.addPage();

        // Add column headers to new page
        doc.fontSize(9).font("Unicode");
        let headerLeft = 50;
        tableColumns.forEach((column, i) => {
          doc.text(column, headerLeft, 50, {
            width: columnWidths[i],
            align: "left",
          });
          headerLeft += columnWidths[i];
        });

        // Add header line
        doc
          .moveTo(50, 45)
          .lineTo(50 + columnWidths.reduce((sum, width) => sum + width, 0), 45)
          .stroke();

        doc
          .moveTo(50, 70)
          .lineTo(50 + columnWidths.reduce((sum, width) => sum + width, 0), 70)
          .stroke();

        doc.fontSize(8).font("Unicode");
        return 75; // Start content after header
      }
      return y;
    };

    // Add order data
    orders.forEach((order, index) => {
      // Check if we need a new page
      rowTop = checkNewPage(rowTop);

      // Format date
      const orderDate = new Date(order.createdAt).toLocaleDateString();

      // Draw row - UPDATED to include payment method and discount
      currentLeft = 50;
      [
        order._id.toString().substring(0, 6) + "...",
        orderDate,
        order.userId
          ? order.userId.name.length > 10
            ? order.userId.name.substring(0, 10) + "..."
            : order.userId.name
          : "Guest",
        order.paymentMethod,
        order.status,
        `₹${order.discount.toFixed(2)}`,
        `₹${order.finalAmount.toFixed(2)}`,
      ].forEach((text, i) => {
        doc.text(text, currentLeft, rowTop, {
          width: columnWidths[i],
          align: i >= 5 ? "right" : "left", // Right align monetary values
        });
        currentLeft += columnWidths[i];
      });

      // Add row separator
      rowTop += 20;
      doc
        .moveTo(50, rowTop)
        .lineTo(
          50 + columnWidths.reduce((sum, width) => sum + width, 0),
          rowTop
        )
        .stroke();

      // Move down for the next row
      rowTop += 5;
    });

    // Add footer with totals
    rowTop = checkNewPage(rowTop + 10);

    const totalsStartX =
      50 +
      columnWidths[0] +
      columnWidths[1] +
      columnWidths[2] +
      columnWidths[3] +
      columnWidths[4];

    doc.fontSize(9).font("Unicode");
    doc.text("Total Orders:", totalsStartX - 100, rowTop);
    doc.text(`${summary.totalOrders}`, totalsStartX, rowTop);

    rowTop += 15;
    doc.text("Total Subtotal:", totalsStartX - 100, rowTop);
    doc.text(`₹${summary.totalSubtotal.toFixed(2)}`, totalsStartX, rowTop);

    rowTop += 15;
    doc.text("Total Discounts:", totalsStartX - 100, rowTop);
    doc.text(`₹${summary.totalDiscounts.toFixed(2)}`, totalsStartX, rowTop);

    rowTop += 15;
    doc.fontSize(10).font("Unicode");
    doc.text("Total Revenue:", totalsStartX - 100, rowTop);
    doc.text(`₹${summary.totalRevenue.toFixed(2)}`, totalsStartX, rowTop);

    // Add generation timestamp
    doc
      .fontSize(8)
      .font("Unicode")
      .text(
        `Generated on ${new Date().toLocaleString()}`,
        50,
        doc.page.height - 30,
        { align: "center" }
      );

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error("Error generating PDF export:", error);
    throw new Error("Failed to generate PDF export");
  }
}

// detailed order report
const exportOrderDetails = async (req, res) => {
  try {
    const { orderId, format = "excel" } = req.params;

    // Find the order
    const order = await Order.findById(orderId)
      .populate("userId", "name email")
      .populate("items.productId");

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        message: MESSAGES.ERROR.ORDER_NOT_FOUND,
      });
    }

    // Generate the report based on format
    if (format === "excel") {
      await exportOrderToExcel(res, order);
    } else if (format === "pdf") {
      await exportOrderToPdf(res, order);
    } else {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: "Invalid export format",
      });
    }
  } catch (error) {
    console.error("Error exporting order details:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGES.ERROR.ORDERS_EXPORT_FAILED,
      error: error.message,
    });
  }
};

//function to export to excel
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
  const doc = new PDFDocument({ margin: 50, layout: "portrait" });

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
    `attachment; filename=order_${order._id}.pdf`
  );

  doc.pipe(res);

  doc
    .fontSize(18)
    .font("Unicode")
    .text(`Order Details - ${order._id}`, { align: "center" });
  doc.moveDown();

  // Create info section with two columns
  doc.fontSize(12).font("Unicode");
  const leftColumnX = 50;
  const rightColumnX = 300;
  let yPosition = doc.y;

  // Left column - Order info
  doc.font("Unicode").text("Order Information", leftColumnX, yPosition);
  doc.moveDown(0.5);

  const addLeftColumnInfo = (key, value) => {
    doc.font("Unicode").text(key, leftColumnX, doc.y, { continued: true });
    doc.font("Unicode").text(`: ${value}`);
  };

  addLeftColumnInfo("Order ID", order._id.toString());
  addLeftColumnInfo("Date", new Date(order.createdAt).toLocaleString());
  addLeftColumnInfo("Payment Method", order.paymentMethod);
  addLeftColumnInfo("Status", order.status);

  // Right column - Customer info
  doc.font("Unicode").text("Customer Information", rightColumnX, yPosition);
  const rightColumnY = doc.y - (doc.y - yPosition); // Reset Y to match left column
  doc.y = rightColumnY + doc.currentLineHeight(true);

  const addRightColumnInfo = (key, value) => {
    doc.font("Unicode").text(key, rightColumnX, doc.y, { continued: true });
    doc.font("Unicode").text(`: ${value}`);
  };

  addRightColumnInfo("Customer", order.userId ? order.userId.name : "Guest");
  addRightColumnInfo(
    "Email",
    order.userId ? order.userId.email : order.guestEmail || ""
  );

  if (order.shippingAddress) {
    const address = `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`;
    addRightColumnInfo("Shipping Address", address);
  }

  // Make sure we use the position of the column that extends furthest down
  doc.moveDown(2);

  // Add items section title with horizontal line
  const itemsSectionY = doc.y;
  doc
    .moveTo(50, itemsSectionY - 10)
    .lineTo(550, itemsSectionY - 10)
    .stroke();
  doc.fontSize(14).font("Unicode").text("Order Items", { align: "center" });
  doc.moveDown();

  // Define table columns
  const tableTop = doc.y;
  const tableColumns = ["Product", "Price", "Qty", "Discount", "Total"];
  const columnWidths = [220, 80, 50, 80, 80];
  let currentLeft = 50;

  // Draw table header
  doc.fontSize(10).font("Unicode");
  tableColumns.forEach((column, i) => {
    doc.text(column, currentLeft, tableTop, {
      width: columnWidths[i],
      align: i >= 3 ? "right" : "left",
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
  doc.fontSize(9).font("Unicode");
  order.items.forEach((item) => {
    const productName = item.productId
      ? item.productId.name
      : item.productName || "Unknown Product";
    const itemDiscount = item.discount || 0;
    const total = item.price * item.quantity - itemDiscount;

    // Check if we need a new page
    if (rowTop + 20 > doc.page.height - 100) {
      doc.addPage();
      rowTop = 50;

      // Add column headers to new page
      doc.fontSize(10).font("Unicode");
      let headerLeft = 50;
      tableColumns.forEach((column, i) => {
        doc.text(column, headerLeft, rowTop, {
          width: columnWidths[i],
          align: i >= 3 ? "right" : "left",
        });
        headerLeft += columnWidths[i];
      });

      rowTop += headerHeight;
      doc
        .moveTo(50, rowTop)
        .lineTo(
          50 + columnWidths.reduce((sum, width) => sum + width, 0),
          rowTop
        )
        .stroke();

      rowTop += 5;
      doc.fontSize(9).font("Unicode");
    }

    // Draw row
    let cellX = 50;

    // Product name (truncate if too long)
    const displayName =
      productName.length > 40
        ? productName.substring(0, 37) + "..."
        : productName;
    doc.text(displayName, cellX, rowTop, {
      width: columnWidths[0],
      align: "left",
    });
    cellX += columnWidths[0];

    // Price
    doc.text(`₹${item.price.toFixed(2)}`, cellX, rowTop, {
      width: columnWidths[1],
      align: "right",
    });
    cellX += columnWidths[1];

    // Quantity
    doc.text(item.quantity.toString(), cellX, rowTop, {
      width: columnWidths[2],
      align: "center",
    });
    cellX += columnWidths[2];

    // Discount
    doc.text(`₹${itemDiscount.toFixed(2)}`, cellX, rowTop, {
      width: columnWidths[3],
      align: "right",
    });
    cellX += columnWidths[3];

    // Total
    doc.text(`₹${total.toFixed(2)}`, cellX, rowTop, {
      width: columnWidths[4],
      align: "right",
    });

    rowTop += 20;
    doc
      .moveTo(50, rowTop)
      .lineTo(50 + columnWidths.reduce((sum, width) => sum + width, 0), rowTop)
      .stroke();

    rowTop += 5;
  });

  rowTop += 10;

  // Calculate width of all columns except the last one
  const sumOfPrecedingWidths = columnWidths
    .slice(0, -1)
    .reduce((sum, width) => sum + width, 0);
  const totalsX = 50 + sumOfPrecedingWidths;
  const labelsX = totalsX - 100;

  doc.fontSize(10).font("Unicode").text("Subtotal:", labelsX, rowTop);
  doc
    .fontSize(10)
    .font("Unicode")
    .text(`₹${order.totalPrice.toFixed(2)}`, totalsX, rowTop, {
      align: "right",
      width: columnWidths[4],
    });

  rowTop += 20;
  doc.fontSize(10).font("Unicode").text("Discount:", labelsX, rowTop);
  doc
    .fontSize(10)
    .font("Unicode")
    .text(`₹${order.discount.toFixed(2)}`, totalsX, rowTop, {
      align: "right",
      width: columnWidths[4],
    });

  rowTop += 20;
  doc.fontSize(10).font("Unicode").text("Shipping:", labelsX, rowTop);
  doc
    .fontSize(10)
    .font("Unicode")
    .text(`₹${(order.shippingCost || 0).toFixed(2)}`, totalsX, rowTop, {
      align: "right",
      width: columnWidths[4],
    });

  rowTop += 20;
  doc.fontSize(12).font("Unicode").text("Total:", labelsX, rowTop);
  doc
    .fontSize(12)
    .font("Unicode")
    .text(`₹${order.finalAmount.toFixed(2)}`, totalsX, rowTop, {
      align: "right",
      width: columnWidths[4],
    });

  // Add horizontal line
  rowTop += 30;
  doc.moveTo(50, rowTop).lineTo(550, rowTop).stroke();

  // Payment information section
  rowTop += 15;
  doc.fontSize(10).font("Unicode").text("Payment Information", 50, rowTop);
  rowTop += 15;
  doc
    .fontSize(9)
    .font("Unicode")
    .text("Method:", 50, rowTop, { continued: true });
  doc.font("Unicode").text(` ${order.paymentMethod}`);

  if (order.paymentStatus) {
    rowTop += 15;
    doc
      .fontSize(9)
      .font("Unicode")
      .text("Status:", 50, rowTop, { continued: true });
    doc.font("Unicode").text(` ${order.paymentStatus}`);
  }

  if (order.transactionId) {
    rowTop += 15;
    doc
      .fontSize(9)
      .font("Unicode")
      .text("Transaction ID:", 50, rowTop, { continued: true });
    doc.font("Unicode").text(` ${order.transactionId}`);
  }

  // Add footer
  doc
    .fontSize(8)
    .font("Unicode")
    .text(
      `Generated on ${new Date().toLocaleString()}`,
      50,
      doc.page.height - 30,
      { align: "center" }
    );

  doc.end();
}

module.exports = {
  getSalesReport,
  exportSalesReport,
  exportOrderDetails,
};
