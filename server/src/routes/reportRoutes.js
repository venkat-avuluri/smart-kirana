import express from 'express';
import {
  handleGetDashboardSummary,
  handleGetSalesTimeline,
  handleGetProductPerformance,
  handleGetInventoryAnalytics,
  handleGetReconciliationReport,
  handleExportReportCSV,
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// Strict RBAC: All report, wholesale margin, and analytics routes are strictly ADMIN only
router.use(protect, authorize('ADMIN'));

router.get('/dashboard', handleGetDashboardSummary);
router.get('/sales-timeline', handleGetSalesTimeline);
router.get('/products', handleGetProductPerformance);
router.get('/inventory', handleGetInventoryAnalytics);
router.get('/reconciliation', handleGetReconciliationReport);
router.get('/export/:type', handleExportReportCSV);

export default router;
