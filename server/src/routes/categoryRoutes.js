import express from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

router.route('/')
  .get(protect, getCategories)
  .post(protect, authorize('ADMIN'), createCategory);

router.route('/:id')
  .get(protect, getCategoryById)
  .put(protect, authorize('ADMIN'), updateCategory)
  .delete(protect, authorize('ADMIN'), deleteCategory);

export default router;
