import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import SaleReturn from '../models/SaleReturn.js';
import Product, { LOOSE_UNITS } from '../models/Product.js';
import { getNextInvoiceNumber, getNextReturnNumber } from '../models/Counter.js';
import { recordStockMovement } from './inventoryService.js';

/**
 * POS Billing Service
 * Handles price recalculation on server, atomic inventory deductions, payments, and voiding.
 */

export const createPosSale = async ({
  items,
  discountPaise = 0,
  payments,
  customerName = 'Walk-in Customer',
  customerPhone = '',
  customerId = null,
  notes = '',
  allowNegativeOverride = false,
  overrideReason = '',
  idempotencyKey = '',
  user,
}) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cart is empty. Please add products to complete sale.');
  }

  // Idempotency check: prevent duplicate billing on retry
  if (idempotencyKey && idempotencyKey.trim()) {
    const existing = await Sale.findOne({ idempotencyKey: idempotencyKey.trim() })
      .populate('billedBy', 'name username')
      .populate('items.product', 'name barcodes');
    if (existing) {
      return { sale: existing, isIdempotentReplay: true };
    }
  }

  // 1. Fetch all products from DB and validate prices & stock
  const productIds = items.map((i) => i.productId || i.product);
  const dbProducts = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map();
  dbProducts.forEach((p) => productMap.set(p._id.toString(), p));

  const validatedItems = [];
  let calculatedSubtotalPaise = 0;
  const negativeStockWarnings = [];

  for (const item of items) {
    const pId = (item.productId || item.product || '').toString();
    const product = productMap.get(pId);

    if (!product) {
      throw new Error(`Product with ID '${pId}' not found.`);
    }

    if (!product.isActive) {
      throw new Error(`Product '${product.name}' is inactive and cannot be billed.`);
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

    // Check potential negative stock
    const resultingStock = isLoose
      ? Math.round((product.currentStock - cleanQty) * 1000) / 1000
      : product.currentStock - cleanQty;

    if (resultingStock < 0) {
      negativeStockWarnings.push({
        productName: product.name,
        currentStock: product.currentStock,
        requestedQty: cleanQty,
        resultingStock,
        unit: product.unit,
      });
    }

    // Line total strictly computed using DB selling price in paise
    const unitPricePaise = product.sellingPricePaise;
    const lineTotalPaise = Math.round(cleanQty * unitPricePaise);
    calculatedSubtotalPaise += lineTotalPaise;

    validatedItems.push({
      product: product._id,
      name: product.name,
      unit: product.unit,
      isLoose,
      quantity: cleanQty,
      unitPricePaise,
      mrpPaise: product.mrpPaise,
      purchasePricePaise: product.purchasePricePaise,
      totalPaise: lineTotalPaise,
      returnedQuantity: 0,
    });
  }

  // If any item causes negative stock and override was not pre-authorized, halt and warn
  if (negativeStockWarnings.length > 0 && !allowNegativeOverride) {
    const err = new Error(
      `Stock warning: ${negativeStockWarnings.length} item(s) will drop into negative stock. Cashier authorization override required.`
    );
    err.isNegativeWarning = true;
    err.warnings = negativeStockWarnings;
    throw err;
  }

  // 2. Validate Discount & Final Amount
  const cleanDiscountPaise = Math.max(0, parseInt(discountPaise, 10) || 0);
  if (cleanDiscountPaise > calculatedSubtotalPaise) {
    throw new Error('Discount amount cannot exceed bill subtotal.');
  }

  const finalAmountPaise = calculatedSubtotalPaise - cleanDiscountPaise;

  // 3. Validate Payments
  if (!Array.isArray(payments) || payments.length === 0) {
    throw new Error('At least one payment entry is required.');
  }

  let totalPaidPaise = 0;
  const validatedPayments = [];

  for (const pay of payments) {
    const amt = parseInt(pay.amountPaise, 10);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Each payment method must have an amount greater than zero.');
    }

    totalPaidPaise += amt;

    const tendered = pay.cashTenderedPaise ? parseInt(pay.cashTenderedPaise, 10) : amt;
    const change = Math.max(0, tendered - amt);

    if (pay.method === 'CASH' && tendered < amt) {
      throw new Error(`Insufficient cash received: Tendered (₹${tendered / 100}) is less than cash payment (₹${amt / 100}).`);
    }

    validatedPayments.push({
      method: pay.method,
      amountPaise: amt,
      reference: pay.reference ? pay.reference.trim() : '',
      cashTenderedPaise: pay.method === 'CASH' ? tendered : 0,
      changeReturnedPaise: pay.method === 'CASH' ? change : 0,
    });
  }

  // Enforce: Sum of payments must exactly match finalAmountPaise
  if (totalPaidPaise !== finalAmountPaise) {
    throw new Error(
      `Payment mismatch: Total payments (₹${totalPaidPaise / 100}) do not equal final bill amount (₹${finalAmountPaise / 100}).`
    );
  }

  // Determine Payment Status
  const hasUdhaar = validatedPayments.some((p) => p.method === 'CREDIT_UDHAAR');
  const paymentStatus = hasUdhaar ? 'UDHAAR_CREDIT' : 'PAID';

  // 4. Generate Unique Sequential Invoice Number
  const invoiceNumber = await getNextInvoiceNumber();

  // 5. Execute Atomic Inventory Deductions through Ledger
  const ledgerTransactions = [];
  try {
    for (const item of validatedItems) {
      const stockRes = await recordStockMovement({
        productId: item.product,
        type: 'SALE',
        quantityDelta: -item.quantity,
        reason: `Retail Sale Invoice ${invoiceNumber}`,
        userId: user._id,
        userRole: user.role,
        referenceId: invoiceNumber,
        allowNegativeOverride: true,
        overrideReason: overrideReason ? overrideReason.trim() : 'POS checkout override',
      });
      ledgerTransactions.push(stockRes.transaction);
    }
  } catch (stockErr) {
    throw new Error(`Inventory deduction failed: ${stockErr.message}`);
  }

  // 6. Create and Save Sale Document
  const sale = await Sale.create({
    invoiceNumber,
    idempotencyKey: idempotencyKey ? idempotencyKey.trim() : undefined,
    customerName: customerName.trim() || 'Walk-in Customer',
    customerPhone: customerPhone ? customerPhone.trim() : '',
    customerId: customerId || null,
    items: validatedItems,
    subtotalPaise: calculatedSubtotalPaise,
    discountPaise: cleanDiscountPaise,
    finalAmountPaise,
    payments: validatedPayments,
    paymentStatus,
    status: 'COMPLETED',
    billedBy: user._id,
    notes: notes ? notes.trim() : '',
  });

  const populated = await Sale.findById(sale._id)
    .populate('billedBy', 'name username role')
    .populate('items.product', 'name barcodes unit category');

  return { sale: populated, isIdempotentReplay: false };
};

