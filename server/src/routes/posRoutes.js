import express from 'express';
import {
  checkout,
  getSalesHistory,
  getSaleById,
  getSaleByInvoiceNumber,
  voidSaleInvoice,
  processReturn,
  getReturnsHistory,
} from '../controllers/posController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// Checkout & sales creation (Admin & Staff)
router.post('/checkout', protect, checkout);

// Sales queries
router.get('/sales', protect, getSalesHistory);
router.get('/sales/invoice/:invoiceNumber', protect, getSaleByInvoiceNumber);
router.get('/sales/:id', protect, getSaleById);

// Void bill (Admin only)
router.post('/sales/:id/void', protect, authorize('ADMIN'), voidSaleInvoice);

// Sales returns (Admin & Staff)
router.post('/sales/:id/return', protect, processReturn);
router.get('/returns', protect, getReturnsHistory);

export default router;
