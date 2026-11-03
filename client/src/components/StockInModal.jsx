import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Truck,
  Plus,
  Loader2,
  X,
  AlertCircle,
  Package,
  FileText,
} from 'lucide-react';

export const StockInModal = ({ isOpen, onClose, products, preselectedProductId, onSuccess }) => {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [reason, setReason] = useState('Supplier Mandi Delivery');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (preselectedProductId) {
      setProductId(preselectedProductId);
    } else if (products.length > 0 && !productId) {
      setProductId(products[0]._id);
    }
    setQuantity('');
    setReferenceId('');
    setReason('Supplier Mandi Delivery');
    setErrorMessage('');
  }, [isOpen, preselectedProductId, products]);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p._id === productId);
  const isLoose = selectedProduct?.isLoose;
  const numQty = parseFloat(quantity) || 0;
  const previousStock = selectedProduct ? Number(selectedProduct.currentStock) || 0 : 0;
  const newStock = isLoose
    ? Math.round((previousStock + numQty) * 1000) / 1000
    : previousStock + Math.round(numQty);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!productId) {
      setErrorMessage('Please select a product.');
      return;
    }

    if (numQty <= 0) {
      setErrorMessage('Quantity must be greater than zero.');
      return;
    }

    if (!isLoose && !Number.isInteger(numQty)) {
      setErrorMessage(`Unit '${selectedProduct?.unit}' represents discrete pieces and requires a whole integer quantity.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post('/inventory/stock-in', {
        productId,
        quantity: numQty,
        referenceId: referenceId.trim(),
        reason: reason.trim(),
        idempotencyKey: `IN-${productId}-${Date.now()}`,
      });

      if (data.success) {
        onSuccess(data.message);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to record stock-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-slate-200 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Stock-In (Purchase Receipt)</h2>
              <p className="text-xs text-slate-500">Record incoming inventory goods from supplier or mandi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="py-4 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Product Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Product *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            >
              <option value="">-- Choose Product --</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} (Current: {p.currentStock} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Stock Quantity ({selectedProduct?.unit || 'units'}) *
              </label>
              <input
                type="number"
                step={isLoose ? '0.001' : '1'}
                min="0.001"
                placeholder={isLoose ? 'e.g. 25.500' : 'e.g. 50'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {isLoose ? 'Decimal precision supported (kg, L)' : 'Whole numbers only for pieces/packets'}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Purchase / Invoice Ref (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. PO-8831, Bill #104"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Stock-In Reason *</label>
            <input
              type="text"
              placeholder="e.g. Mandi direct purchase, Wholesale delivery"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Real-time Stock Preview Banner */}
          {selectedProduct && numQty > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-emerald-900">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-700">
                  Inventory Projection
                </span>
                <span className="font-semibold">
                  Previous: {previousStock} {selectedProduct.unit} &rarr;{' '}
                  <strong className="text-emerald-800 text-sm">{newStock} {selectedProduct.unit}</strong>
                </span>
              </div>
              <span className="px-2 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs font-mono">
                +{numQty} {selectedProduct.unit}
              </span>
            </div>
          )}

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
              disabled={isSubmitting || numQty <= 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm Stock-In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
