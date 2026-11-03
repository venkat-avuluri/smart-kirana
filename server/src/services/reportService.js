import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import SaleReturn from '../models/SaleReturn.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Customer from '../models/Customer.js';
import CustomerTransaction from '../models/CustomerTransaction.js';
import Supplier from '../models/Supplier.js';
import SupplierTransaction from '../models/SupplierTransaction.js';
import Purchase from '../models/Purchase.js';
import InventoryTransaction from '../models/InventoryTransaction.js';

/**
 * Report & Analytics Service
 * Pure database-driven financial analytics in integer paise
 */

/**
 * Helper to compute start and end dates from preset ranges
 */
export const parseDateRange = (range = 'thismonth', customStart = null, customEnd = null) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  switch (range.toLowerCase()) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'yesterday':
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;

    case 'last7days':
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'last30days':
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'thismonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'previousmonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;

    case 'custom':
      if (customStart) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      }
      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      } else {
        end.setHours(23, 59, 59, 999);
      }
      break;

    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
};

/**
 * Unified Admin Business Dashboard Summary
 */
export const getBusinessDashboardSummary = async ({ range = 'thismonth', startDate, endDate }) => {
  const { start, end } = parseDateRange(range, startDate, endDate);

  // 1. Sales & Revenue Aggregation (Exclude VOIDED sales)
  const salesMatch = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: 'VOIDED' },
  };

  const [salesAgg, returnsAgg, voidedAgg] = await Promise.all([
    Sale.aggregate([
      { $match: salesMatch },
      {
        $group: {
          _id: null,
          totalRevenuePaise: { $sum: '$finalAmountPaise' },
          totalSubtotalPaise: { $sum: '$subtotalPaise' },
          totalDiscountPaise: { $sum: '$discountPaise' },
          completedBillsCount: { $sum: 1 },
          payments: { $push: '$payments' },
          items: { $push: '$items' },
        },
      },
    ]),

    // Sales returns within the period
    SaleReturn.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalRefundPaise: { $sum: '$totalRefundPaise' },
          returnsCount: { $sum: 1 },
        },
      },
    ]),

    // Voided bills count & volume for audit
    Sale.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: 'VOIDED' } },
      {
        $group: {
          _id: null,
          voidedRevenuePaise: { $sum: '$finalAmountPaise' },
          voidedCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const salesData = salesAgg[0] || {
    totalRevenuePaise: 0,
    totalSubtotalPaise: 0,
    totalDiscountPaise: 0,
    completedBillsCount: 0,
    payments: [],
    items: [],
  };

  const totalRefundPaise = returnsAgg[0]?.totalRefundPaise || 0;
  const returnsCount = returnsAgg[0]?.returnsCount || 0;
  const voidedCount = voidedAgg[0]?.voidedCount || 0;
  const voidedRevenuePaise = voidedAgg[0]?.voidedRevenuePaise || 0;

  // Net Sales Revenue after deducting refunds
  const netSalesRevenuePaise = Math.max(0, salesData.totalRevenuePaise - totalRefundPaise);
  const avgBillValuePaise = salesData.completedBillsCount > 0
    ? Math.round(netSalesRevenuePaise / salesData.completedBillsCount)
    : 0;

  // Payment Breakdown
  let cashCollectionPaise = 0;
  let upiCollectionPaise = 0;
  let udhaarCreditPaise = 0;

  if (salesData.payments && salesData.payments.length > 0) {
    salesData.payments.flat().forEach((p) => {
      if (p.method === 'CASH') cashCollectionPaise += p.amountPaise;
      else if (p.method === 'UPI') upiCollectionPaise += p.amountPaise;
      else if (p.method === 'CREDIT_UDHAAR') udhaarCreditPaise += p.amountPaise;
    });
  }

  // Cost of Goods Sold (COGS) & Gross Profit Calculation
  // Computed using historical purchase cost snapshot stored inside each sale line item
  let totalCogsPaise = 0;
  if (salesData.items && salesData.items.length > 0) {
    salesData.items.flat().forEach((item) => {
      const netQty = item.quantity - (item.returnedQuantity || 0);
      if (netQty > 0) {
        totalCogsPaise += Math.round(netQty * (item.purchasePricePaise || 0));
      }
    });
  }

  const grossProfitPaise = netSalesRevenuePaise - totalCogsPaise;
  const grossProfitMarginPct = netSalesRevenuePaise > 0
    ? Math.round((grossProfitPaise / netSalesRevenuePaise) * 1000) / 10
    : 0;

  // 2. Inventory Valuation (at Purchase Cost) & Stock Health
  const [inventoryAgg, lowStockCount, outOfStockCount, negativeStockCount] = await Promise.all([
    Product.aggregate([
      {
        $group: {
          _id: null,
          totalValuationPaise: {
            $sum: { $multiply: ['$currentStock', '$purchasePricePaise'] },
          },
          totalStockQuantity: { $sum: '$currentStock' },
          totalProductsCount: { $sum: 1 },
        },
      },
    ]),
    Product.countDocuments({
      $expr: { $lte: ['$currentStock', '$minStockLevel'] },
      isActive: true,
    }),
    Product.countDocuments({ currentStock: { $lte: 0 }, isActive: true }),
    Product.countDocuments({ currentStock: { $lt: 0 } }),
  ]);

  const totalInventoryValuationPaise = inventoryAgg[0]?.totalValuationPaise || 0;
  const totalStockQuantity = inventoryAgg[0]?.totalStockQuantity || 0;
  const totalProductsCount = inventoryAgg[0]?.totalProductsCount || 0;

  // 3. Customer Udhaar & Supplier Payables
  const [customerDebtAgg, supplierPayableAgg] = await Promise.all([
    Customer.aggregate([
      { $match: { currentBalancePaise: { $gt: 0 } } },
      { $group: { _id: null, totalCreditPaise: { $sum: '$currentBalancePaise' }, count: { $sum: 1 } } },
    ]),
    Supplier.aggregate([
      { $match: { currentPayablePaise: { $gt: 0 } } },
      { $group: { _id: null, totalPayablePaise: { $sum: '$currentPayablePaise' }, count: { $sum: 1 } } },
    ]),
  ]);

  const totalOutstandingCreditPaise = customerDebtAgg[0]?.totalCreditPaise || 0;
  const customersWithCreditCount = customerDebtAgg[0]?.count || 0;

  const totalOutstandingPayablePaise = supplierPayableAgg[0]?.totalPayablePaise || 0;
  const suppliersWithPayableCount = supplierPayableAgg[0]?.count || 0;

  const rangeLabelMap = {
    today: 'Today',
    yesterday: 'Yesterday',
    last7days: 'Last 7 Days',
    last30days: 'Last 30 Days',
    thismonth: 'This Month',
    previousmonth: 'Previous Month',
    custom: `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
  };

  return {
    period: {
      range,
      label: rangeLabelMap[range.toLowerCase()] || 'Selected Period',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
    // Top-level KPI shortcuts
    totalSalesPaise: netSalesRevenuePaise,
    netSalesRevenuePaise,
    totalBills: salesData.completedBillsCount,
    averageBillValuePaise: avgBillValuePaise,
    grossProfitPaise,
    grossProfitMarginPct,
    cashCollectionsPaise: cashCollectionPaise,
    upiCollectionsPaise: upiCollectionPaise,
    udhaarCollectionsPaise: udhaarCreditPaise,
    inventoryValuationPaise: totalInventoryValuationPaise,
    customerOutstandingPaise: totalOutstandingCreditPaise,
    supplierPayablePaise: totalOutstandingPayablePaise,
    lowStockCount,
    outOfStockCount,
    negativeStockCount,
    sales: {
      grossSalesPaise: salesData.totalRevenuePaise,
      returnsRefundPaise: totalRefundPaise,
      netSalesRevenuePaise,
      completedBillsCount: salesData.completedBillsCount,
      avgBillValuePaise,
      returnsCount,
      voidedBillsCount: voidedCount,
      voidedRevenuePaise,
      discountGivenPaise: salesData.totalDiscountPaise,
    },
    profit: {
      costOfGoodsSoldPaise: totalCogsPaise,
      grossProfitPaise,
      grossProfitMarginPct,
    },
    payments: {
      cashCollectionPaise,
      upiCollectionPaise,
      udhaarCreditPaise,
    },
    inventory: {
      totalValuationPaise: totalInventoryValuationPaise,
      totalStockQuantity,
      totalProductsCount,
      lowStockCount,
      outOfStockCount,
      negativeStockCount,
    },
    balances: {
      customerCreditOutstandingPaise: totalOutstandingCreditPaise,
      customersWithCreditCount,
      supplierPayableOutstandingPaise: totalOutstandingPayablePaise,
      suppliersWithPayableCount,
    },
  };
};

/**
 * Daily Sales Timeline & Breakdown for Charts
 */
export const getSalesTimelineAnalytics = async ({ range = 'last30days', startDate, endDate }) => {
  const { start, end } = parseDateRange(range, startDate, endDate);

  const salesByDay = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: { $ne: 'VOIDED' },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        revenuePaise: { $sum: '$finalAmountPaise' },
        billsCount: { $sum: 1 },
        items: { $push: '$items' },
        payments: { $push: '$payments' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Aggregate returns by day
  const returnsByDay = await SaleReturn.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        refundPaise: { $sum: '$totalRefundPaise' },
      },
    },
  ]);

  const returnMap = new Map();
  returnsByDay.forEach((r) => returnMap.set(r._id, r.refundPaise));

  const timeline = salesByDay.map((day) => {
    const refund = returnMap.get(day._id) || 0;
    const netRevenue = Math.max(0, day.revenuePaise - refund);

    let cogs = 0;
    let cash = 0;
    let upi = 0;
    let udhaar = 0;

    day.items.flat().forEach((it) => {
      const netQty = it.quantity - (it.returnedQuantity || 0);
      if (netQty > 0) cogs += Math.round(netQty * (it.purchasePricePaise || 0));
    });

    day.payments.flat().forEach((p) => {
      if (p.method === 'CASH') cash += p.amountPaise;
      else if (p.method === 'UPI') upi += p.amountPaise;
      else if (p.method === 'CREDIT_UDHAAR') udhaar += p.amountPaise;
    });

    const grossProfit = netRevenue - cogs;

    return {
      date: day._id,
      revenuePaise: netRevenue,
      revenueRupees: netRevenue / 100,
      grossProfitPaise: grossProfit,
      grossProfitRupees: grossProfit / 100,
      cogsPaise: cogs,
      billsCount: day.billsCount,
      cashPaise: cash,
      upiPaise: upi,
      udhaarPaise: udhaar,
    };
  });

  return timeline;
};

/**
 * Product Performance & Velocity Analytics
 */
export const getProductPerformanceAnalytics = async ({ range = 'thismonth', startDate, endDate, limit = 20 }) => {
  const { start, end } = parseDateRange(range, startDate, endDate);

  const productAgg = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: { $ne: 'VOIDED' },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        unit: { $first: '$items.unit' },
        soldQuantity: { $sum: '$items.quantity' },
        returnedQuantity: { $sum: { $ifNull: ['$items.returnedQuantity', 0] } },
        totalRevenuePaise: { $sum: '$items.totalPaise' },
        purchasePricePaise: { $first: '$items.purchasePricePaise' },
        salesCount: { $sum: 1 },
      },
    },
    {
      $project: {
        name: 1,
        unit: 1,
        netQuantity: { $subtract: ['$soldQuantity', '$returnedQuantity'] },
        totalRevenuePaise: 1,
        purchasePricePaise: 1,
        salesCount: 1,
        totalCogsPaise: {
          $multiply: [
            { $subtract: ['$soldQuantity', '$returnedQuantity'] },
            '$purchasePricePaise',
          ],
        },
      },
    },
    {
      $project: {
        name: 1,
        unit: 1,
        netQuantity: 1,
        totalRevenuePaise: 1,
        totalCogsPaise: 1,
        salesCount: 1,
        grossProfitPaise: { $subtract: ['$totalRevenuePaise', '$totalCogsPaise'] },
      },
    },
    { $sort: { netQuantity: -1 } },
  ]);

  const bestSelling = productAgg.slice(0, limit);
  const leastSelling = [...productAgg].reverse().slice(0, limit);

  // Category breakdown
  const categoryAgg = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: { $ne: 'VOIDED' },
      },
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'productDoc',
      },
    },
    { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'categories',
        localField: 'productDoc.category',
        foreignField: '_id',
        as: 'categoryDoc',
      },
    },
    { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$categoryDoc.name',
        categoryName: { $first: { $ifNull: ['$categoryDoc.name', 'Uncategorized'] } },
        revenuePaise: { $sum: '$items.totalPaise' },
        soldCount: { $sum: 1 },
      },
    },
    { $sort: { revenuePaise: -1 } },
  ]);

  return {
    bestSelling,
    leastSelling,
    categories: categoryAgg,
  };
};

/**
 * Inventory Valuation & Stock Alerts Report
 */
export const getInventoryAnalyticsReport = async () => {
  const [categoryValuation, lowStockProducts, negativeStockProducts] = await Promise.all([
    Product.aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryDoc',
        },
      },
      { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$categoryDoc._id',
          categoryName: { $first: { $ifNull: ['$categoryDoc.name', 'General Provisions'] } },
          productsCount: { $sum: 1 },
          totalStockQuantity: { $sum: '$currentStock' },
          totalValuationPaise: {
            $sum: { $multiply: ['$currentStock', '$purchasePricePaise'] },
          },
        },
      },
      { $sort: { totalValuationPaise: -1 } },
    ]),

    Product.find({
      $expr: { $lte: ['$currentStock', '$minStockLevel'] },
      isActive: true,
    })
      .sort({ currentStock: 1 })
      .populate('category', 'name')
      .limit(50),

    Product.find({ currentStock: { $lt: 0 } })
      .sort({ currentStock: 1 })
      .populate('category', 'name')
      .limit(50),
  ]);

  const totalValuationPaise = categoryValuation.reduce((acc, c) => acc + (c.totalValuationPaise || 0), 0);
  const totalStockQuantity = categoryValuation.reduce((acc, c) => acc + (c.totalStockQuantity || 0), 0);
  const totalProducts = categoryValuation.reduce((acc, c) => acc + (c.productsCount || 0), 0);
  const outOfStockProducts = lowStockProducts.filter((p) => p.currentStock <= 0);

  return {
    totalValuationPaise,
    totalStockQuantity,
    totalProducts,
    categoryValuation,
    lowStockProducts,
    outOfStockProducts,
    negativeStockProducts,
  };
};

/**
 * CSV Exporters (RFC-4180 format with Indian Currency formatting)
 */

export const generateSalesReportCSV = async ({ range = 'thismonth', startDate, endDate }) => {
  const { start, end } = parseDateRange(range, startDate, endDate);

  const sales = await Sale.find({
    createdAt: { $gte: start, $lte: end },
  })
    .sort({ createdAt: -1 })
    .populate('billedBy', 'name username');

  const headers = [
    'Invoice Number',
    'Date & Time',
    'Customer Name',
    'Customer Phone',
    'Items Count',
    'Subtotal (INR)',
    'Discount (INR)',
    'Net Amount (INR)',
    'Payment Method',
    'Payment Status',
    'Invoice Status',
    'Cashier',
  ];

  const rows = sales.map((s) => {
    const payMethod = s.payments.map((p) => p.method).join(' + ') || 'CASH';
    return [
      `"${s.invoiceNumber}"`,
      `"${new Date(s.createdAt).toLocaleString('en-IN')}"`,
      `"${(s.customerName || 'Walk-in Customer').replace(/"/g, '""')}"`,
      `"${s.customerPhone || ''}"`,
      s.items.length,
      (s.subtotalPaise / 100).toFixed(2),
      (s.discountPaise / 100).toFixed(2),
      (s.finalAmountPaise / 100).toFixed(2),
      `"${payMethod}"`,
      `"${s.paymentStatus}"`,
      `"${s.status}"`,
      `"${s.billedBy?.name || 'Staff'}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
};

export const generateProductPerformanceCSV = async ({ range = 'thismonth', startDate, endDate }) => {
  const { bestSelling } = await getProductPerformanceAnalytics({ range, startDate, endDate, limit: 100 });

  const headers = [
    'Product Name',
    'Unit',
    'Net Sold Quantity',
    'Total Revenue (INR)',
    'Cost of Goods Sold (INR)',
    'Gross Profit (INR)',
  ];

  const rows = bestSelling.map((p) => [
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.unit}"`,
    p.netQuantity,
    (p.totalRevenuePaise / 100).toFixed(2),
    (p.totalCogsPaise / 100).toFixed(2),
    (p.grossProfitPaise / 100).toFixed(2),
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
};

