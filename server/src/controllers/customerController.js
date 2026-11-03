import {
  createCustomer,
  updateCustomer,
  getCustomers,
  getCustomerById,
  recordCustomerPayment,
  getCustomerLedger,
  getUdhaarSummary,
} from '../services/customerService.js';

export const handleCreateCustomer = async (req, res, next) => {
  try {
    const customer = await createCustomer({
      ...req.body,
      user: req.user,
    });
    res.status(201).json({
      success: true,
      message: `Customer '${customer.name}' registered successfully.`,
      customer,
    });
  } catch (error) {
    next(error);
  }
};

export const handleUpdateCustomer = async (req, res, next) => {
  try {
    const customer = await updateCustomer({
      customerId: req.params.id,
      ...req.body,
    });
    res.status(200).json({
      success: true,
      message: 'Customer profile updated successfully.',
      customer,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetCustomers = async (req, res, next) => {
  try {
    const result = await getCustomers(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetCustomerById = async (req, res, next) => {
  try {
    const result = await getCustomerById(req.params.id);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleRecordCustomerPayment = async (req, res, next) => {
  try {
    const { amountPaise, paymentMethod, reference, notes, idempotencyKey } = req.body;
    const result = await recordCustomerPayment({
      customerId: req.params.id,
      amountPaise,
      paymentMethod,
      reference,
      notes,
      idempotencyKey,
      user: req.user,
    });
    res.status(201).json({
      success: true,
      message: `Payment of ₹${result.transaction.amountPaise / 100} recorded. Receipt: ${result.receiptNumber}`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetCustomerLedger = async (req, res, next) => {
  try {
    const result = await getCustomerLedger({
      customerId: req.params.id,
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

export const handleGetUdhaarSummary = async (req, res, next) => {
  try {
    const summary = await getUdhaarSummary();
    res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    next(error);
  }
};
