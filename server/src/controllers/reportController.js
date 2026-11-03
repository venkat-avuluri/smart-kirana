import {
  getBusinessDashboardSummary,
  getSalesTimelineAnalytics,
  getProductPerformanceAnalytics,
  getInventoryAnalyticsReport,
  generateSalesReportCSV,
  generateProductPerformanceCSV,
  generateInventoryValuationCSV,
  generateCustomerOutstandingCSV,
  generateSupplierPayableCSV,
} from '../services/reportService.js';

export const handleGetDashboardSummary = async (req, res, next) => {
  try {
    const summary = await getBusinessDashboardSummary(req.query);
    res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSalesTimeline = async (req, res, next) => {
  try {
    const timeline = await getSalesTimelineAnalytics(req.query);
    res.status(200).json({
      success: true,
      timeline,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetProductPerformance = async (req, res, next) => {
  try {
    const result = await getProductPerformanceAnalytics(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetInventoryAnalytics = async (req, res, next) => {
  try {
    const result = await getInventoryAnalyticsReport();
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleExportReportCSV = async (req, res, next) => {
  try {
    const { type } = req.params;
    let csvData = '';
    let fileName = `report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;

    switch (type.toLowerCase()) {
      case 'sales':
        csvData = await generateSalesReportCSV(req.query);
        fileName = `sales-report-${req.query.range || 'period'}.csv`;
        break;

      case 'products':
        csvData = await generateProductPerformanceCSV(req.query);
        fileName = `product-performance-${req.query.range || 'period'}.csv`;
        break;

      case 'inventory':
        csvData = await generateInventoryValuationCSV();
        fileName = `inventory-valuation-${new Date().toISOString().slice(0, 10)}.csv`;
        break;

      case 'customers':
        csvData = await generateCustomerOutstandingCSV();
        fileName = `customer-udhaar-balances.csv`;
        break;

      case 'suppliers':
        csvData = await generateSupplierPayableCSV();
        fileName = `supplier-payables.csv`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Invalid export report type: '${type}'. Supported: sales, products, inventory, customers, suppliers.`,
        });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
};
