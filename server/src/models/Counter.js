import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

const Counter = mongoose.model('Counter', counterSchema);
export default Counter;

/**
 * Generate next sequential invoice number atomically
 * Format: SK-YYYYMM-XXXX (e.g. SK-202611-0001)
 * @param {string} prefix 
 * @returns {Promise<string>}
 */
export const getNextInvoiceNumber = async (prefix = 'SK') => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const counterId = `invoice_${yearMonth}`;

  const counter = await Counter.findOneAndUpdate(
    { id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequentialNumber = String(counter.seq).padStart(4, '0');
  return `${prefix}-${yearMonth}-${sequentialNumber}`;
};

/**
 * Generate next return number atomically
 * Format: RET-YYYYMM-XXXX
 * @returns {Promise<string>}
 */
export const getNextReturnNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const counterId = `return_${yearMonth}`;

  const counter = await Counter.findOneAndUpdate(
    { id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequentialNumber = String(counter.seq).padStart(4, '0');
  return `RET-${yearMonth}-${sequentialNumber}`;
};

/**
 * Generate next customer repayment receipt number atomically
 * Format: RCP-YYYYMM-XXXX
 * @returns {Promise<string>}
 */
export const getNextCustomerReceiptNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const counterId = `cust_receipt_${yearMonth}`;

  const counter = await Counter.findOneAndUpdate(
    { id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequentialNumber = String(counter.seq).padStart(4, '0');
  return `RCP-${yearMonth}-${sequentialNumber}`;
};

/**
 * Generate next purchase order / invoice number atomically
 * Format: PUR-YYYYMM-XXXX
 * @returns {Promise<string>}
 */
export const getNextPurchaseNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const counterId = `purchase_${yearMonth}`;

  const counter = await Counter.findOneAndUpdate(
    { id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequentialNumber = String(counter.seq).padStart(4, '0');
  return `PUR-${yearMonth}-${sequentialNumber}`;
};

/**
 * Generate next supplier payment voucher number atomically
 * Format: SPAY-YYYYMM-XXXX
 * @returns {Promise<string>}
 */
export const getNextSupplierPaymentNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const counterId = `supp_payment_${yearMonth}`;

  const counter = await Counter.findOneAndUpdate(
    { id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequentialNumber = String(counter.seq).padStart(4, '0');
  return `SPAY-${yearMonth}-${sequentialNumber}`;
};
