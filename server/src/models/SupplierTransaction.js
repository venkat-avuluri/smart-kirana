import mongoose from 'mongoose';

export const SUPPLIER_TX_TYPES = [
  'PURCHASE',
  'PAYMENT',
  'PURCHASE_CANCEL',
  'ADJUSTMENT',
];

const supplierTransactionSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier reference is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: SUPPLIER_TX_TYPES,
        message: `Type must be one of: ${SUPPLIER_TX_TYPES.join(', ')}`,
      },
      index: true,
    },
    amountPaise: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be greater than zero'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer in paise',
      },
    },
    deltaPaise: {
      type: Number,
      required: [true, 'Signed balance delta is required'],
      validate: {
        validator: Number.isInteger,
        message: 'Delta must be an integer in paise',
      },
    },
    balanceBeforePaise: {
      type: Number,
      required: [true, 'Balance before is required'],
      validate: {
        validator: Number.isInteger,
        message: 'Balance before must be an integer in paise',
      },
    },
    balanceAfterPaise: {
      type: Number,
      required: [true, 'Balance after is required'],
      validate: {
        validator: Number.isInteger,
        message: 'Balance after must be an integer in paise',
      },
    },
    referenceId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    voucherNumber: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'NONE'],
      default: 'NONE',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable
  }
);

// Immutability Guards: Prevent editing or deleting completed financial ledger records
supplierTransactionSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Immutable Supplier Ledger: Historical transactions cannot be modified.');
  }
});

supplierTransactionSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function () {
  throw new Error('Immutable Supplier Ledger: Updates to supplier transaction records are strictly prohibited.');
});

supplierTransactionSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('Immutable Supplier Ledger: Deletions of supplier transaction records are strictly prohibited.');
});

const SupplierTransaction = mongoose.model('SupplierTransaction', supplierTransactionSchema);
export default SupplierTransaction;
