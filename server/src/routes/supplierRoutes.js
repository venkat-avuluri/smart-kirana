import express from 'express';
import {
  handleCreateSupplier,
  handleUpdateSupplier,
  handleGetSuppliers,
  handleGetSupplierById,
  handleRecordSupplierPayment,
  handleGetSupplierLedger,
  handleGetSuppliersOverview,
} from '../controllers/supplierController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// Suppliers and purchasing are sensitive operations restricted to ADMIN
router.use(protect, authorize('ADMIN'));

router.route('/')
  .post(handleCreateSupplier)
  .get(handleGetSuppliers);

router.get('/overview', handleGetSuppliersOverview);

router.route('/:id')
  .get(handleGetSupplierById)
  .put(handleUpdateSupplier);

router.post('/:id/payment', handleRecordSupplierPayment);
router.get('/:id/ledger', handleGetSupplierLedger);

export default router;
