import express from 'express';
import {
  handleCreateCustomer,
  handleUpdateCustomer,
  handleGetCustomers,
  handleGetCustomerById,
  handleRecordCustomerPayment,
  handleGetCustomerLedger,
  handleGetUdhaarSummary,
} from '../controllers/customerController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Admin & Staff can access customer management

router.route('/')
  .post(handleCreateCustomer)
  .get(handleGetCustomers);

router.get('/overview', handleGetUdhaarSummary);

router.route('/:id')
  .get(handleGetCustomerById)
  .put(handleUpdateCustomer);

router.post('/:id/payment', handleRecordCustomerPayment);
router.get('/:id/ledger', handleGetCustomerLedger);

export default router;
