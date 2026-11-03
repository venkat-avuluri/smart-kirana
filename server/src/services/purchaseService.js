import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import Supplier from '../models/Supplier.js';
import SupplierTransaction from '../models/SupplierTransaction.js';
import Product, { LOOSE_UNITS } from '../models/Product.js';
import { getNextPurchaseNumber } from '../models/Counter.js';
import { recordStockMovement } from './inventoryService.js';

/**
 * Purchase Entry & Inventory Stock-In Service
 */

export const createPurchase = async ({
  supplierId,
  supplierInvoiceNumber = '',
  items,
  discountPaise = 0,
  paidAmountPaise = 0,
  paymentMethod = 'CASH',
  paymentReference = '',
  notes = '',
  idempotencyKey = '',
  user,
}) => {
  if (!supplierId) {
    throw new Error('Supplier is required for purchase entry.');
  }

  const supplier = await Supplier.findById(supplierId);
  if (!supplier) {
    throw new Error('Selected supplier was not found.');
  }

  if (!supplier.isActive) {
    throw new Error(`Supplier '${supplier.name}' is deactivated.`);
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Purchase must contain at least one item.');
  }

  // Idempotency check: prevent duplicate purchase entry
  if (idempotencyKey && idempotencyKey.trim()) {
    const existing = await Purchase.findOne({ idempotencyKey: idempotencyKey.trim() })
      .populate('supplier', 'name phone')
      .populate('items.product', 'name unit currentStock')
      .populate('receivedBy', 'name username');
    if (existing) {
      return { purchase: existing, isIdempotentReplay: true };
    }
  }

  // 1. Fetch products & validate quantities and purchase prices
  const productIds = items.map((i) => i.productId || i.product);
  const dbProducts = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map();
  dbProducts.forEach((p) => productMap.set(p._id.toString(), p));

  const validatedItems = [];
  let subtotalPaise = 0;

  for (const item of items) {
    const pId = (item.productId || item.product || '').toString();
    const product = productMap.get(pId);

    if (!product) {
      throw new Error(`Product with ID '${pId}' not found.`);
    }

    const isLoose = LOOSE_UNITS.includes(product.unit);
    const qty = parseFloat(item.quantity);

    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Invalid quantity for '${product.name}'. Must be greater than zero.`);
    }

    if (!isLoose && !Number.isInteger(qty)) {
      throw new Error(`Unit '${product.unit}' represents discrete pieces and cannot have fractional quantity (${qty}).`);
    }

    const cleanQty = isLoose ? Math.round(qty * 1000) / 1000 : qty;

    const unitCostPaise = parseInt(item.purchasePricePaise, 10);
    if (isNaN(unitCostPaise) || unitCostPaise < 0) {
      throw new Error(`Invalid purchase price for '${product.name}'. Must be a non-negative integer in paise.`);
    }

    const lineTotalPaise = Math.round(cleanQty * unitCostPaise);
    subtotalPaise += lineTotalPaise;

    validatedItems.push({
      product: product._id,
      name: product.name,
      unit: product.unit,
      isLoose,
      quantity: cleanQty,
      purchasePricePaise: unitCostPaise,
      totalPaise: lineTotalPaise,
    });
  }

  const cleanDiscountPaise = Math.max(0, parseInt(discountPaise, 10) || 0);
  if (cleanDiscountPaise > subtotalPaise) {
    throw new Error('Discount cannot exceed purchase subtotal.');
  }

  const totalAmountPaise = subtotalPaise - cleanDiscountPaise;

  const cleanPaidPaise = Math.max(0, parseInt(paidAmountPaise, 10) || 0);
  if (cleanPaidPaise > totalAmountPaise) {
    throw new Error(`Paid amount (₹${cleanPaidPaise / 100}) cannot exceed total purchase bill (₹${totalAmountPaise / 100}).`);
  }

  const balancePayablePaise = totalAmountPaise - cleanPaidPaise;

  let paymentStatus = 'UNPAID';
  if (cleanPaidPaise === totalAmountPaise) {
    paymentStatus = 'PAID';
  } else if (cleanPaidPaise > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  // Generate Unique Sequential Purchase Number: PUR-YYYYMM-XXXX
  const purchaseNumber = await getNextPurchaseNumber();

  // 2. CRITICAL: Atomic Inventory Stock-In via Immutable Ledger
  try {
    for (const item of validatedItems) {
      await recordStockMovement({
        productId: item.product,
        type: 'PURCHASE',
        quantityDelta: item.quantity,
        reason: `Supplier Purchase ${purchaseNumber} from ${supplier.name}`,
        userId: user._id,
        userRole: user.role,
        referenceId: purchaseNumber,
        allowNegativeOverride: true,
      });

      // Optionally update product's recorded purchase cost if latest cost was entered
      if (item.purchasePricePaise > 0) {
        await Product.findByIdAndUpdate(item.product, {
          purchasePricePaise: item.purchasePricePaise,
        });
      }
    }
  } catch (stockErr) {
    throw new Error(`Stock-in ledger failed: ${stockErr.message}`);
  }

  // 3. Update Supplier Ledger
  let supplierBalance = supplier.currentPayablePaise || 0;

  // A. Record Purchase transaction (increases payable)
  const purchaseTx = await SupplierTransaction.create({
    supplier: supplier._id,
    type: 'PURCHASE',
    amountPaise: totalAmountPaise,
    deltaPaise: totalAmountPaise,
    balanceBeforePaise: supplierBalance,
    balanceAfterPaise: supplierBalance + totalAmountPaise,
    referenceId: purchaseNumber,
    notes: `Purchase Bill ${purchaseNumber} (Inv #${supplierInvoiceNumber || 'N/A'})`,
    recordedBy: user._id,
  });

  supplierBalance += totalAmountPaise;

  // B. If immediate payment made, record Payment transaction (reduces payable)
  if (cleanPaidPaise > 0) {
    await SupplierTransaction.create({
      supplier: supplier._id,
      type: 'PAYMENT',
      amountPaise: cleanPaidPaise,
      deltaPaise: -cleanPaidPaise,
      balanceBeforePaise: supplierBalance,
      balanceAfterPaise: supplierBalance - cleanPaidPaise,
      referenceId: purchaseNumber,
      paymentMethod,
      notes: `Immediate payment for ${purchaseNumber} via ${paymentMethod}`,
      recordedBy: user._id,
    });

    supplierBalance -= cleanPaidPaise;
  }

  supplier.currentPayablePaise = supplierBalance;
  supplier.totalPurchasesPaise = (supplier.totalPurchasesPaise || 0) + totalAmountPaise;
  await supplier.save();

  // 4. Save Purchase Document
  const purchase = await Purchase.create({
    purchaseNumber,
    idempotencyKey: idempotencyKey ? idempotencyKey.trim() : undefined,
    supplier: supplier._id,
    supplierInvoiceNumber: supplierInvoiceNumber ? supplierInvoiceNumber.trim() : '',
    items: validatedItems,
    subtotalPaise,
    discountPaise: cleanDiscountPaise,
    totalAmountPaise,
    paidAmountPaise: cleanPaidPaise,
    balancePayablePaise,
    paymentMethod,
    paymentStatus,
    paymentReference: paymentReference ? paymentReference.trim() : '',
    status: 'COMPLETED',
    notes: notes ? notes.trim() : '',
    receivedBy: user._id,
  });

  const populated = await Purchase.findById(purchase._id)
    .populate('supplier', 'name phone contactPerson')
    .populate('items.product', 'name unit currentStock category')
    .populate('receivedBy', 'name username');

  return { purchase: populated, isIdempotentReplay: false };
};

