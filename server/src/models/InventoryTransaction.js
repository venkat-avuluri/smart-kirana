import mongoose from 'mongoose';

export const TRANSACTION_TYPES = [
  'OPENING_STOCK',
  'PURCHASE',
  'SALE',
  'SALE_RETURN',
  'MANUAL_ADJUSTMENT',
  'DAMAGE',
  'WASTAGE',
  'STOCK_CORRECTION',
];

const inventoryTransactionSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: TRANSACTION_TYPES,
        message: `Type must be one of: ${TRANSACTION_TYPES.join(', ')}`,
      },
      index: true,
    },
    quantityDelta: {
      type: Number,
      required: [true, 'Quantity delta is required'],
      validate: {
        validator: Number.isFinite,
        message: 'Quantity delta must be a finite number',
      },
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity magnitude is required'],
      min: [0, 'Quantity magnitude cannot be negative'],
      validate: {
        validator: Number.isFinite,
        message: 'Quantity must be a finite number',
      },
    },
    previousStock: {
      type: Number,
      required: [true, 'Previous stock is required'],
      validate: {
        validator: Number.isFinite,
        message: 'Previous stock must be a finite number',
      },
    },
    newStock: {
      type: Number,
      required: [true, 'New stock is required'],
      validate: {
        validator: Number.isFinite,
        message: 'New stock must be a finite number',
      },
    },
    unit: {
      type: String,
      required: [true, 'Unit of measurement is required'],
    },
    referenceId: {
      type: String,
      trim: true,
      default: '',
    },
    reason: {
      type: String,
      required: [true, 'Reason for inventory movement is required'],
      trim: true,
      maxlength: [300, 'Reason cannot exceed 300 characters'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User who performed the operation is required'],
      index: true,
    },
    isNegativeStockOverride: {
      type: Boolean,
      default: false,
      index: true,
    },
    overrideReason: {
      type: String,
      trim: true,
      default: '',
    },
    overrideAuthorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable: no updatedAt
  }
);

// Immutability Guard: strictly forbid updating existing ledger records
inventoryTransactionSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Immutable Ledger Violation: Historical inventory movements cannot be modified.'));
  }
  next();
});

// Indexes for high-performance ledger queries
inventoryTransactionSchema.index({ product: 1, createdAt: -1 });
inventoryTransactionSchema.index({ type: 1, createdAt: -1 });

const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
export default InventoryTransaction;
