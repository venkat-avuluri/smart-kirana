import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Printer,
  RotateCcw,
  Ban,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  IndianRupee,
  FileText,
  Clock,
  User,
  ShieldAlert,
  ArrowDownLeft,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatINR, formatDateTime, paiseToRupees } from '../utils/formatters';
import ReceiptPrintModal from '../components/ReceiptPrintModal';

export const SalesHistoryPage = () => {
  const { user, isAdmin } = useAuth();

  // Sales List State
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters State
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Sale for Printing
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState(null);
  const [selectedReturnForPrint, setSelectedReturnForPrint] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Void Sale Dialog State (Admin only)
  const [voidingSale, setVoidingSale] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // Return Processing Dialog State
  const [returningSale, setReturningSale] = useState(null);
  const [returnItemsState, setReturnItemsState] = useState({});
  const [returnRefundMethod, setReturnRefundMethod] = useState('CASH');
  const [returnReason, setReturnReason] = useState('');
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  // Active Tab: 'sales' | 'returns'
  const [activeTab, setActiveTab] = useState('sales');
  const [returnsList, setReturnsList] = useState([]);
  const [loadingReturns, setLoadingReturns] = useState(false);

  // Feedback Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (activeTab === 'sales') {
      fetchSales();
    } else {
      fetchReturns();
    }
  }, [page, paymentMethod, status, activeTab]);

  const fetchSales = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const params = {
        page,
        limit: 15,
      };
      if (search.trim()) params.search = search.trim();
      if (paymentMethod) params.paymentMethod = paymentMethod;
      if (status) params.status = status;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/pos/sales', { params });
      setSales(res.data?.sales || []);
      setTotalPages(res.data?.totalPages || 1);
      setTotalCount(res.data?.total || 0);
    } catch (err) {
      console.error('Failed to load sales history:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load sales history.');
    } finally {
      setLoading(false);
    }
  };

  const fetchReturns = async () => {
    setLoadingReturns(true);
    try {
      const res = await api.get('/pos/returns');
      setReturnsList(res.data?.returns || []);
    } catch (err) {
      console.error('Failed to load returns:', err);
    } finally {
      setLoadingReturns(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchSales();
  };

  // Void Sale Action (Admin Only)
  const handleConfirmVoid = async () => {
    if (!voidReason.trim()) {
      setErrorMessage('A mandatory void/cancellation reason is required.');
      return;
    }

    setIsVoiding(true);
    try {
      const res = await api.post(`/pos/sales/${voidingSale._id}/void`, {
        voidReason: voidReason.trim(),
      });
      setSuccessMessage(`Invoice ${voidingSale.invoiceNumber} has been successfully VOIDED and inventory restored.`);
      setVoidingSale(null);
      setVoidReason('');
      fetchSales();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to void invoice.');
    } finally {
      setIsVoiding(false);
    }
  };

  // Open Return Dialog
  const openReturnModal = (sale) => {
    setReturningSale(sale);
    const initialItemMap = {};
    sale.items.forEach((item) => {
      const maxReturnable = item.quantity - (item.returnedQuantity || 0);
      initialItemMap[item._id] = {
        selected: false,
        quantity: maxReturnable > 0 ? (item.isLoose ? 1.0 : 1) : 0,
        maxReturnable,
      };
    });
    setReturnItemsState(initialItemMap);
    setReturnReason('');
    setReturnRefundMethod(sale.payments[0]?.method === 'CREDIT_UDHAAR' ? 'CREDIT_UDHAAR' : 'CASH');
  };

  // Process Sales Return Action
  const handleProcessReturn = async () => {
    if (!returnReason.trim()) {
      setErrorMessage('Please provide a reason for the return.');
      return;
    }

    const itemsToReturn = [];
    Object.entries(returnItemsState).forEach(([itemId, state]) => {
      if (state.selected && state.quantity > 0) {
        itemsToReturn.push({
          saleItemId: itemId,
          quantity: state.quantity,
        });
      }
    });

    if (itemsToReturn.length === 0) {
      setErrorMessage('Please check at least one item to return with a quantity > 0.');
      return;
    }

    setIsProcessingReturn(true);
    setErrorMessage('');
    try {
      const res = await api.post(`/pos/sales/${returningSale._id}/return`, {
        returnedItems: itemsToReturn,
        refundMethod: returnRefundMethod,
        reason: returnReason.trim(),
      });

      const saleReturn = res.data?.saleReturn;
      setSuccessMessage(`Return ${saleReturn.returnNumber} processed! Refund: ${formatINR(saleReturn.totalRefundPaise)}`);
      
      // Open receipt for the return voucher
      setSelectedReturnForPrint(saleReturn);
      setSelectedSaleForPrint(returningSale);
      setIsReceiptOpen(true);

      setReturningSale(null);
      fetchSales();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to process return.');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            POS Sales & Receipts History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Browse retail cash memos, reprint customer bills, process returns, or void invoices.
          </p>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-lg bg-slate-200 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-md transition ${
              activeTab === 'sales' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sales Invoices ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-2 rounded-md transition ${
              activeTab === 'returns' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Returns & Refunds
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs sm:text-sm flex items-center gap-2 font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs sm:text-sm flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="ml-auto font-bold text-red-500">×</button>
        </div>
      )}

      {/* SALES TAB CONTENT */}
      {activeTab === 'sales' && (
        <>
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 space-y-3">
            <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
              
              {/* Search Query Input */}
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by invoice number (SK-...), customer name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Payment Filter */}
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setPage(1);
                }}
                className="py-2 px-3 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Payment Modes</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / QR</option>
                <option value="CREDIT_UDHAAR">Udhaar Credit</option>
              </select>

              {/* Status Filter */}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="py-2 px-3 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Invoice Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="VOIDED">Voided / Cancelled</option>
                <option value="RETURNED_PARTIAL">Returned (Partial)</option>
                <option value="RETURNED_FULL">Returned (Full)</option>
              </select>

              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition"
              >
                Filter
              </button>
            </form>
          </div>

          {/* Sales Invoices Table */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Invoice No</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Net Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                        Loading sales history...
                      </td>
                    </tr>
                  ) : sales.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-400">
                        No sales invoices found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    sales.map((sale) => {
                      const isVoided = sale.status === 'VOIDED';
                      const primaryPayment = sale.payments[0]?.method || 'CASH';

                      return (
                        <tr key={sale._id} className={`hover:bg-slate-50/80 transition ${isVoided ? 'bg-red-50/30' : ''}`}>
                          
                          {/* Invoice Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {sale.invoiceNumber}
                          </td>

                          {/* Date & Time */}
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {formatDateTime(sale.createdAt)}
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4 text-slate-800">
                            <div className="font-medium">{sale.customerName}</div>
                            {sale.customerPhone && (
                              <div className="text-[11px] text-slate-400">{sale.customerPhone}</div>
                            )}
                          </td>

                          {/* Items Summary */}
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                            <span className="font-semibold text-slate-800">{sale.items.length} item(s):</span>{' '}
                            {sale.items.map((i) => `${i.name} (${i.quantity}${i.unit})`).join(', ')}
                          </td>

                          {/* Payment Method Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                              {sale.payments.length > 1
                                ? 'Split Payment'
                                : primaryPayment === 'CREDIT_UDHAAR'
                                ? 'Udhaar'
                                : primaryPayment}
                            </span>
                          </td>

                          {/* Final Amount */}
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatINR(sale.finalAmountPaise)}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isVoided ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                <Ban className="w-3 h-3" /> VOIDED
                              </span>
                            ) : sale.status.startsWith('RETURNED') ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                <RotateCcw className="w-3 h-3" /> {sale.status}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle className="w-3 h-3" /> Completed
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {/* Print Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSaleForPrint(sale);
                                  setSelectedReturnForPrint(null);
                                  setIsReceiptOpen(true);
                                }}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition"
                                title="Reprint Cash Memo"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Return Button */}
                              {!isVoided && sale.status !== 'RETURNED_FULL' && (
                                <button
                                  type="button"
                                  onClick={() => openReturnModal(sale)}
                                  className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition"
                                  title="Process Sales Return / Refund"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}

                              {/* Void Button (Admin Only) */}
                              {isAdmin && !isVoided && sale.status !== 'RETURNED_FULL' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVoidingSale(sale);
                                    setVoidReason('');
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-md transition"
                                  title="Void / Cancel Invoice (Admin Only)"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total bills)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* RETURNS TAB CONTENT */}
      {activeTab === 'returns' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Return Voucher No</th>
                  <th className="py-3 px-4">Original Invoice</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Returned Items</th>
                  <th className="py-3 px-4">Refund Mode</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Refund Total</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingReturns ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading returns history...
                    </td>
                  </tr>
                ) : returnsList.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      No sales returns recorded.
                    </td>
                  </tr>
                ) : (
                  returnsList.map((ret) => (
                    <tr key={ret._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-700">
                        {ret.returnNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                        {ret.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {formatDateTime(ret.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {ret.items.map((i) => `${i.name} (${i.returnedQuantity} ${i.unit})`).join(', ')}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {ret.refundMethod}
                      </td>
                      <td className="py-3.5 px-4 italic text-slate-600">
                        {ret.reason}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-amber-700">
                        {formatINR(ret.totalRefundPaise)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReturnForPrint(ret);
                            setSelectedSaleForPrint(null);
                            setIsReceiptOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 rounded transition"
                          title="Print Return Voucher"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VOID SALE MODAL (Admin Only) */}
      {voidingSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-red-300 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-red-600 text-white p-4 flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-red-200 shrink-0" />
              <div>
                <h3 className="font-bold text-base">Void Invoice {voidingSale.invoiceNumber}</h3>
                <p className="text-xs text-red-100">
                  This action cancels the bill and restores all sold stock into inventory.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <strong>{voidingSale.customerName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Bill Total:</span>
                  <strong className="text-red-700">{formatINR(voidingSale.finalAmountPaise)}</strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Mandatory Cancellation Reason <span className="text-red-500">*</span>:
                </label>
                <textarea
                  rows="3"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Customer cancelled order at counter / entered wrong items"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidingSale(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg"
              >
                Keep Invoice
              </button>
              <button
                type="button"
                disabled={isVoiding || !voidReason.trim()}
                onClick={handleConfirmVoid}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg shadow-xs"
              >
                {isVoiding ? 'Voiding & Restoring Stock...' : 'Confirm Void & Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SALES RETURN MODAL */}
      {returningSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-amber-300 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Return Items: {returningSale.invoiceNumber}</h3>
                <p className="text-xs text-amber-100">
                  Select returned items. Restores stock via SALE_RETURN ledger entry.
                </p>
              </div>
              <button onClick={() => setReturningSale(null)} className="text-amber-200 hover:text-white font-bold text-lg">
                ×
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
              
              {/* Items Selector */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-800 block">Select Items to Return:</label>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-2">
                  {returningSale.items.map((item) => {
                    const state = returnItemsState[item._id] || {};
                    const maxReturnable = item.quantity - (item.returnedQuantity || 0);

                    if (maxReturnable <= 0) {
                      return (
                        <div key={item._id} className="py-1 text-slate-400 italic">
                          {item.name} — Fully returned already
                        </div>
                      );
                    }

                    return (
                      <div key={item._id} className="pt-2 flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={state.selected || false}
                            onChange={(e) =>
                              setReturnItemsState((prev) => ({
                                ...prev,
                                [item._id]: { ...state, selected: e.target.checked },
                              }))
                            }
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-medium text-slate-900">{item.name}</span>
                          <span className="text-[10px] text-slate-500">
                            (Sold: {item.quantity} {item.unit}, Max: {maxReturnable} {item.unit})
                          </span>
                        </label>

                        {state.selected && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={item.isLoose ? '0.001' : '1'}
                              max={maxReturnable}
                              step={item.isLoose ? '0.001' : '1'}
                              value={state.quantity}
                              onChange={(e) =>
                                setReturnItemsState((prev) => ({
                                  ...prev,
                                  [item._id]: {
                                    ...state,
                                    quantity: parseFloat(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="w-18 px-2 py-1 border border-slate-300 rounded font-bold text-center"
                            />
                            <span className="text-[10px] text-slate-500">{item.unit}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Refund Method */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Refund Method:</label>
                <select
                  value={returnRefundMethod}
                  onChange={(e) => setReturnRefundMethod(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="CASH">Cash Refund</option>
                  <option value="UPI">UPI Refund</option>
                  <option value="CREDIT_UDHAAR">Udhaar Balance Credit</option>
                </select>
              </div>

              {/* Return Reason */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Return <span className="text-red-500">*</span>:
                </label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Defective pack / Wrong item purchased"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReturningSale(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingReturn || !returnReason.trim()}
                onClick={handleProcessReturn}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-xs"
              >
                {isProcessingReturn ? 'Processing Return...' : 'Confirm Return & Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptPrintModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={selectedSaleForPrint}
        saleReturn={selectedReturnForPrint}
      />

    </div>
  );
};

export default SalesHistoryPage;
