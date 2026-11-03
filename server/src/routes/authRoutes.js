import express from 'express';
import {
  login,
  getMe,
  createUser,
  listUsers,
  toggleUserStatus,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Authenticated session route
router.get('/me', protect, getMe);

// Admin-only user management routes
router.get('/users', protect, authorize('ADMIN'), listUsers);
router.post('/users', protect, authorize('ADMIN'), createUser);
router.patch('/users/:id/status', protect, authorize('ADMIN'), toggleUserStatus);

export default router;
