import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  FileText,
  FileSpreadsheet,
  Upload,
  Download,
  Loader2,
  X,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';

export const OpeningStockModal = ({ isOpen, onClose, products, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'bulk'

  // Single Product Form
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Physical shop opening inventory count');
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);

  // Bulk CSV Form
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [dryRunData, setDryRunData] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (products.length > 0 && !productId) {
      setProductId(products[0]._id);
    }
    setQuantity('');
    setCsvText('');
    setFileName('');
    setDryRunData(null);
    setCsvErrors([]);
    setErrorMessage('');
    setSuccessMessage('');
  }, [isOpen, products]);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p._id === productId);
  const isLoose = selectedProduct?.isLoose;
  const numQty = parseFloat(quantity);

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!productId) {
      setErrorMessage('Please select a product.');
      return;
    }

    if (isNaN(numQty) || numQty < 0) {
      setErrorMessage('Opening stock must be a non-negative number.');
      return;
    }

    setIsSubmittingSingle(true);
    try {
      const { data } = await api.post('/inventory/opening-stock', {
        productId,
        quantity: numQty,
        reason: reason.trim(),
        idempotencyKey: `OPEN-${productId}-${Date.now()}`,
      });

      if (data.success) {
        onSuccess(data.message);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to record opening stock.');
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setDryRunData(null);
    setCsvErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleDryRun = async () => {
    if (!csvText.trim()) {
      alert('Please select or paste CSV data first.');
      return;
    }

    setIsValidating(true);
    setDryRunData(null);
    setCsvErrors([]);
    setErrorMessage('');

    try {
      const { data } = await api.post('/inventory/opening-stock/csv', {
        csvText,
        dryRun: true,
      });

      if (data.success) {
        setDryRunData(data);
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        setCsvErrors(err.response.data.errors);
      } else {
        setErrorMessage(err.response?.data?.message || 'CSV validation failed.');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleCommitBulk = async () => {
    if (!csvText.trim()) return;

    setIsCommitting(true);
    try {
      const { data } = await api.post('/inventory/opening-stock/csv', {
        csvText,
        dryRun: false,
      });

      if (data.success) {
        setSuccessMessage(data.message);
        setTimeout(() => {
          onSuccess(data.message);
          onClose();
        }, 1500);
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        setCsvErrors(err.response.data.errors);
      } else {
        setErrorMessage(err.response?.data?.message || 'Failed to commit opening stock.');
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const sampleCsvContent = `Name,OpeningStock,Reason\n"Sona Masoori Rice (Loose)",100.500,"Initial store rollout count"\n"Fortune Sunlite Sunflower Oil Pouch",25.000,"Physical stock count"`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-slate-200 animate-fadeIn max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Record Opening Stock</h2>
              <p className="text-xs text-slate-500">
                Enter initial physical quantities when starting digital Kirana operations
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-200 mt-3">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'single'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Single Product Entry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bulk')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'bulk'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Bulk CSV Import & Preview
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="py-4 space-y-4 text-xs overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: SINGLE PRODUCT */}
          {activeTab === 'single' && (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
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
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Actual Opening Quantity ({selectedProduct?.unit || 'units'}) *
                </label>
                <input
                  type="number"
                  step={isLoose ? '0.001' : '1'}
                  min="0"
                  placeholder={isLoose ? 'e.g. 50.000' : 'e.g. 100'}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Note *</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>One-Time Record:</strong> Once recorded, opening stock for a product cannot be re-entered. Subsequent variations must use Stock-In or Stock Adjustment.
                </span>
              </div>

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
                  disabled={isSubmittingSingle || isNaN(numQty)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                >
                  {isSubmittingSingle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Commit Opening Stock
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: BULK CSV */}
          {activeTab === 'bulk' && (
            <div className="space-y-4">
              {/* CSV Upload box */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Select Opening Stock CSV</label>
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-3.5 text-center cursor-pointer bg-slate-50/50 transition relative">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="font-semibold text-slate-700 text-xs">
                    {fileName ? fileName : 'Click or drop Opening Stock CSV file here'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Columns: Name, OpeningStock, Reason</p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Or Paste CSV Content</label>
                <textarea
                  rows="3"
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    setDryRunData(null);
                    setCsvErrors([]);
                  }}
                  placeholder={sampleCsvContent}
                  className="w-full font-mono text-[11px] p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Dry-run valid banner */}
              {dryRunData && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>{dryRunData.message}</span>
                  </div>
                  {dryRunData.preview && (
                    <div className="max-h-32 overflow-y-auto border border-emerald-200 rounded-lg bg-white">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-emerald-100/60 text-emerald-900 font-semibold">
                          <tr>
                            <th className="py-1 px-2.5">Product</th>
                            <th className="py-1 px-2.5">Unit</th>
                            <th className="py-1 px-2.5">Previous</th>
                            <th className="py-1 px-2.5">Opening Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-100">
                          {dryRunData.preview.map((p, idx) => (
                            <tr key={idx}>
                              <td className="py-1 px-2.5 font-medium">{p.productName}</td>
                              <td className="py-1 px-2.5 text-slate-500">{p.unit}</td>
                              <td className="py-1 px-2.5 text-slate-500">{p.currentStock}</td>
                              <td className="py-1 px-2.5 font-bold text-emerald-700">{p.newOpeningStock}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Errors banner */}
              {csvErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Validation Errors ({csvErrors.length})</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-rose-200 rounded-lg bg-white text-[11px]">
                    <table className="w-full text-left">
                      <thead className="bg-rose-100/60 text-rose-900">
                        <tr>
                          <th className="py-1 px-2">Row</th>
                          <th className="py-1 px-2">Field</th>
                          <th className="py-1 px-2">Issue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100">
                        {csvErrors.map((err, idx) => (
                          <tr key={idx}>
                            <td className="py-1 px-2 font-mono font-bold text-rose-700">{err.row}</td>
                            <td className="py-1 px-2 font-semibold text-slate-800">{err.field}</td>
                            <td className="py-1 px-2 text-rose-700">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isValidating || !csvText.trim()}
                    onClick={handleDryRun}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    {isValidating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Dry-Run & Preview
                  </button>
                  <button
                    type="button"
                    disabled={isCommitting || !csvText.trim() || csvErrors.length > 0}
                    onClick={handleCommitBulk}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                  >
                    {isCommitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Commit Opening Stock
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