export const generateInventoryValuationCSV = async () => {
  const products = await Product.find({ isActive: true })
    .sort({ currentStock: 1 })
    .populate('category', 'name');

  const headers = [
    'Product Name',
    'Category',
    'Unit',
    'Current Stock',
    'Min Stock Threshold',
    'Purchase Cost (INR)',
    'Selling Price (INR)',
    'Total Valuation (INR)',
    'Stock Status',
  ];

  const rows = products.map((p) => {
    const valuation = (p.currentStock * p.purchasePricePaise) / 100;
    const status = p.currentStock < 0 ? 'NEGATIVE' : p.currentStock <= p.minStockThreshold ? 'LOW_STOCK' : 'NORMAL';

    return [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category?.name || 'General'}"`,
      `"${p.unit}"`,
      p.currentStock,
      p.minStockThreshold,
      (p.purchasePricePaise / 100).toFixed(2),
      (p.sellingPricePaise / 100).toFixed(2),
      valuation.toFixed(2),
      `"${status}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
};

export const generateCustomerOutstandingCSV = async () => {
  const customers = await Customer.find({ currentBalancePaise: { $gt: 0 } })
    .sort({ currentBalancePaise: -1 });

  const headers = [
    'Customer Name',
    'Contact Phone',
    'Address',
    'Outstanding Credit Balance (INR)',
    'Total Purchases Count',
    'Lifetime Spent (INR)',
  ];

  const rows = customers.map((c) => [
    `"${c.name.replace(/"/g, '""')}"`,
    `"${c.phone || ''}"`,
    `"${(c.address || '').replace(/"/g, '""')}"`,
    (c.currentBalancePaise / 100).toFixed(2),
    c.totalPurchasesCount || 0,
    ((c.totalSpentPaise || 0) / 100).toFixed(2),
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
};

export const generateSupplierPayableCSV = async () => {
  const suppliers = await Supplier.find({ currentPayablePaise: { $gt: 0 } })
    .sort({ currentPayablePaise: -1 });

  const headers = [
    'Supplier Name',
    'Contact Person',
    'Phone',
    'Outstanding Payable (INR)',
    'Lifetime Purchases (INR)',
  ];

  const rows = suppliers.map((s) => [
    `"${s.name.replace(/"/g, '""')}"`,
    `"${s.contactPerson || ''}"`,
    `"${s.phone || ''}"`,
    (s.currentPayablePaise / 100).toFixed(2),
    ((s.totalPurchasesPaise || 0) / 100).toFixed(2),
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
};
