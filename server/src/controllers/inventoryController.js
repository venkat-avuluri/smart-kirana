import InventoryTransaction, { TRANSACTION_TYPES } from '../models/InventoryTransaction.js';
import Product, { LOOSE_UNITS } from '../models/Product.js';
import { recordStockMovement, calculateStockValuation } from '../services/inventoryService.js';
import { parseCSV } from '../utils/csvParser.js';

/**
 * @desc    Stock-In: Record inventory receipt / purchase
 * @route   POST /api/v1/inventory/stock-in
 * @access  Private (Admin only)
 */
export const recordStockIn = async (req, res, next) => {
  try {
    const { productId, quantity, referenceId, reason = 'Inventory Stock-In', idempotencyKey } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive number.' });
    }

    const result = await recordStockMovement({
      productId,
      type: 'PURCHASE',
      quantityDelta: numQty,
      reason,
      userId: req.user._id,
      userRole: req.user.role,
      referenceId,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      message: `Successfully stocked in ${numQty} ${result.product.unit} of '${result.product.name}'.`,
      ...result,
    });
  } catch (error) {
    if (error.isNegativeWarning) {
      return res.status(400).json({
        success: false,
        isNegativeWarning: true,
        message: error.message,
        details: {
          productName: error.productName,
          currentStock: error.currentStock,
          resultingStock: error.resultingStock,
          shortage: error.shortage,
          unit: error.unit,
        },
      });
    }
    next(error);
  }
};

/**
 * @desc    Stock-Out: Record damage, wastage, or removal
 * @route   POST /api/v1/inventory/stock-out
 * @access  Private (Admin only)
 */
export const recordStockOut = async (req, res, next) => {
  try {
    const {
      productId,
      quantity,
      type = 'DAMAGE',
      reason,
      referenceId,
      allowNegativeOverride = false,
      overrideReason,
      idempotencyKey,
    } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive number.' });
    }

    const validOutTypes = ['DAMAGE', 'WASTAGE', 'MANUAL_ADJUSTMENT'];
    const chosenType = validOutTypes.includes(type) ? type : 'DAMAGE';

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'A specific reason is required for stock removal.' });
    }

    const result = await recordStockMovement({
      productId,
      type: chosenType,
      quantityDelta: -numQty,
      reason,
      userId: req.user._id,
      userRole: req.user.role,
      referenceId,
      allowNegativeOverride,
      overrideReason,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      message: `Successfully recorded stock removal of ${numQty} ${result.product.unit} for '${result.product.name}'.`,
      ...result,
    });
  } catch (error) {
    if (error.isNegativeWarning) {
      return res.status(400).json({
        success: false,
        isNegativeWarning: true,
        message: error.message,
        details: {
          productName: error.productName,
          currentStock: error.currentStock,
          resultingStock: error.resultingStock,
          shortage: error.shortage,
          unit: error.unit,
        },
      });
    }
    next(error);
  }
};

/**
 * @desc    Opening Stock: Record actual initial shop quantities
 * @route   POST /api/v1/inventory/opening-stock
 * @access  Private (Admin only)
 */