/**
 * Cancel Purchase (Admin Only)
 * Reverses inventory stock through immutable ledger and reverses supplier payable
 */
export const cancelPurchase = async ({ purchaseId, cancellationReason, user }) => {
  if (!cancellationReason || !cancellationReason.trim()) {
    throw new Error('Mandatory cancellation reason is required.');
  }

  const purchase = await Purchase.findById(purchaseId).populate('supplier');
  if (!purchase) {
    throw new Error('Purchase record not found.');
  }

  if (purchase.status === 'CANCELLED') {
    throw new Error(`Purchase '${purchase.purchaseNumber}' is already cancelled.`);
  }

  // 1. Reverse stock movements in ledger for each item
  for (const item of purchase.items) {
    await recordStockMovement({
      productId: item.product,
      type: 'STOCK_CORRECTION',
      quantityDelta: -item.quantity,
      reason: `Cancelled Purchase ${purchase.purchaseNumber}: ${cancellationReason.trim()}`,
      userId: user._id,
      userRole: user.role,
      referenceId: purchase.purchaseNumber,
      allowNegativeOverride: true,
      overrideReason: 'Purchase cancellation stock reversal',
    });
  }

  // 2. Reverse Supplier Ledger for remaining unpaid balance
  const supplier = await Supplier.findById(purchase.supplier._id);
  if (supplier && purchase.balancePayablePaise > 0) {
    const balanceBeforePaise = supplier.currentPayablePaise;
    const balanceAfterPaise = Math.max(0, balanceBeforePaise - purchase.balancePayablePaise);

    await SupplierTransaction.create({
      supplier: supplier._id,
      type: 'PURCHASE_CANCEL',
      amountPaise: purchase.balancePayablePaise,
      deltaPaise: -purchase.balancePayablePaise,
      balanceBeforePaise,
      balanceAfterPaise,
      referenceId: purchase.purchaseNumber,
      notes: `Cancelled Purchase ${purchase.purchaseNumber}: ${cancellationReason.trim()}`,
      recordedBy: user._id,
    });

    supplier.currentPayablePaise = balanceAfterPaise;
    await supplier.save();
  }

  purchase.status = 'CANCELLED';
  purchase.cancellationReason = cancellationReason.trim();
  purchase.cancelledBy = user._id;
  purchase.cancelledAt = new Date();
  await purchase.save();

  const updatedPurchase = await Purchase.findById(purchase._id)
    .populate('supplier', 'name phone')
    .populate('receivedBy', 'name username')
    .populate('cancelledBy', 'name username');

  return updatedPurchase;
};

