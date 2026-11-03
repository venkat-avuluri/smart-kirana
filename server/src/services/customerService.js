import Customer from '../models/Customer.js';
import CustomerTransaction from '../models/CustomerTransaction.js';
import Sale from '../models/Sale.js';
import { getNextCustomerReceiptNumber } from '../models/Counter.js';

/**
 * Customer & Udhaar Management Service
 */

export const createCustomer = async ({ name, phone = '', address = '', notes = '', user }) => {
  if (!name || !name.trim()) {
    throw new Error('Customer name is required.');
  }

  const cleanPhone = phone ? phone.trim() : '';

  if (cleanPhone) {
    const existing = await Customer.findOne({ phone: cleanPhone });
    if (existing) {
      throw new Error(`A customer with phone number '${cleanPhone}' already exists (${existing.name}).`);
    }
  }

  const customer = await Customer.create({
    name: name.trim(),
    phone: cleanPhone,
    address: address ? address.trim() : '',
    notes: notes ? notes.trim() : '',
    createdBy: user._id,
  });

  return customer;
};

export const updateCustomer = async ({ customerId, name, phone, address, notes, isActive }) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found.');
  }

  if (name && name.trim()) {
    customer.name = name.trim();
  }

  if (phone !== undefined) {
    const cleanPhone = phone.trim();
    if (cleanPhone && cleanPhone !== customer.phone) {
      const existing = await Customer.findOne({ phone: cleanPhone, _id: { $ne: customer._id } });
      if (existing) {
        throw new Error(`Another customer already has phone number '${cleanPhone}'.`);
      }
    }
    customer.phone = cleanPhone;
  }

  if (address !== undefined) customer.address = address.trim();
  if (notes !== undefined) customer.notes = notes.trim();
  if (isActive !== undefined) customer.isActive = Boolean(isActive);

  await customer.save();
  return customer;
};

export const getCustomers = async ({
  search = '',
  hasCreditOnly = false,
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

  if (hasCreditOnly && String(hasCreditOnly) === 'true') {
    filter.currentBalancePaise = { $gt: 0 };
  }

  if (search && search.trim()) {
    const clean = search.trim();
    filter.$or = [
      { name: { $regex: clean, $options: 'i' } },
      { phone: { $regex: clean, $options: 'i' } },
    ];
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ currentBalancePaise: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name username'),
    Customer.countDocuments(filter),
  ]);

  return {
    customers,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
  };
};

export const getCustomerById = async (customerId) => {
  const customer = await Customer.findById(customerId).populate('createdBy', 'name username');
  if (!customer) {
    throw new Error('Customer not found.');
  }

  // Fetch recent ledger transactions and recent purchases
  const [recentTransactions, recentSales] = await Promise.all([
    CustomerTransaction.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('recordedBy', 'name username'),
    Sale.find({ customerId: customer._id })
      .sort({ createdAt: -1 })
      .limit(10),
  ]);

  return {
    customer,
    recentTransactions,
    recentSales,
  };
};

/**
 * Record Repayment from Customer (Debits customer debt)
 */
export const recordCustomerPayment = async ({
  customerId,
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

  // Idempotency check: prevent duplicate submissions
  if (idempotencyKey && idempotencyKey.trim()) {
    const existing = await CustomerTransaction.findOne({ idempotencyKey: idempotencyKey.trim() })
      .populate('customer', 'name phone currentBalancePaise')
      .populate('recordedBy', 'name username');
    if (existing) {
      return { transaction: existing, customer: existing.customer, isIdempotentReplay: true };
    }
  }

  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found.');
  }

  if (customer.currentBalancePaise <= 0) {
    throw new Error(`Customer '${customer.name}' has no outstanding credit balance to settle.`);
  }

  if (cleanAmt > customer.currentBalancePaise) {
    throw new Error(
      `Payment amount (₹${cleanAmt / 100}) exceeds outstanding balance (₹${customer.currentBalancePaise / 100}).`
    );
  }

  const receiptNumber = await getNextCustomerReceiptNumber();
  const balanceBeforePaise = customer.currentBalancePaise;
  const balanceAfterPaise = balanceBeforePaise - cleanAmt;

  const transaction = await CustomerTransaction.create({
    customer: customer._id,
    type: 'PAYMENT',
    amountPaise: cleanAmt,
    deltaPaise: -cleanAmt,
    balanceBeforePaise,
    balanceAfterPaise,
    receiptNumber,
    referenceId: reference ? reference.trim() : receiptNumber,
    paymentMethod,
    notes: notes ? notes.trim() : `Payment received via ${paymentMethod}`,
    recordedBy: user._id,
    idempotencyKey: idempotencyKey ? idempotencyKey.trim() : undefined,
  });

  customer.currentBalancePaise = balanceAfterPaise;
  await customer.save();

  const populatedTx = await CustomerTransaction.findById(transaction._id)
    .populate('customer', 'name phone')
    .populate('recordedBy', 'name username');

  return {
    transaction: populatedTx,
    customer,
    receiptNumber,
    isIdempotentReplay: false,
  };
};

/**
 * Get Customer Ledger Statement
 */
export const getCustomerLedger = async ({ customerId, page = 1, limit = 50 }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found.');
  }

  const [transactions, total] = await Promise.all([
    CustomerTransaction.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('recordedBy', 'name username'),
    CustomerTransaction.countDocuments({ customer: customer._id }),
  ]);

  return {
    customer,
    transactions,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
};

/**
 * Store-wide Udhaar Metrics & Summary
 */
export const getUdhaarSummary = async () => {
  const [creditAggregate, countWithCredit, todayCollections] = await Promise.all([
    Customer.aggregate([
      { $match: { currentBalancePaise: { $gt: 0 } } },
      { $group: { _id: null, totalCreditPaise: { $sum: '$currentBalancePaise' } } },
    ]),
    Customer.countDocuments({ currentBalancePaise: { $gt: 0 } }),
    CustomerTransaction.aggregate([
      {
        $match: {
          type: 'PAYMENT',
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      },
      {
        $group: {
          _id: null,
          totalCollectedPaise: { $sum: '$amountPaise' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totalOutstandingCreditPaise = creditAggregate[0]?.totalCreditPaise || 0;
  const todayCollectedPaise = todayCollections[0]?.totalCollectedPaise || 0;
  const todayCollectionsCount = todayCollections[0]?.count || 0;

  return {
    totalOutstandingCreditPaise,
    customersWithCreditCount: countWithCredit,
    todayCollectedPaise,
    todayCollectionsCount,
  };
};