/**
 * Void / Cancel Completed Sale (Admin only)
 * Reverses inventory movements through the immutable ledger
 */
export const voidSale = async ({ saleId, voidReason, user }) => {
  if (!voidReason || !voidReason.trim()) {
    throw new Error('Mandatory cancellation reason is required.');
  }

  const sale = await Sale.findById(saleId);
  if (!sale) {
    throw new Error('Sale invoice not found.');
  }

  if (sale.status === 'VOIDED') {
    throw new Error(`Invoice '${sale.invoiceNumber}' is already voided.`);
  }

  if (sale.status === 'RETURNED_FULL') {
    throw new Error('Cannot void an invoice that has already been fully refunded through sales returns.');
  }

  // Reverse stock movements for each item back into inventory
  for (const item of sale.items) {
    const netSoldQty = item.quantity - (item.returnedQuantity || 0);
    if (netSoldQty > 0) {
      await recordStockMovement({
        productId: item.product,
        type: 'STOCK_CORRECTION',
        quantityDelta: netSoldQty,
        reason: `Voided Invoice ${sale.invoiceNumber}: ${voidReason.trim()}`,
        userId: user._id,
        userRole: user.role,
        referenceId: sale.invoiceNumber,
        allowNegativeOverride: true,
        overrideReason: 'Sale void stock restoration',
      });
    }
  }

  sale.status = 'VOIDED';
  sale.voidReason = voidReason.trim();
  sale.voidedBy = user._id;
  sale.voidedAt = new Date();
  await sale.save();

  const updatedSale = await Sale.findById(sale._id)
    .populate('billedBy', 'name username')
    .populate('voidedBy', 'name username');

  return updatedSale;
};