/**
 * Get Purchases History
 */
export const getPurchases = async ({
  supplierId,
  purchaseNumber,
  paymentStatus,
  status,
  startDate,
  endDate,
  search,
  page = 1,
  limit = 20,
}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  if (supplierId) filter.supplier = supplierId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (status) filter.status = status;

  if (purchaseNumber && purchaseNumber.trim()) {
    filter.purchaseNumber = { $regex: purchaseNumber.trim(), $options: 'i' };
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (search && search.trim()) {
    const clean = search.trim();
    filter.$or = [
      { purchaseNumber: { $regex: clean, $options: 'i' } },
      { supplierInvoiceNumber: { $regex: clean, $options: 'i' } },
    ];
  }

  const [purchases, total] = await Promise.all([
    Purchase.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('supplier', 'name phone contactPerson')
      .populate('receivedBy', 'name username'),
    Purchase.countDocuments(filter),
  ]);

  return {
    purchases,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
  };
};

export const getPurchaseById = async (purchaseId) => {
  const purchase = await Purchase.findById(purchaseId)
    .populate('supplier', 'name phone contactPerson address currentPayablePaise')
    .populate('items.product', 'name unit currentStock category')
    .populate('receivedBy', 'name username')
    .populate('cancelledBy', 'name username');

  if (!purchase) {
    throw new Error('Purchase record not found.');
  }

  return purchase;
};
