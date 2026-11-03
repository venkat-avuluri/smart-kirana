import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier / Vendor name is required'],
      trim: true,
      maxlength: [100, 'Supplier name cannot exceed 100 characters'],
      index: true,
    },
    contactPerson: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Contact person cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      match: [/^(\+?91)?[6-9]\d{9}$|^$/, 'Please provide a valid 10-digit Indian phone number or leave blank'],
    },
    email: {
      type: String,
      trim: true,
      default: '',
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
      maxlength: [250, 'Address cannot exceed 250 characters'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    currentPayablePaise: {
      type: Number,
      default: 0,
      index: true,
      validate: {
        validator: Number.isInteger,
        message: 'Current payable balance must be an integer in paise',
      },
    },
    totalPurchasesPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Total purchases must be an integer in paise',
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

supplierSchema.index({ name: 'text', contactPerson: 'text', phone: 'text' });

const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;
