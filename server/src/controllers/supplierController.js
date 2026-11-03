import {
  createSupplier,
  updateSupplier,
  getSuppliers,
  getSupplierById,
  recordSupplierPayment,
  getSupplierLedger,
  getSuppliersOverview,
} from '../services/supplierService.js';

export const handleCreateSupplier = async (req, res, next) => {
  try {
    const supplier = await createSupplier({
      ...req.body,
      user: req.user,
    });
    res.status(201).json({
      success: true,
      message: `Supplier '${supplier.name}' added successfully.`,
      supplier,
    });
  } catch (error) {
    next(error);
  }
};

export const handleUpdateSupplier = async (req, res, next) => {
  try {
    const supplier = await updateSupplier({
      supplierId: req.params.id,
      ...req.body,
    });
    res.status(200).json({
      success: true,
      message: 'Supplier profile updated successfully.',
      supplier,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSuppliers = async (req, res, next) => {
  try {
    const result = await getSuppliers(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSupplierById = async (req, res, next) => {
  try {
    const result = await getSupplierById(req.params.id);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleRecordSupplierPayment = async (req, res, next) => {
  try {
    const { amountPaise, paymentMethod, reference, notes, idempotencyKey } = req.body;
    const result = await recordSupplierPayment({
      supplierId: req.params.id,
      amountPaise,
      paymentMethod,
      reference,
      notes,
      idempotencyKey,
      user: req.user,
    });
    res.status(201).json({
      success: true,
      message: `Disbursement of ₹${result.transaction.amountPaise / 100} recorded. Voucher: ${result.voucherNumber}`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSupplierLedger = async (req, res, next) => {
  try {
    const result = await getSupplierLedger({
      supplierId: req.params.id,
      ...req.query,
    });
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSuppliersOverview = async (req, res, next) => {
  try {
    const overview = await getSuppliersOverview();
    res.status(200).json({
      success: true,
      overview,
    });
  } catch (error) {
    next(error);
  }
};
