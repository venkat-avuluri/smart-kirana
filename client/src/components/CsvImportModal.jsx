import React, { useState } from 'react';
import api from '../services/api';
import {
  FileSpreadsheet,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  FileText,
} from 'lucide-react';

export const CsvImportModal = ({ isOpen, onClose, onSuccess }) => {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [errorsList, setErrorsList] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/products/csv/template', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smart_kirana_products_template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to download template. Please try again.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setValidationResult(null);
    setErrorsList([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleDryRunValidation = async () => {
    if (!csvText.trim()) {
      alert('Please select or paste CSV data first.');
      return;
    }

    setIsValidating(true);
    setValidationResult(null);
    setErrorsList([]);

    try {
      const { data } = await api.post('/products/csv/import', {
        csvText,
        dryRun: true,
      });

      if (data.success) {
        setValidationResult(data);
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrorsList(err.response.data.errors);
      } else {
        alert(err.response?.data?.message || 'CSV validation failed.');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;

    setIsImporting(true);
    try {
      const { data } = await api.post('/products/csv/import', {
        csvText,
        dryRun: false,
      });

      if (data.success) {
        setSuccessMessage(data.message);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrorsList(err.response.data.errors);
      } else {
        alert(err.response?.data?.message || 'Failed to import products.');
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-slate-200 flex flex-col max-h-[90vh] animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Import Products via CSV</h2>
              <p className="text-xs text-slate-500">Bulk upload store inventory with automated validation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Download Template Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-800">Need the official format?</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Download the standardized CSV template with pre-filled examples (kg, L, packet).
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300 rounded-lg shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              Download Template (.csv)
            </button>
          </div>

          {/* File Upload or Raw Paste */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Select CSV File</label>
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50/50 transition relative">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
              <p className="font-semibold text-slate-700">
                {fileName ? fileName : 'Click or drag & drop CSV file here'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Files formatted according to the template</p>
            </div>
          </div>

          {/* Or Paste Raw Text */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Or Paste CSV Text</label>
            <textarea
              rows="4"
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setValidationResult(null);
                setErrorsList([]);
              }}
              placeholder="Name,Category,Unit,PurchasePriceRupees,SellingPriceRupees,MRPRupees,CurrentStock,MinStockLevel,Barcodes,Description&#10;Sona Masoori Rice,Grains,kg,52,58,60,50,10,8901234567890,Raw rice"
              className="w-full font-mono text-[11px] p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Success Notification */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* Validation Result - Valid */}
          {validationResult && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{validationResult.message}</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                Ready to insert <strong>{validationResult.totalCount} products</strong>. No duplicate names, barcodes,
                or price discrepancies were found.
              </p>
            </div>
          )}

          {/* Validation Errors Table */}
          {errorsList.length > 0 && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Found {errorsList.length} Validation Error(s). Import was stopped safely.</span>
              </div>
              <div className="max-h-40 overflow-y-auto border border-rose-200 rounded-lg bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-rose-100/60 text-rose-900 font-semibold">
                    <tr>
                      <th className="py-1.5 px-3">Row</th>
                      <th className="py-1.5 px-3">Field</th>
                      <th className="py-1.5 px-3">Issue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100">
                    {errorsList.map((err, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/50">
                        <td className="py-1.5 px-3 font-mono font-bold text-rose-700">{err.row}</td>
                        <td className="py-1.5 px-3 font-semibold text-slate-800">{err.field}</td>
                        <td className="py-1.5 px-3 text-rose-700">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isValidating || !csvText.trim()}
              onClick={handleDryRunValidation}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
            >
              {isValidating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Validate & Preview
            </button>

            <button
              type="button"
              disabled={isImporting || !csvText.trim() || errorsList.length > 0}
              onClick={handleImport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
            >
              {isImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Import Products
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