/**
 * Process Sales Return
 * Validates return quantity against sold quantity, issues refund, and logs SALE_RETURN ledger entry
 */
export const processSaleReturn = async ({
  saleId,
  returnedItems,
  refundMethod = 'CASH',
  reason,
  user,
}) => {
  if (!reason || !reason.trim()) {
    throw new Error('Return reason is required.');
  }

  if (!Array.isArray(returnedItems) || returnedItems.length === 0) {
    throw new Error('Please select at least one item to return.');
  }

  const sale = await Sale.findById(saleId);
  if (!sale) {
    throw new Error('Original sale invoice not found.');
  }

  if (sale.status === 'VOIDED') {
    throw new Error('Cannot process returns on a voided invoice.');
  }

  let totalRefundPaise = 0;
  const returnRecords = [];

  for (const ret of returnedItems) {
    const saleItem = sale.items.id(ret.saleItemId) || sale.items.find((i) => i.product.toString() === (ret.productId || ret.product));
    if (!saleItem) {
      throw new Error(`Item not found in original sale invoice '${sale.invoiceNumber}'.`);
    }

    const retQty = parseFloat(ret.quantity);
    if (isNaN(retQty) || retQty <= 0) {
      throw new Error(`Invalid return quantity for '${saleItem.name}'.`);
    }

    const alreadyReturned = saleItem.returnedQuantity || 0;
    const maxReturnable = saleItem.quantity - alreadyReturned;

    if (retQty > maxReturnable) {
      throw new Error(
        `Cannot return ${retQty} ${saleItem.unit} of '${saleItem.name}'. Maximum remaining returnable quantity is ${maxReturnable} ${saleItem.unit}.`
      );
    }

    const refundPaise = Math.round(retQty * saleItem.unitPricePaise);
    totalRefundPaise += refundPaise;

    // Update returned quantity on original sale item
    saleItem.returnedQuantity = alreadyReturned + retQty;

    // Create SALE_RETURN stock movement in ledger restoring returned stock
    await recordStockMovement({
      productId: saleItem.product,
      type: 'SALE_RETURN',
      quantityDelta: retQty,
      reason: `Return from Invoice ${sale.invoiceNumber}: ${reason.trim()}`,
      userId: user._id,
      userRole: user.role,
      referenceId: sale.invoiceNumber,
      allowNegativeOverride: true,
      overrideReason: 'Sale return stock restoration',
    });

    returnRecords.push({
      product: saleItem.product,
      name: saleItem.name,
      unit: saleItem.unit,
      returnedQuantity: retQty,
      unitPricePaise: saleItem.unitPricePaise,
      refundAmountPaise: refundPaise,
    });
  }

  const returnNumber = await getNextReturnNumber();

  const saleReturnDoc = await SaleReturn.create({
    returnNumber,
    originalSale: sale._id,
    invoiceNumber: sale.invoiceNumber,
    items: returnRecords,
    totalRefundPaise,
    refundMethod,
    reason: reason.trim(),
    processedBy: user._id,
  });

  // Check if all items in original sale are now fully returned
  const allFullyReturned = sale.items.every((i) => i.returnedQuantity >= i.quantity);
  sale.status = allFullyReturned ? 'RETURNED_FULL' : 'RETURNED_PARTIAL';
  await sale.save();

  return { saleReturn: saleReturnDoc, sale };
};
