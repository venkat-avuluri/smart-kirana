import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { rupeesToPaise, paiseToRupees } from '../utils/formatters';
import {
  Package,
  Plus,
  Loader2,
  X,
  AlertCircle,
  Barcode,
  Percent,
} from 'lucide-react';

const VALID_UNITS = [
  { value: 'kg', label: 'Kilograms (kg) - Loose Weight' },
  { value: 'g', label: 'Grams (g) - Loose Weight' },
  { value: 'L', label: 'Litres (L) - Loose Liquid' },
  { value: 'ml', label: 'Millilitres (ml) - Loose Liquid' },
  { value: 'piece', label: 'Pieces (piece) - Unit Count' },
  { value: 'packet', label: 'Packets (packet) - Packaged Goods' },
];

const LOOSE_UNITS = ['kg', 'g', 'L', 'ml'];

export const ProductModal = ({ isOpen, onClose, product, categories, onSuccess }) => {
  const isEdit = Boolean(product);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    unit: 'kg',
    purchasePriceRupees: '',
    sellingPriceRupees: '',
    mrpRupees: '',
    currentStock: '0',
    minStockLevel: '5',
    barcodes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        category: product.category?._id || product.category || '',
        unit: product.unit || 'kg',
        purchasePriceRupees: paiseToRupees(product.purchasePricePaise).toString(),
        sellingPriceRupees: paiseToRupees(product.sellingPricePaise).toString(),
        mrpRupees: paiseToRupees(product.mrpPaise).toString(),
        currentStock: product.currentStock?.toString() || '0',
        minStockLevel: product.minStockLevel?.toString() || '5',
        barcodes: Array.isArray(product.barcodes) ? product.barcodes.join(', ') : '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: categories.length > 0 ? categories[0]._id : '',
        unit: 'kg',
        purchasePriceRupees: '',
        sellingPriceRupees: '',
        mrpRupees: '',
        currentStock: '0',
        minStockLevel: '5',
        barcodes: '',
      });
    }
    setErrorMessage('');
  }, [product, categories, isOpen]);

  if (!isOpen) return null;

  const isLoose = LOOSE_UNITS.includes(formData.unit);

  // Live price calculations
  const pRupees = parseFloat(formData.purchasePriceRupees) || 0;
  const sRupees = parseFloat(formData.sellingPriceRupees) || 0;
  const mRupees = parseFloat(formData.mrpRupees) || 0;

  const marginRupees = sRupees - pRupees;
  const marginPercent = sRupees > 0 ? ((marginRupees / sRupees) * 100).toFixed(1) : 0;
  const isSellingAboveMrp = sRupees > mRupees && mRupees > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.name.trim()) {
      setErrorMessage('Product name is required.');
      return;
    }

    if (!formData.category) {
      setErrorMessage('Please select a category.');
      return;
    }

    if (pRupees < 0 || sRupees < 0 || mRupees < 0) {
      setErrorMessage('Prices cannot be negative.');
      return;
    }

    if (isSellingAboveMrp) {
      setErrorMessage(`Selling price (₹${sRupees}) cannot exceed MRP (₹${mRupees}).`);
      return;
    }

    const stock = parseFloat(formData.currentStock);
    if (!isLoose && !Number.isInteger(stock)) {
      setErrorMessage(`Unit '${formData.unit}' represents whole discrete items and does not accept fractional stock.`);
      return;
    }

    // Split barcodes
    const barcodeArray = formData.barcodes
      ? formData.barcodes
          .split(/[,;\s]+/)
          .map((b) => b.trim())
          .filter(Boolean)
      : [];

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      category: formData.category,
      unit: formData.unit,
      purchasePricePaise: rupeesToPaise(pRupees),
      sellingPricePaise: rupeesToPaise(sRupees),
      mrpPaise: rupeesToPaise(mRupees),
      currentStock: stock || 0,
      minStockLevel: parseFloat(formData.minStockLevel) || 0,
      barcodes: barcodeArray,
    };

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/products/${product._id}`, payload);
      } else {
        await api.post('/products', payload);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-slate-200 flex flex-col max-h-[92vh] animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isEdit ? 'Edit Product Details' : 'Add New Kirana Product'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit ? 'Update product pricing and inventory specifications' : 'Create product SKU with precise paise pricing'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="py-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
              <input
                type="text"
                placeholder="e.g. Sona Masoori Rice, Fortune Sunflower Oil, Tata Salt"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit of Measurement *</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              >
                {VALID_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Pricing Section Banner */}
            <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block mb-2">
                Pricing Structure (Stored internally in integer paise)
              </span>

              <div className="grid grid-cols-3 gap-3">
                {/* Purchase Price */}
                <div>
                  <label className="block font-medium text-slate-600 mb-1">Purchase Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.purchasePriceRupees}
                    onChange={(e) => setFormData({ ...formData, purchasePriceRupees: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                {/* Selling Price */}
                <div>
                  <label className="block font-medium text-slate-600 mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.sellingPriceRupees}
                    onChange={(e) => setFormData({ ...formData, sellingPriceRupees: e.target.value })}
                    className={`w-full px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 ${
                      isSellingAboveMrp ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300 focus:ring-emerald-500'
                    }`}
                    required
                  />
                </div>

                {/* MRP */}
                <div>
                  <label className="block font-medium text-slate-600 mb-1">Maximum Retail (MRP ₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.mrpRupees}
                    onChange={(e) => setFormData({ ...formData, mrpRupees: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Real-time Margin & Validation Insight */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-[11px]">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">
                    Gross Margin:{' '}
                    <strong className={marginRupees >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                      ₹{marginRupees.toFixed(2)} ({marginPercent}%)
                    </strong>
                  </span>
                  {mRupees > sRupees && (
                    <span className="text-slate-500">
                      Customer Discount:{' '}
                      <strong className="text-teal-700">₹{(mRupees - sRupees).toFixed(2)}</strong>
                    </span>
                  )}
                </div>

                {isSellingAboveMrp && (
                  <span className="text-rose-600 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Selling price exceeds MRP!
                  </span>
                )}
              </div>
            </div>

            {/* Stock Levels */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Current Stock ({formData.unit})
              </label>
              <input
                type="number"
                step={isLoose ? '0.001' : '1'}
                min="0"
                placeholder={isLoose ? 'e.g. 25.500' : 'e.g. 50'}
                value={formData.currentStock}
                onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {isLoose ? 'Decimal quantities supported (e.g., 0.500 kg, 1.250 L)' : 'Whole numbers only for pieces/packets'}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Low-Stock Threshold ({formData.unit})
              </label>
              <input
                type="number"
                step={isLoose ? '0.001' : '1'}
                min="0"
                placeholder="5"
                value={formData.minStockLevel}
                onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Triggers low-stock alert when stock falls below</span>
            </div>

            {/* Barcode(s) */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-slate-500" />
                Barcode(s) (Optional - supports multiple comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. 8901058852331, 8901058852332"
                value={formData.barcodes}
                onChange={(e) => setFormData({ ...formData, barcodes: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Leave blank for loose grains/sugar sold without packaged barcode
              </span>
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                rows="2"
                placeholder="e.g. Polished premium sortex cleaned raw rice"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isSellingAboveMrp}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Update Product' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
