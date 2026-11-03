import Supplier from '../models/Supplier.js';
import SupplierTransaction from '../models/SupplierTransaction.js';
import Purchase from '../models/Purchase.js';
import { getNextSupplierPaymentNumber } from '../models/Counter.js';

/**
 * Supplier Management & Payable Ledger Service
 */

export const createSupplier = async ({
  name,
  contactPerson = '',
  phone = '',
  email = '',
  address = '',
  notes = '',
  user,
}) => {
  if (!name || !name.trim()) {
    throw new Error('Supplier name is required.');
  }

  const cleanPhone = phone ? phone.trim() : '';

  const supplier = await Supplier.create({
    name: name.trim(),
    contactPerson: contactPerson ? contactPerson.trim() : '',
    phone: cleanPhone,
    email: email ? email.trim() : '',
    address: address ? address.trim() : '',
    notes: notes ? notes.trim() : '',
    createdBy: user._id,
  });

  return supplier;
};

export const updateSupplier = async ({
  supplierId,
  name,
  contactPerson,
  phone,
  email,
  address,
  notes,
  isActive,
}) => {
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) {
    throw new Error('Supplier not found.');
  }

  if (name && name.trim()) supplier.name = name.trim();
  if (contactPerson !== undefined) supplier.contactPerson = contactPerson.trim();
  if (phone !== undefined) supplier.phone = phone.trim();
  if (email !== undefined) supplier.email = email.trim();
  if (address !== undefined) supplier.address = address.trim();
  if (notes !== undefined) supplier.notes = notes.trim();
  if (isActive !== undefined) supplier.isActive = Boolean(isActive);

  await supplier.save();
  return supplier;
};

export const getSuppliers = async ({
  search = '',
  hasPayableOnly = false,
  isActive,
  page = 1,
  limit = 20,
}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  if (isActive !== undefined && isActive !== '') {
    filter.isActive = String(isActive) === 'true';
  }

  if (hasPayableOnly && String(hasPayableOnly) === 'true') {
    filter.currentPayablePaise = { $gt: 0 };
  }

  if (search && search.trim()) {
    const clean = search.trim();
    filter.$or = [
      { name: { $regex: clean, $options: 'i' } },
      { contactPerson: { $regex: clean, $options: 'i' } },
      { phone: { $regex: clean, $options: 'i' } },
    ];
  }

  const [suppliers, total] = await Promise.all([
    Supplier.find(filter)
      .sort({ currentPayablePaise: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name username'),
    Supplier.countDocuments(filter),
  ]);

  return {
    suppliers,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
  };
};

export const getSupplierById = async (supplierId) => {
  const supplier = await Supplier.findById(supplierId).populate('createdBy', 'name username');
  if (!supplier) {
    throw new Error('Supplier not found.');
  }

  const [recentTransactions, recentPurchases] = await Promise.all([
    SupplierTransaction.find({ supplier: supplier._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('recordedBy', 'name username'),
    Purchase.find({ supplier: supplier._id })
      .sort({ createdAt: -1 })
      .limit(10),
  ]);

  return {
    supplier,
    recentTransactions,
    recentPurchases,
  };
};

/**
 * Record Supplier Payment (Disbursing cash/UPI to vendor to settle payable)
 */
export const recordSupplierPayment = async ({
  supplierId,
  amountPaise,
  paymentMethod = 'CASH',
  reference = '',
  notes = '',
  idempotencyKey = '',
  user,
}) => {
  const cleanAmt = parseInt(amountPaise, 10);
  if (isNaN(cleanAmt) || cleanAmt <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  // Idempotency check
  if (idempotencyKey && idempotencyKey.trim()) {
    const existing = await SupplierTransaction.findOne({ idempotencyKey: idempotencyKey.trim() })
      .populate('supplier', 'name phone currentPayablePaise')
      .populate('recordedBy', 'name username');
    if (existing) {
      return { transaction: existing, supplier: existing.supplier, isIdempotentReplay: true };
    }
  }

  const supplier = await Supplier.findById(supplierId);
  if (!supplier) {
    throw new Error('Supplier not found.');
  }

  if (supplier.currentPayablePaise <= 0) {
    throw new Error(`Supplier '${supplier.name}' has no outstanding payable balance.`);
  }

  if (cleanAmt > supplier.currentPayablePaise) {
    throw new Error(
      `Payment amount (₹${cleanAmt / 100}) exceeds outstanding payable balance (₹${supplier.currentPayablePaise / 100}).`
    );
  }

  const voucherNumber = await getNextSupplierPaymentNumber();
  const balanceBeforePaise = supplier.currentPayablePaise;
  const balanceAfterPaise = balanceBeforePaise - cleanAmt;

  const transaction = await SupplierTransaction.create({
    supplier: supplier._id,
    type: 'PAYMENT',
    amountPaise: cleanAmt,
    deltaPaise: -cleanAmt,
    balanceBeforePaise,
    balanceAfterPaise,
    voucherNumber,
    referenceId: reference ? reference.trim() : voucherNumber,
    paymentMethod,
    notes: notes ? notes.trim() : `Disbursement via ${paymentMethod}`,
    recordedBy: user._id,
    idempotencyKey: idempotencyKey ? idempotencyKey.trim() : undefined,
  });

  supplier.currentPayablePaise = balanceAfterPaise;
  await supplier.save();

  const populatedTx = await SupplierTransaction.findById(transaction._id)
    .populate('supplier', 'name phone')
    .populate('recordedBy', 'name username');

  return {
    transaction: populatedTx,
    supplier,
    voucherNumber,
    isIdempotentReplay: false,
  };
};

/**
 * Get Supplier Statement / Ledger
 */
export const getSupplierLedger = async ({ supplierId, page = 1, limit = 50 }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const supplier = await Supplier.findById(supplierId);
  if (!supplier) {
    throw new Error('Supplier not found.');
  }

  const [transactions, total] = await Promise.all([
    SupplierTransaction.find({ supplier: supplier._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('recordedBy', 'name username'),
    SupplierTransaction.countDocuments({ supplier: supplier._id }),
  ]);

  return {
    supplier,
    transactions,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
};

/**
 * Supplier Overview & Aggregate Payable Metrics
 */
export const getSuppliersOverview = async () => {
  const [payableAggregate, countWithPayable, totalPurchases] = await Promise.all([
    Supplier.aggregate([
      { $match: { currentPayablePaise: { $gt: 0 } } },
      { $group: { _id: null, totalPayablePaise: { $sum: '$currentPayablePaise' } } },
    ]),
    Supplier.countDocuments({ currentPayablePaise: { $gt: 0 } }),
    Purchase.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: null,
          totalPurchasedPaise: { $sum: '$totalAmountPaise' },
          totalPaidPaise: { $sum: '$paidAmountPaise' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totalOutstandingPayablePaise = payableAggregate[0]?.totalPayablePaise || 0;
  const totalPurchasedPaise = totalPurchases[0]?.totalPurchasedPaise || 0;
  const totalPaidPaise = totalPurchases[0]?.totalPaidPaise || 0;
  const completedPurchasesCount = totalPurchases[0]?.count || 0;

  return {
    totalOutstandingPayablePaise,
    suppliersWithPayableCount: countWithPayable,
    totalPurchasedPaise,
    totalPaidPaise,
    completedPurchasesCount,
  };
};
