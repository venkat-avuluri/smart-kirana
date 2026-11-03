import Sale from '../models/Sale.js';
import SaleReturn from '../models/SaleReturn.js';
import { createPosSale, voidSale, processSaleReturn } from '../services/posService.js';

const sanitizeSaleForRole = (saleDoc, role) => {
  if (!saleDoc) return null;
  const obj = typeof saleDoc.toObject === 'function' ? saleDoc.toObject() : { ...saleDoc };
  if (role === 'STAFF') {
    if (Array.isArray(obj.items)) {
      obj.items = obj.items.map((item) => {
        const itemObj = typeof item.toObject === 'function' ? item.toObject() : { ...item };
        delete itemObj.purchasePricePaise;
        return itemObj;
      });
    }
  }
  return obj;
};

/**
 * @desc    Process POS checkout & generate invoice
 * @route   POST /api/v1/pos/checkout
 * @access  Private (Admin & Staff)
 */
export const checkout = async (req, res, next) => {
  try {
    const {
      items,
      discountPaise,
      payments,
      customerName,
      customerPhone,
      customerId,
      notes,
      allowNegativeOverride,
      overrideReason,
      idempotencyKey,
      simulateFailure,
    } = req.body;

    const result = await createPosSale({
      items,
      discountPaise,
      payments,
      customerName,
      customerPhone,
      customerId,
      notes,
      allowNegativeOverride,
      overrideReason,
      idempotencyKey,
      simulateFailure: Boolean(simulateFailure),
      user: req.user,
    });

    const sanitizedSale = sanitizeSaleForRole(result.sale, req.user.role);

    res.status(201).json({
      success: true,
      message: `Sale completed! Invoice ${result.sale.invoiceNumber} generated.`,
      ...result,
      sale: sanitizedSale,
    });
  } catch (error) {
    if (error.isNegativeWarning) {
      return res.status(400).json({
        success: false,
        isNegativeWarning: true,
        message: error.message,
        warnings: error.warnings,
      });
    }
    next(error);
  }
};

/**
 * @desc    Get sales billing history with filters & pagination
 * @route   GET /api/v1/pos/sales
 * @access  Private (Admin & Staff)
 */
export const getSalesHistory = async (req, res, next) => {
  try {
    const {
      invoiceNumber,
      startDate,
      endDate,
      paymentMethod,
      status,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (invoiceNumber && invoiceNumber.trim()) {
      filter.invoiceNumber = { $regex: invoiceNumber.trim(), $options: 'i' };
    }

    if (status) {
      filter.status = status;
    }

    if (paymentMethod) {
      filter['payments.method'] = paymentMethod;
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
        { invoiceNumber: { $regex: clean, $options: 'i' } },
        { customerName: { $regex: clean, $options: 'i' } },
        { customerPhone: { $regex: clean, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .populate('billedBy', 'name username role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Sale.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    const sanitizedSales = sales.map((s) => sanitizeSaleForRole(s, req.user.role));

    res.status(200).json({
      success: true,
      count: sanitizedSales.length,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      sales: sanitizedSales,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single sale bill details for printing & viewing
 * @route   GET /api/v1/pos/sales/:id
 * @access  Private (Admin & Staff)
 */
export const getSaleById = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('billedBy', 'name username role')
      .populate('voidedBy', 'name username')
      .populate('items.product', 'name barcodes unit category');

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found.' });
    }

    // Also fetch associated returns if any
    const returns = await SaleReturn.find({ originalSale: sale._id })
      .populate('processedBy', 'name username')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      sale: sanitizeSaleForRole(sale, req.user.role),
      returns,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Find sale by invoice number (for returns or lookup)
 * @route   GET /api/v1/pos/sales/invoice/:invoiceNumber
 * @access  Private (Admin & Staff)
 */
export const getSaleByInvoiceNumber = async (req, res, next) => {
  try {
    const cleanInvoice = req.params.invoiceNumber.trim();
    const sale = await Sale.findOne({
      invoiceNumber: { $regex: new RegExp(`^${cleanInvoice}$`, 'i') },
    })
      .populate('billedBy', 'name username')
      .populate('items.product', 'name unit currentStock');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: `Invoice '${cleanInvoice}' was not found.`,
      });
    }

    const returns = await SaleReturn.find({ originalSale: sale._id });

    res.status(200).json({
      success: true,
      sale: sanitizeSaleForRole(sale, req.user.role),
      returns,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Void / Cancel sale invoice (Admin only)
 * @route   POST /api/v1/pos/sales/:id/void
 * @access  Private (Admin only)
 */
export const voidSaleInvoice = async (req, res, next) => {
  try {
    const { voidReason } = req.body;
    const updatedSale = await voidSale({
      saleId: req.params.id,
      voidReason,
      user: req.user,
    });

    res.status(200).json({
      success: true,
      message: `Invoice '${updatedSale.invoiceNumber}' was successfully voided and inventory movements were reversed.`,
      sale: updatedSale,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Process Sales Return & Refund
 * @route   POST /api/v1/pos/sales/:id/return
 * @access  Private (Admin & Staff)
 */
export const processReturn = async (req, res, next) => {
  try {
    const { returnedItems, refundMethod, reason } = req.body;
    const result = await processSaleReturn({
      saleId: req.params.id,
      returnedItems,
      refundMethod,
      reason,
      user: req.user,
    });

    res.status(201).json({
      success: true,
      message: `Return ${result.saleReturn.returnNumber} processed successfully.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get returns history
 * @route   GET /api/v1/pos/returns
 * @access  Private (Admin & Staff)
 */
export const getReturnsHistory = async (req, res, next) => {
  try {
    const returns = await SaleReturn.find()
      .populate('processedBy', 'name username')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: returns.length,
      returns,
    });
  } catch (error) {
    next(error);
  }
};
