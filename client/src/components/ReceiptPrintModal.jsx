import React, { useState } from 'react';
import { Printer, X, FileText, CheckCircle2, RotateCcw } from 'lucide-react';
import { formatINR, formatDateTime } from '../utils/formatters';

export const ReceiptPrintModal = ({ isOpen, onClose, sale, saleReturn = null }) => {
  const [printFormat, setPrintFormat] = useState('thermal'); // 'thermal' (80mm) | 'standard' (A4)

  if (!isOpen || (!sale && !saleReturn)) return null;

  const invoiceNumber = sale?.invoiceNumber || saleReturn?.invoiceNumber || 'INV-0000';
  const createdAt = saleReturn?.createdAt || sale?.createdAt || new Date();
  const billedBy = sale?.billedBy?.name || saleReturn?.processedBy?.name || 'Staff';
  const customerName = sale?.customerName || 'Walk-in Customer';
  const customerPhone = sale?.customerPhone || '';
  const items = sale?.items || saleReturn?.items || [];
  const subtotalPaise = sale?.subtotalPaise || 0;
  const discountPaise = sale?.discountPaise || 0;
  const finalAmountPaise = saleReturn ? saleReturn.totalRefundPaise : (sale?.finalAmountPaise || 0);
  const payments = sale?.payments || [];
  const isVoided = sale?.status === 'VOIDED';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white print:static">
      {/* Container Box */}
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-w-none print:shadow-none print:border-none print:max-h-none print:rounded-none">
        
        {/* Modal Toolbar - Hidden during print */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-sm sm:text-base">
              {saleReturn ? 'Refund / Return Voucher' : 'Cash Memo Receipt'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Toggle */}
            <div className="inline-flex rounded-lg bg-slate-700 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPrintFormat('thermal')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  printFormat === 'thermal' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Thermal (80mm)
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('standard')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  printFormat === 'standard' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Standard (A4)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="overflow-y-auto p-4 sm:p-6 flex justify-center bg-slate-50 print:bg-white print:p-0">
          <div
            id="printable-receipt"
            className={`bg-white transition-all ${
              printFormat === 'thermal'
                ? 'w-[320px] p-4 text-xs font-mono shadow-sm border border-slate-200 print:border-none print:shadow-none print:w-[72mm] print:p-1'
                : 'w-full p-6 text-sm font-sans shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-2'
            }`}
          >
            {/* Watermark for Voided Bills */}
            {isVoided && (
              <div className="mb-3 py-1 bg-red-100 border border-red-300 text-red-700 text-center font-bold tracking-wider rounded">
                *** VOIDED INVOICE / CANCELLED ***
              </div>
            )}

            {saleReturn && (
              <div className="mb-3 py-1 bg-amber-100 border border-amber-300 text-amber-800 text-center font-bold tracking-wider rounded">
                *** SALES RETURN & REFUND VOUCHER ***
              </div>
            )}

            {/* Store Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-400">
              <h1 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                SMART KIRANA STORE
              </h1>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Daily Groceries, Spices & Household Provisions
              </p>
              <p className="text-[10px] text-slate-500">
                Main Road, Opp. Market Yard, Shop No. 4
              </p>
              <p className="text-[10px] text-slate-500">
                Ph: +91 98765 43210 • Retail Cash Memo
              </p>
              <p className="text-[9px] text-slate-400 italic">
                GST Unregistered Micro-Retailer
              </p>
            </div>

            {/* Bill Meta */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-slate-700 text-[11px]">
              <div className="flex justify-between">
                <span className="font-semibold">Invoice No:</span>
                <span className="font-bold text-slate-900">{invoiceNumber}</span>
              </div>
              {saleReturn && (
                <div className="flex justify-between">
                  <span className="font-semibold">Return No:</span>
                  <span className="font-bold text-slate-900">{saleReturn.returnNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{formatDateTime(createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{billedBy}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-medium text-slate-900">
                  {customerName} {customerPhone ? `(${customerPhone})` : ''}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-2 border-b border-dashed border-slate-400">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600 font-semibold text-[10px] uppercase">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-right">Qty</th>
                    <th className="py-1 text-right">Rate</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {items.map((it, idx) => (
                    <tr key={idx} className="text-slate-800">
                      <td className="py-1.5 pr-1">
                        <div className="font-medium line-clamp-1">{it.name}</div>
                        {it.returnedQuantity > 0 && (
                          <span className="text-[9px] text-red-600 block">
                            (Ret: {it.returnedQuantity} {it.unit})
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        {it.quantity || it.returnedQuantity} <span className="text-[9px] text-slate-500">{it.unit}</span>
                      </td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        {formatINR(it.unitPricePaise)}
                      </td>
                      <td className="py-1.5 text-right font-medium whitespace-nowrap">
                        {formatINR(it.totalPaise || it.refundAmountPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations & Net Total */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1.5 text-slate-700 text-[11px]">
              {!saleReturn && (
                <>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatINR(subtotalPaise)}</span>
                  </div>
                  {discountPaise > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount / Savings:</span>
                      <span>- {formatINR(discountPaise)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between items-center pt-1 border-t border-slate-300 text-sm font-bold text-slate-900">
                <span>{saleReturn ? 'REFUND DUE:' : 'NET PAYABLE:'}</span>
                <span className="text-base text-slate-950 font-black">
                  {formatINR(finalAmountPaise)}
                </span>
              </div>
            </div>

            {/* Payment Details */}
            {!saleReturn && payments.length > 0 && (
              <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-1 text-slate-600">
                <div className="font-semibold text-slate-800">Payment Summary:</div>
                {payments.map((p, pIdx) => (
                  <div key={pIdx} className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-700">
                        • {p.method === 'CREDIT_UDHAAR' ? 'Store Credit (Udhaar)' : p.method}
                      </span>
                      <span>{formatINR(p.amountPaise)}</span>
                    </div>
                    {p.method === 'CASH' && p.cashTenderedPaise > 0 && (
                      <div className="pl-3 text-[10px] text-slate-500 flex justify-between">
                        <span>Tendered: {formatINR(p.cashTenderedPaise)}</span>
                        <span className="font-bold text-slate-700">
                          Change: {formatINR(p.changeReturnedPaise)}
                        </span>
                      </div>
                    )}
                    {p.reference && (
                      <div className="pl-3 text-[10px] text-slate-500">
                        Ref / UPI ID: {p.reference}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Return details */}
            {saleReturn && (
              <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Refund Method:</span>
                  <span className="font-semibold text-slate-800">{saleReturn.refundMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Return Reason:</span>
                  <span className="italic">{saleReturn.reason}</span>
                </div>
              </div>
            )}

            {/* Footer Message */}
            <div className="pt-3 text-center text-[10px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">
                🙏 Thank You for Shopping with Us!
              </p>
              <p>For inquiries or returns, visit within 48 hours with this memo.</p>
              <p className="text-[9px] text-slate-400 pt-1">
                Powered by Smart Kirana POS • Fast & Accurate
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Hidden during print */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow transition"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
        </div>

      </div>

      {/* Embedded Print CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10px;
          }
        }
      `}</style>
    </div>
  );
};
export default ReceiptPrintModal;
