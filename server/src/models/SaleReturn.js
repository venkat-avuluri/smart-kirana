import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
    },
    returnedQuantity: {
      type: Number,
      required: true,
      min: [0.001, 'Returned quantity must be greater than zero'],
    },
    unitPricePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    refundAmountPaise: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const saleReturnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    originalSale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [returnItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: 'Return must contain at least one product item.',
      },
    },
    totalRefundPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Total refund must be an integer in paise',
      },
    },
    refundMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'CREDIT_ADJUSTMENT'],
      default: 'CASH',
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Return reason is required'],
      trim: true,
      maxlength: [300, 'Reason cannot exceed 300 characters'],
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

saleReturnSchema.index({ createdAt: -1 });

const SaleReturn = mongoose.model('SaleReturn', saleReturnSchema);
export default SaleReturn;
