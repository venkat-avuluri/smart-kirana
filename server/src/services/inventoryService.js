import mongoose from 'mongoose';
import InventoryTransaction, { TRANSACTION_TYPES } from '../models/InventoryTransaction.js';
import Product, { LOOSE_UNITS } from '../models/Product.js';

/**
 * Core Inventory Movement Service
 * Ensures ledger is the immutable single source of truth and caches product.currentStock consistently.
 */
export const recordStockMovement = async ({
  productId,
  type,
  quantityDelta,
  reason,
  userId,
  userRole,
  referenceId = '',
  idempotencyKey = '',
  allowNegativeOverride = false,
  overrideReason = '',
}) => {
  if (!TRANSACTION_TYPES.includes(type)) {
    throw new Error(`Invalid transaction type: ${type}`);
  }

  if (typeof quantityDelta !== 'number' || isNaN(quantityDelta) || quantityDelta === 0) {
    throw new Error('Quantity delta must be a non-zero finite number.');
  }

  // Idempotency check: if already processed, return existing transaction
  if (idempotencyKey && idempotencyKey.trim()) {
    const existingTx = await InventoryTransaction.findOne({ idempotencyKey: idempotencyKey.trim() })
      .populate('product', 'name unit currentStock')
      .populate('user', 'name username');
    if (existingTx) {
      return {
        transaction: existingTx,
        product: existingTx.product,
        isIdempotentReplay: true,
      };
    }
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found.');
  }

  // Validate decimal precision
  const isLoose = LOOSE_UNITS.includes(product.unit);
  if (!isLoose && !Number.isInteger(quantityDelta)) {
    throw new Error(
      `Unit '${product.unit}' represents discrete items and does not accept fractional stock. Use whole numbers.`
    );
  }

  // Normalize loose quantities to 3 decimal places to prevent IEEE 754 floating point drift
  const cleanDelta = isLoose ? Math.round(quantityDelta * 1000) / 1000 : quantityDelta;
  const previousStock = isLoose ? Math.round(product.currentStock * 1000) / 1000 : product.currentStock;
  const calculatedNewStock = isLoose
    ? Math.round((previousStock + cleanDelta) * 1000) / 1000
    : previousStock + cleanDelta;

  // Duplicate Opening Stock Prevention
  if (type === 'OPENING_STOCK') {
    const existingOpening = await InventoryTransaction.findOne({
      product: product._id,
      type: 'OPENING_STOCK',
    });
    if (existingOpening) {
      throw new Error(
        `Opening stock has already been recorded for '${product.name}'. Use Stock Adjustment or Stock Correction instead.`
      );
    }
  }

  // Negative Stock Handling
  let isNegativeOverride = false;
  if (calculatedNewStock < 0) {
    if (!allowNegativeOverride) {
      const error = new Error(
        `Insufficient stock! Transaction would reduce '${product.name}' stock to ${calculatedNewStock} ${product.unit}. Authorized override required.`
      );
      error.isNegativeWarning = true;
      error.productName = product.name;
      error.currentStock = previousStock;
      error.resultingStock = calculatedNewStock;
      error.shortage = Math.abs(calculatedNewStock);
      error.unit = product.unit;
      throw error;
    }

    // Negative stock authorized
    isNegativeOverride = true;
  }

  // Attempt MongoDB transaction if replica set is enabled; otherwise fallback to atomic sequence
  let session = null;
  const isReplicaSet = Boolean(mongoose.connection?.client?.topology?.description?.type?.includes('ReplicaSet'));

  if (isReplicaSet) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    const opts = session ? { session } : {};

    // 1. Create Immutable Ledger Entry
    const [transaction] = await InventoryTransaction.create(
      [
        {
          product: product._id,
          type,
          quantityDelta: cleanDelta,
          quantity: Math.abs(cleanDelta),
          previousStock,
          newStock: calculatedNewStock,
          unit: product.unit,
          referenceId: referenceId ? referenceId.trim() : '',
          reason: reason.trim(),
          user: userId,
          isNegativeStockOverride: isNegativeOverride,
          overrideReason: isNegativeOverride ? (overrideReason ? overrideReason.trim() : 'Authorized override') : '',
          overrideAuthorizedBy: isNegativeOverride ? userId : null,
          idempotencyKey: idempotencyKey ? idempotencyKey.trim() : undefined,
        },
      ],
      opts
    );

    // 2. Atomically update cached stock on product
    product.currentStock = calculatedNewStock;
    await product.save(opts);

    if (session) {
      await session.commitTransaction();
    }

    const populatedTx = await InventoryTransaction.findById(transaction._id)
      .populate('product', 'name unit currentStock minStockLevel category')
      .populate('user', 'name username role')
      .populate('overrideAuthorizedBy', 'name username');

    return {
      transaction: populatedTx,
      product,
      isIdempotentReplay: false,
    };
  } catch (err) {
    if (session) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

/**
 * Calculate Store Inventory Valuation using Purchase Cost
 * Valuation = Sum of (currentStock * purchasePricePaise)
 */
export const calculateStockValuation = async () => {
  const products = await Product.find({ isActive: true })
    .populate('category', 'name')
    .select('name unit currentStock purchasePricePaise sellingPricePaise category minStockLevel');

  let totalValuationPaise = 0;
  let totalRetailRevenuePaise = 0;
  let totalPositiveItemsCount = 0;
  let negativeStockItemCount = 0;

  const categoryBreakdown = {};

  products.forEach((p) => {
    const stock = Number(p.currentStock) || 0;
    const catName = p.category?.name || 'Uncategorized';

    if (!categoryBreakdown[catName]) {
      categoryBreakdown[catName] = {
        categoryName: catName,
        productCount: 0,
        valuationPaise: 0,
        retailValuePaise: 0,
      };
    }

    categoryBreakdown[catName].productCount += 1;

    if (stock > 0) {
      const itemValuation = Math.round(stock * p.purchasePricePaise);
      const itemRetail = Math.round(stock * p.sellingPricePaise);

      totalValuationPaise += itemValuation;
      totalRetailRevenuePaise += itemRetail;
      totalPositiveItemsCount += 1;

      categoryBreakdown[catName].valuationPaise += itemValuation;
      categoryBreakdown[catName].retailValuePaise += itemRetail;
    } else if (stock < 0) {
      negativeStockItemCount += 1;
    }
  });

  const estimatedGrossProfitPaise = Math.max(0, totalRetailRevenuePaise - totalValuationPaise);
  const potentialMarginPercent =
    totalRetailRevenuePaise > 0
      ? ((estimatedGrossProfitPaise / totalRetailRevenuePaise) * 100).toFixed(1)
      : '0.0';

  return {
    totalProductsCount: products.length,
    positiveStockProductsCount: totalPositiveItemsCount,
    negativeStockItemCount,
    valuationPaise: totalValuationPaise,
    retailRevenuePaise: totalRetailRevenuePaise,
    estimatedGrossProfitPaise,
    potentialMarginPercent,
    categoryBreakdown: Object.values(categoryBreakdown),
    methodology: 'Weighted Average Purchase Cost: Sum(currentStock * purchasePricePaise)',
    note: 'Valuation is computed strictly at cost of goods purchased, not selling-price revenue.',
  };
};
