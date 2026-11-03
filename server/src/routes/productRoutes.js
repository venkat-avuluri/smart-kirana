import express from 'express';
import {
  getProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  toggleProductStatus,
  downloadCSVTemplate,
  importProductsCSV,
} from '../controllers/productController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// CSV operations (must be before :id routes)
router.get('/csv/template', protect, authorize('ADMIN'), downloadCSVTemplate);
router.post('/csv/import', protect, authorize('ADMIN'), importProductsCSV);

// Barcode fast lookup
router.get('/barcode/:barcode', protect, getProductByBarcode);

// Collection operations
router.route('/')
  .get(protect, getProducts)
  .post(protect, authorize('ADMIN'), createProduct);

// Single item operations
router.route('/:id')
  .get(protect, getProductById)
  .put(protect, authorize('ADMIN'), updateProduct);

router.patch('/:id/status', protect, authorize('ADMIN'), toggleProductStatus);

export default router;
