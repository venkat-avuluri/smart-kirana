import {
  createPurchase,
  cancelPurchase,
  getPurchases,
  getPurchaseById,
} from '../services/purchaseService.js';

export const handleCreatePurchase = async (req, res, next) => {
  try {
    const result = await createPurchase({
      ...req.body,
      user: req.user,
    });
    res.status(201).json({
      success: true,
      message: `Purchase '${result.purchase.purchaseNumber}' completed and stock added to inventory.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleCancelPurchase = async (req, res, next) => {
  try {
    const { cancellationReason } = req.body;
    const purchase = await cancelPurchase({
      purchaseId: req.params.id,
      cancellationReason,
      user: req.user,
    });
    res.status(200).json({
      success: true,
      message: `Purchase '${purchase.purchaseNumber}' was cancelled and stock was reversed.`,
      purchase,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetPurchases = async (req, res, next) => {
  try {
    const result = await getPurchases(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetPurchaseById = async (req, res, next) => {
  try {
    const purchase = await getPurchaseById(req.params.id);
    res.status(200).json({
      success: true,
      purchase,
    });
  } catch (error) {
    next(error);
  }
};
