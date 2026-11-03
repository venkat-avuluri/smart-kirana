import mongoose from 'mongoose';

export const CUSTOMER_TX_TYPES = [
  'CREDIT_SALE',
  'PAYMENT',
  'OPENING_BALANCE',
  'ADJUSTMENT',
  'SALE_VOID',
];

const customerTransactionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: CUSTOMER_TX_TYPES,
        message: `Type must be one of: ${CUSTOMER_TX_TYPES.join(', ')}`,
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
    receiptNumber: {
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
    timestamps: { createdAt: true, updatedAt: false }, // Immutable: no updatedAt
  }
);

// Immutability Guards: Prevent editing or deleting completed financial ledger records
customerTransactionSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Immutable Customer Credit Ledger: Historical customer transactions cannot be modified.');
  }
});

customerTransactionSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function () {
  throw new Error('Immutable Customer Credit Ledger: Updates to customer transaction records are strictly prohibited.');
});

customerTransactionSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('Immutable Customer Credit Ledger: Deletions of customer transaction records are strictly prohibited.');
});

const CustomerTransaction = mongoose.model('CustomerTransaction', customerTransactionSchema);
export default CustomerTransaction;
