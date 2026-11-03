import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema(
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
    isLoose: {
      type: Boolean,
      default: false,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.001, 'Quantity must be at least 0.001'],
      validate: {
        validator: Number.isFinite,
        message: 'Quantity must be a valid number',
      },
    },
    unitPricePaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Unit price must be an integer in paise',
      },
    },
    mrpPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    purchasePricePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Line item total must be an integer in paise',
      },
    },
    returnedQuantity: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const paymentRecordSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['CASH', 'UPI', 'CREDIT_UDHAAR'],
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Payment amount must be an integer in paise',
      },
    },
    reference: {
      type: String,
      trim: true,
      default: '',
    },
    cashTenderedPaise: {
      type: Number,
      default: 0,
    },
    changeReturnedPaise: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    customerName: {
      type: String,
      default: 'Walk-in Customer',
      trim: true,
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    items: {
      type: [saleItemSchema],
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: 'Sale must contain at least one product item.',
      },
    },
    subtotalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Subtotal must be an integer in paise',
      },
    },
    discountPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Discount must be an integer in paise',
      },
    },
    finalAmountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Final amount must be an integer in paise',
      },
    },
    payments: {
      type: [paymentRecordSchema],
      required: true,
      validate: {
        validator: function (payments) {
          return Array.isArray(payments) && payments.length > 0;
        },
        message: 'At least one payment method entry is required.',
      },
    },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'PARTIALLY_PAID', 'UDHAAR_CREDIT'],
      default: 'PAID',
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'VOIDED', 'RETURNED_PARTIAL', 'RETURNED_FULL'],
      default: 'COMPLETED',
      index: true,
    },
    voidReason: {
      type: String,
      default: '',
      trim: true,
    },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    voidedAt: {
      type: Date,
      default: null,
    },
    billedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ status: 1, createdAt: -1 });

const Sale = mongoose.model('Sale', saleSchema);
export default Sale;
