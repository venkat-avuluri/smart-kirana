import express from 'express';
import {
  handleCreatePurchase,
  handleCancelPurchase,
  handleGetPurchases,
  handleGetPurchaseById,
} from '../controllers/purchaseController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// Purchases restricted to ADMIN (Shop Owner)
router.use(protect, authorize('ADMIN'));

router.route('/')
  .post(handleCreatePurchase)
  .get(handleGetPurchases);

router.route('/:id')
  .get(handleGetPurchaseById);

router.post('/:id/cancel', handleCancelPurchase);

export default router;
