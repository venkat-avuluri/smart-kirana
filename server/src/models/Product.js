import mongoose from 'mongoose';

const VALID_UNITS = ['kg', 'g', 'L', 'ml', 'piece', 'packet'];
const LOOSE_UNITS = ['kg', 'g', 'L', 'ml'];

const priceHistorySchema = new mongoose.Schema(
  {
    purchasePricePaise: {
      type: Number,
      required: true,
    },
    sellingPricePaise: {
      type: Number,
      required: true,
    },
    mrpPaise: {
      type: Number,
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [120, 'Product name cannot exceed 120 characters'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    barcodes: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
      index: true,
    },
    unit: {
      type: String,
      required: [true, 'Unit of measurement is required'],
      enum: {
        values: VALID_UNITS,
        message: `Unit must be one of: ${VALID_UNITS.join(', ')}`,
      },
    },
    isLoose: {
      type: Boolean,
      default: false,
    },
    purchasePricePaise: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Purchase price must be an integer (in paise)',
      },
    },
    sellingPricePaise: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Selling price must be an integer (in paise)',
      },
    },
    mrpPaise: {
      type: Number,
      required: [true, 'MRP is required'],
      min: [0, 'MRP cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'MRP must be an integer (in paise)',
      },
    },
    currentStock: {
      type: Number,
      default: 0,
      validate: {
        validator: function (val) {
          // If non-loose (piece/packet), should typically be whole or half; loose supports 3 decimal digits
          if (!this.isLoose && !LOOSE_UNITS.includes(this.unit)) {
            // Whole numbers or decimals if explicitly allowed
            return Number.isFinite(val);
          }
          return Number.isFinite(val);
        },
        message: 'Invalid stock value',
      },
    },
    minStockLevel: {
      type: Number,
      default: 5,
      min: [0, 'Minimum stock level cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priceHistory: [priceHistorySchema],
  },
  {
    timestamps: true,
  }
);

// Auto-determine isLoose based on unit if not explicitly set
productSchema.pre('save', function (next) {
  if (LOOSE_UNITS.includes(this.unit)) {
    this.isLoose = true;
  }

  // Filter out empty barcode strings and duplicates within the product
  if (Array.isArray(this.barcodes)) {
    this.barcodes = [...new Set(this.barcodes.filter((b) => b && typeof b === 'string' && b.trim() !== ''))];
  }

  // Validation: Selling price cannot exceed MRP
  if (this.sellingPricePaise > this.mrpPaise) {
    return next(new Error(`Selling price (₹${this.sellingPricePaise / 100}) cannot exceed MRP (₹${this.mrpPaise / 100}).`));
  }

  next();
});

// Text index for search
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ isActive: 1, currentStock: 1 });
productSchema.index({ category: 1, isActive: 1 });

const Product = mongoose.model('Product', productSchema);
export default Product;
export { VALID_UNITS, LOOSE_UNITS };
