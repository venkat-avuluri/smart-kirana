import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters'],
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      match: [/^(\+?91)?[6-9]\d{9}$|^$/, 'Please provide a valid 10-digit Indian mobile number or leave blank'],
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
    currentBalancePaise: {
      type: Number,
      default: 0,
      index: true,
      validate: {
        validator: Number.isInteger,
        message: 'Current balance must be an integer in paise',
      },
    },
    totalPurchasesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSpentPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Total spent must be an integer in paise',
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

// Prevent duplicate customers based on phone number where a non-empty phone is provided
customerSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: 'string', $gt: '' } },
  }
);

// Text search index for fast name/phone autocomplete
customerSchema.index({ name: 'text', phone: 'text' });

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
