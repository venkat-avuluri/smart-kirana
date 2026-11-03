import React, { useState } from 'react';
import { Printer, X, CheckCircle, IndianRupee, Store, FileText } from 'lucide-react';
import { formatINR, formatDateTime } from '../utils/formatters';

export const PaymentReceiptModal = ({ isOpen, onClose, transaction, partyType = 'CUSTOMER' }) => {
  const [printFormat, setPrintFormat] = useState('thermal'); // 'thermal' (80mm) | 'standard' (A4)

  if (!isOpen || !transaction) return null;

  const isCustomer = partyType === 'CUSTOMER';
  const voucherTitle = isCustomer ? 'CUSTOMER REPAYMENT RECEIPT' : 'SUPPLIER DISBURSEMENT VOUCHER';
  const voucherNumber = transaction.receiptNumber || transaction.voucherNumber || transaction.referenceId || 'RCP-0000';
  const partyName = transaction.customer?.name || transaction.supplier?.name || 'Customer';
  const partyPhone = transaction.customer?.phone || transaction.supplier?.phone || '';
  const createdAt = transaction.createdAt || new Date();
  const recordedBy = transaction.recordedBy?.name || 'Staff';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-w-none print:shadow-none print:border-none print:max-h-none print:rounded-none">
        
        {/* Modal Toolbar - Hidden during print */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-sm sm:text-base">{voucherTitle}</h3>
          </div>

          <div className="flex items-center gap-2">
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
            id="printable-payment-voucher"
            className={`bg-white transition-all ${
              printFormat === 'thermal'
                ? 'w-[320px] p-4 text-xs font-mono shadow-sm border border-slate-200 print:border-none print:shadow-none print:w-[72mm] print:p-1'
                : 'w-full p-6 text-sm font-sans shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-2'
            }`}
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-400">
              <h1 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                SMART KIRANA STORE
              </h1>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Daily Groceries & Household Provisions
              </p>
              <p className="text-[10px] text-slate-500">
                Ph: +91 98765 43210 • Main Road, Opp. Market Yard
              </p>
              <div className="mt-2 py-1 bg-slate-100 rounded text-slate-800 font-bold text-[11px] uppercase tracking-wider">
                {voucherTitle}
              </div>
            </div>

            {/* Voucher Meta */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-slate-700 text-[11px]">
              <div className="flex justify-between">
                <span className="font-semibold">Voucher / Receipt No:</span>
                <span className="font-bold text-slate-900">{voucherNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{formatDateTime(createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Issued By:</span>
                <span>{recordedBy}</span>
              </div>
              <div className="flex justify-between">
                <span>{isCustomer ? 'Received From:' : 'Paid To:'}</span>
                <span className="font-bold text-slate-900">
                  {partyName} {partyPhone ? `(${partyPhone})` : ''}
                </span>
              </div>
            </div>

            {/* Amount Box */}
            <div className="py-3 border-b border-dashed border-slate-400 text-center bg-slate-50 rounded my-2">
              <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider block">
                {isCustomer ? 'Amount Received' : 'Amount Disbursed'}
              </span>
              <span className="text-2xl font-black text-emerald-700 tracking-tight block mt-0.5">
                {formatINR(transaction.amountPaise)}
              </span>
              <span className="text-[11px] text-slate-600 font-medium">
                Payment Mode: <strong>{transaction.paymentMethod}</strong>
              </span>
            </div>

            {/* Balance Accounting Ledger Statement */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1.5 text-slate-700 text-[11px]">
              <div className="font-semibold text-slate-800 text-[10px] uppercase tracking-wide">
                Account Balance Reconciliation:
              </div>
              <div className="flex justify-between">
                <span>Previous Outstanding {isCustomer ? 'Credit' : 'Payable'}:</span>
                <span className="font-medium">{formatINR(transaction.balanceBeforePaise)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Current Payment Settled:</span>
                <span>- {formatINR(transaction.amountPaise)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-300 font-bold text-slate-900">
                <span>New Outstanding Balance:</span>
                <span className="text-sm font-black text-slate-950">
                  {formatINR(transaction.balanceAfterPaise)}
                </span>
              </div>
            </div>

            {/* Notes & Verification */}
            {transaction.notes && (
              <div className="py-2 border-b border-dashed border-slate-400 text-[10px] text-slate-600">
                <span className="font-semibold">Notes / Reference: </span>
                <span>{transaction.notes}</span>
              </div>
            )}

            {/* Signature & Footer */}
            <div className="pt-4 text-center text-[10px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">
                Authorised Receipt • Computer Generated
              </p>
              <p>Thank you for your business and timely settlement!</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            Print Voucher
          </button>
        </div>

      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-payment-voucher, #printable-payment-voucher * {
            visibility: visible;
          }
          #printable-payment-voucher {
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
export default PaymentReceiptModal;