export const recordOpeningStock = async (req, res, next) => {
  try {
    const {
      productId,
      quantity,
      reason = 'Initial store opening count',
      idempotencyKey,
    } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty < 0) {
      return res.status(400).json({ success: false, message: 'Opening quantity must be a non-negative number.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Delta needed to reach opening stock from initial 0
    const delta = numQty - product.currentStock;

    const result = await recordStockMovement({
      productId,
      type: 'OPENING_STOCK',
      quantityDelta: delta,
      reason,
      userId: req.user._id,
      userRole: req.user.role,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      message: `Recorded opening stock of ${numQty} ${result.product.unit} for '${result.product.name}'.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Manual Stock Adjustment: Increase or decrease stock with audit trail
 * @route   POST /api/v1/inventory/adjust
 * @access  Private (Admin only)
 */
export const recordStockAdjustment = async (req, res, next) => {
  try {
    const {
      productId,
      adjustmentMode = 'ADD_DELTA', // 'SET_TARGET' or 'ADD_DELTA'
      value,
      type = 'MANUAL_ADJUSTMENT',
      reason,
      allowNegativeOverride = false,
      overrideReason,
      idempotencyKey,
    } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Adjustment reason is required.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    let delta = 0;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) {
      return res.status(400).json({ success: false, message: 'Adjustment value must be a valid number.' });
    }

    if (adjustmentMode === 'SET_TARGET') {
      delta = numVal - product.currentStock;
    } else {
      delta = numVal;
    }

    if (delta === 0) {
      return res.status(400).json({
        success: false,
        message: 'Adjustment resulted in zero change to current stock.',
      });
    }

    const chosenType = ['MANUAL_ADJUSTMENT', 'STOCK_CORRECTION'].includes(type)
      ? type
      : 'MANUAL_ADJUSTMENT';

    const result = await recordStockMovement({
      productId,
      type: chosenType,
      quantityDelta: delta,
      reason,
      userId: req.user._id,
      userRole: req.user.role,
      allowNegativeOverride,
      overrideReason,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      message: `Stock adjusted for '${product.name}' (Change: ${delta > 0 ? '+' : ''}${delta} ${product.unit}).`,
      ...result,
    });
  } catch (error) {
    if (error.isNegativeWarning) {
      return res.status(400).json({
        success: false,
        isNegativeWarning: true,
        message: error.message,
        details: {
          productName: error.productName,
          currentStock: error.currentStock,
          resultingStock: error.resultingStock,
          shortage: error.shortage,
          unit: error.unit,
        },
      });
    }
    next(error);
  }
};

/**
 * @desc    Import Opening Stock from CSV with dry-run validation
 * @route   POST /api/v1/inventory/opening-stock/csv
 * @access  Private (Admin only)
 */
export const importOpeningStockCSV = async (req, res, next) => {
  try {
    const { csvText, dryRun = false } = req.body;

    if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
      return res.status(400).json({ success: false, message: 'CSV data string is required.' });
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'CSV contains no valid rows.' });
    }

    const errors = [];
    const validatedRows = [];

    // Pre-fetch all products & opening stock records
    const allProducts = await Product.find({ isActive: true });
    const productByName = new Map();
    const productByBarcode = new Map();
    allProducts.forEach((p) => {
      productByName.set(p.name.toLowerCase().trim(), p);
      p.barcodes.forEach((bc) => productByBarcode.set(bc.trim(), p));
    });

    const existingOpeningTxList = await InventoryTransaction.find({ type: 'OPENING_STOCK' });
    const existingOpeningProductIds = new Set(existingOpeningTxList.map((tx) => tx.product.toString()));

    for (const row of rows) {
      const rowNum = row._rowNumber;
      const identifier = (row.Name || row.name || row.Barcode || row.barcode || '').trim();
      const qtyStr = (row.OpeningStock || row.openingStock || row.Quantity || row.quantity || '').trim();
      const reason = (row.Reason || row.reason || 'CSV Bulk Opening Stock').trim();

      if (!identifier) {
        errors.push({ row: rowNum, field: 'Name/Barcode', message: 'Product Name or Barcode is required.' });
        continue;
      }

      // Lookup product by name or barcode
      let product = productByName.get(identifier.toLowerCase()) || productByBarcode.get(identifier);
      if (!product) {
        errors.push({ row: rowNum, field: 'Name/Barcode', message: `Product '${identifier}' not found in store catalog.` });
        continue;
      }

      // Check duplicate opening stock
      if (existingOpeningProductIds.has(product._id.toString())) {
        errors.push({
          row: rowNum,
          field: 'Name',
          message: `Opening stock already recorded for '${product.name}'. Duplicate not allowed.`,
        });
        continue;
      }

      const qty = parseFloat(qtyStr);
      if (isNaN(qty) || qty < 0) {
        errors.push({ row: rowNum, field: 'OpeningStock', message: 'Opening quantity must be a non-negative number.' });
        continue;
      }

      const isLoose = LOOSE_UNITS.includes(product.unit);
      if (!isLoose && !Number.isInteger(qty)) {
        errors.push({
          row: rowNum,
          field: 'OpeningStock',
          message: `Unit '${product.unit}' represents discrete items and does not accept fractional stock.`,
        });
        continue;
      }

      validatedRows.push({
        product,
        quantity: qty,
        reason,
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Opening stock CSV validation failed with ${errors.length} error(s).`,
        totalRows: rows.length,
        invalidCount: errors.length,
        errors,
      });
    }

    if (dryRun === true || dryRun === 'true') {
      return res.status(200).json({
        success: true,
        dryRun: true,
        message: `Validation successful! All ${validatedRows.length} opening stock entries are valid and ready to commit.`,
        totalCount: validatedRows.length,
        preview: validatedRows.slice(0, 5).map((r) => ({
          productName: r.product.name,
          unit: r.product.unit,
          currentStock: r.product.currentStock,
          newOpeningStock: r.quantity,
          reason: r.reason,
        })),
      });
    }

    // Execute opening stock commits
    const createdTransactions = [];
    for (const item of validatedRows) {
      const delta = item.quantity - item.product.currentStock;
      const res = await recordStockMovement({
        productId: item.product._id,
        type: 'OPENING_STOCK',
        quantityDelta: delta,
        reason: item.reason,
        userId: req.user._id,
        userRole: req.user.role,
      });
      createdTransactions.push(res.transaction);
    }

    res.status(201).json({
      success: true,
      message: `Successfully recorded opening stock for ${createdTransactions.length} products.`,
      importedCount: createdTransactions.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get paginated immutable inventory ledger movements
 * @route   GET /api/v1/inventory/ledger
 * @access  Private (Admin & Staff permitted view)
 */
export const getLedgerHistory = async (req, res, next) => {
  try {
    const {
      productId,
      type,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 25,
    } = req.query;

    const filter = {};

    if (productId) {
      filter.product = productId;
    }

    if (type && TRANSACTION_TYPES.includes(type)) {
      filter.type = type;
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

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Optional text search on reason or referenceId
    if (search && search.trim()) {
      const clean = search.trim();
      filter.$or = [
        { reason: { $regex: clean, $options: 'i' } },
        { referenceId: { $regex: clean, $options: 'i' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      InventoryTransaction.find(filter)
        .populate('product', 'name unit currentStock minStockLevel category barcodes')
        .populate('user', 'name username role')
        .populate('overrideAuthorizedBy', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      InventoryTransaction.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Store Inventory Valuation Report
 * @route   GET /api/v1/inventory/valuation
 * @access  Private (Admin only)
 */
export const getStockValuationReport = async (req, res, next) => {
  try {
    const report = await calculateStockValuation();
    res.status(200).json({
      success: true,
      ...report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Low Stock Items Report
 * @route   GET /api/v1/inventory/low-stock
 * @access  Private (Admin & Staff)
 */
export const getLowStockReport = async (req, res, next) => {
  try {
    const { category, page = 1, limit = 50 } = req.query;
    const filter = {
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minStockLevel'] },
    };

    if (category) {
      filter.category = category;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name')
        .sort({ currentStock: 1 })
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    const isStaff = req.user.role === 'STAFF';
    const enriched = items.map((p) => {
      const shortage = Math.max(0, p.minStockLevel - p.currentStock);
      const obj = p.toObject();
      if (isStaff) {
        delete obj.purchasePricePaise;
        delete obj.priceHistory;
      }
      return {
        ...obj,
        shortage,
        isCritical: p.currentStock <= 0,
      };
    });

    res.status(200).json({
      success: true,
      count: enriched.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      items: enriched,
    });
  } catch (error) {
    next(error);
  }
};
