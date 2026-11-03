import express from 'express';
import {
  recordStockIn,
  recordStockOut,
  recordOpeningStock,
  recordStockAdjustment,
  importOpeningStockCSV,
  getLedgerHistory,
  getStockValuationReport,
  getLowStockReport,
} from '../controllers/inventoryController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// Low Stock Report (Admin & Staff)
router.get('/low-stock', protect, getLowStockReport);

// Inventory Movement Ledger History (Admin & Staff)
router.get('/ledger', protect, getLedgerHistory);

// Store Inventory Valuation (Admin only)
router.get('/valuation', protect, authorize('ADMIN'), getStockValuationReport);

// Stock In / Purchase (Admin only)
router.post('/stock-in', protect, authorize('ADMIN'), recordStockIn);

// Stock Out / Damage / Wastage (Admin only)
router.post('/stock-out', protect, authorize('ADMIN'), recordStockOut);

// Opening Stock (Admin only)
router.post('/opening-stock', protect, authorize('ADMIN'), recordOpeningStock);
router.post('/opening-stock/csv', protect, authorize('ADMIN'), importOpeningStockCSV);

// Manual Adjustment & Corrections (Admin only)
router.post('/adjust', protect, authorize('ADMIN'), recordStockAdjustment);

export default router;
