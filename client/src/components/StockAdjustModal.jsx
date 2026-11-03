import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Sliders,
  Loader2,
  X,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

export const StockAdjustModal = ({ isOpen, onClose, products, preselectedProductId, onSuccess }) => {
  const [productId, setProductId] = useState('');
  const [adjustmentMode, setAdjustmentMode] = useState('SET_TARGET'); // 'SET_TARGET' or 'ADD_DELTA'
  const [value, setValue] = useState('');
  const [type, setType] = useState('MANUAL_ADJUSTMENT');
  const [reason, setReason] = useState('Physical audit count adjustment');
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
    setValue('');
    setAdjustmentMode('SET_TARGET');
    setType('MANUAL_ADJUSTMENT');
    setReason('Physical audit count adjustment');
    setAllowNegativeOverride(false);
    setOverrideReason('');
    setErrorMessage('');
  }, [isOpen, preselectedProductId, products]);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p._id === productId);
  const isLoose = selectedProduct?.isLoose;
  const previousStock = selectedProduct ? Number(selectedProduct.currentStock) || 0 : 0;
  const numVal = parseFloat(value);

  let delta = 0;
  let newStock = previousStock;

  if (!isNaN(numVal)) {
    if (adjustmentMode === 'SET_TARGET') {
      newStock = isLoose ? Math.round(numVal * 1000) / 1000 : Math.round(numVal);
      delta = isLoose ? Math.round((newStock - previousStock) * 1000) / 1000 : newStock - previousStock;
    } else {
      delta = isLoose ? Math.round(numVal * 1000) / 1000 : Math.round(numVal);
      newStock = isLoose ? Math.round((previousStock + delta) * 1000) / 1000 : previousStock + delta;
    }
  }

  const causesNegativeStock = newStock < 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!productId) {
      setErrorMessage('Please select a product.');
      return;
    }

    if (isNaN(numVal) || delta === 0) {
      setErrorMessage('Please enter an adjustment value that results in a change.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('Reason for adjustment is required.');
      return;
    }

    if (causesNegativeStock && !allowNegativeOverride) {
      setErrorMessage('This adjustment causes negative stock. Authorization override is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post('/inventory/adjust', {
        productId,
        adjustmentMode,
        value: numVal,
        type,
        reason: reason.trim(),
        allowNegativeOverride,
        overrideReason: overrideReason.trim(),
        idempotencyKey: `ADJ-${productId}-${Date.now()}`,
      });

      if (data.success) {
        onSuccess(data.message);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to adjust stock.');
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
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Inventory Stock Adjustment</h2>
              <p className="text-xs text-slate-500">Reconcile physical stock counts with digital ledger</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="py-4 space-y-4 text-xs overflow-y-auto flex-1">
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
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          {/* Adjustment Mode Toggle */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Adjustment Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentMode('SET_TARGET')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                  adjustmentMode === 'SET_TARGET'
                    ? 'bg-blue-50 text-blue-800 border-blue-400 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Set Actual Floor Count
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentMode('ADD_DELTA')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                  adjustmentMode === 'ADD_DELTA'
                    ? 'bg-blue-50 text-blue-800 border-blue-400 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Add / Deduct Difference (&plusmn;)
              </button>
            </div>
          </div>

          {/* Value Input */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {adjustmentMode === 'SET_TARGET'
                ? `Actual Physical Stock Count (${selectedProduct?.unit || 'units'}) *`
                : `Quantity Difference to Apply (+ or - ${selectedProduct?.unit || 'units'}) *`}
            </label>
            <input
              type="number"
              step={isLoose ? '0.001' : '1'}
              placeholder={adjustmentMode === 'SET_TARGET' ? 'e.g. 50.000' : 'e.g. -2.500 or +10'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              required
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Adjustment Reason *</label>
            <input
              type="text"
              placeholder="e.g. Periodic stock count correction, weighing scale tare adjustment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          {/* Projection Card */}
          {selectedProduct && !isNaN(numVal) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">
                  Adjustment Projection
                </span>
                <span className="font-semibold text-xs">
                  Previous: {previousStock} {selectedProduct.unit} &rarr;{' '}
                  <strong className={causesNegativeStock ? 'text-rose-700 font-bold' : 'text-blue-800 font-bold'}>
                    {newStock} {selectedProduct.unit}
                  </strong>
                </span>
              </div>
              <span
                className={`px-2 py-1 font-bold rounded-lg text-xs font-mono ${
                  delta >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {delta > 0 ? `+${delta}` : delta} {selectedProduct.unit}
              </span>
            </div>
          )}

          {/* Negative Stock Protocol Alert */}
          {causesNegativeStock && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-2">
              <div className="flex items-start gap-2 text-amber-900 font-bold">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p>Negative Stock Warning</p>
                  <p className="text-[11px] font-normal text-amber-800 mt-0.5">
                    This adjustment will place '{selectedProduct?.name}' into negative stock ({newStock} {selectedProduct?.unit}).
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer bg-white p-2 rounded-lg border border-amber-200 select-none">
                <input
                  type="checkbox"
                  checked={allowNegativeOverride}
                  onChange={(e) => setAllowNegativeOverride(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span className="text-xs font-semibold text-slate-800">
                  I authorize this negative stock adjustment
                </span>
              </label>

              {allowNegativeOverride && (
                <input
                  type="text"
                  placeholder="Override authorization reason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
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
              disabled={isSubmitting || isNaN(numVal) || delta === 0 || (causesNegativeStock && !allowNegativeOverride)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Stock Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
