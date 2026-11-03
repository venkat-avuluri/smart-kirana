import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
} from 'lucide-react';

export const StockOutModal = ({ isOpen, onClose, products, preselectedProductId, onSuccess }) => {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState('DAMAGE');
  const [reason, setReason] = useState('');
  const [allowNegativeOverride, setAllowNegativeOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (preselectedProductId) {
      setProductId(preselectedProductId);
    } else if (products.length > 0 && !productId) {
      setProductId(products[0]._id);
    }
    setQuantity('');
    setType('DAMAGE');
    setReason('');
    setAllowNegativeOverride(false);
    setOverrideReason('');
    setErrorMessage('');
  }, [isOpen, preselectedProductId, products]);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p._id === productId);
  const isLoose = selectedProduct?.isLoose;
  const numQty = parseFloat(quantity) || 0;
  const previousStock = selectedProduct ? Number(selectedProduct.currentStock) || 0 : 0;
  const resultingStock = isLoose
    ? Math.round((previousStock - numQty) * 1000) / 1000
    : previousStock - Math.round(numQty);

  const causesNegativeStock = resultingStock < 0;

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

    if (!reason.trim()) {
      setErrorMessage('A specific reason for removal is required.');
      return;
    }

    if (causesNegativeStock && !allowNegativeOverride) {
      setErrorMessage('This transaction results in negative stock. You must check the authorization override box to proceed.');
      return;
    }

    if (causesNegativeStock && allowNegativeOverride && !overrideReason.trim()) {
      setErrorMessage('Please provide an override explanation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post('/inventory/stock-out', {
        productId,
        quantity: numQty,
        type,
        reason: reason.trim(),
        allowNegativeOverride,
        overrideReason: overrideReason.trim(),
        idempotencyKey: `OUT-${productId}-${Date.now()}`,
      });

      if (data.success) {
        onSuccess(data.message);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to record stock removal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-slate-200 animate-fadeIn max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Stock-Out (Damage & Wastage)</h2>
              <p className="text-xs text-slate-500">Record spoiled items, broken packaging, or physical shrinkage</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="py-4 space-y-4 text-xs overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Product Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Product *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
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

          {/* Removal Type & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Removal Category *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                required
              >
                <option value="DAMAGE">Damage (Torn bag / Breakage)</option>
                <option value="WASTAGE">Wastage / Spoilage</option>
                <option value="MANUAL_ADJUSTMENT">Manual Deduction</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Quantity ({selectedProduct?.unit || 'units'}) *
              </label>
              <input
                type="number"
                step={isLoose ? '0.001' : '1'}
                min="0.001"
                placeholder={isLoose ? 'e.g. 2.500' : 'e.g. 5'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Removal *</label>
            <input
              type="text"
              placeholder="e.g. Water leakage damaged bottom sacks, expired pouch"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              required
            />
          </div>

          {/* Real-time Resulting Stock Preview */}
          {selectedProduct && numQty > 0 && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                causesNegativeStock
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block">
                  Projected Stock After Deduction
                </span>
                <span className="font-semibold">
                  Previous: {previousStock} {selectedProduct.unit} &rarr;{' '}
                  <strong className={causesNegativeStock ? 'text-rose-700 font-black text-sm' : 'text-slate-900'}>
                    {resultingStock} {selectedProduct.unit}
                  </strong>
                </span>
              </div>
              <span className="px-2 py-1 bg-rose-600 text-white font-bold rounded-lg text-xs font-mono">
                -{numQty} {selectedProduct.unit}
              </span>
            </div>
          )}

          {/* Prominent Negative Stock Warning & Authorization Box */}
          {causesNegativeStock && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
              <div className="flex items-start gap-2 text-amber-900 font-bold">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p>Controlled Negative Stock Protocol Triggered</p>
                  <p className="text-[11px] font-normal text-amber-800 mt-0.5">
                    This operation will place the product stock into negative ({resultingStock} {selectedProduct?.unit}).
                    Per Kirana operational rules, transactions are allowed with authorization so counter operations are not halted.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-amber-200 select-none">
                <input
                  type="checkbox"
                  checked={allowNegativeOverride}
                  onChange={(e) => setAllowNegativeOverride(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <span className="text-xs font-semibold text-slate-800">
                  I authorize this negative stock deduction (Verified by Shop Owner / Admin)
                </span>
              </label>

              {allowNegativeOverride && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Override Authorization Reason *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Stock physically present; invoice pending entry"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
              )}
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
              disabled={isSubmitting || numQty <= 0 || (causesNegativeStock && !allowNegativeOverride)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm Stock Removal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
