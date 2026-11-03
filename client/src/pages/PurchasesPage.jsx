import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  IndianRupee,
  Calendar,
  FileText,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Ban,
  Clock,
  Printer,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  DollarSign,
  Package,
  Layers,
  ArrowDownLeft,
  X,
  CreditCard,
  QrCode,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatINR, formatDateTime, rupeesToPaise, paiseToRupees } from '../utils/formatters';
import PaymentReceiptModal from '../components/PaymentReceiptModal';

const LOOSE_UNITS = ['kg', 'g', 'L', 'ml'];

export const PurchasesPage = () => {
  const { user, isAdmin } = useAuth();

  // Active Tab: 'purchases' | 'new-purchase' | 'suppliers'
  const [activeTab, setActiveTab] = useState('purchases');

  // Overview KPIs
  const [overview, setOverview] = useState({
    totalOutstandingPayablePaise: 0,
    suppliersWithPayableCount: 0,
    totalPurchasedPaise: 0,
    totalPaidPaise: 0,
    completedPurchasesCount: 0,
  });

  // Purchases History State
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseTotalPages, setPurchaseTotalPages] = useState(1);
  const [purchaseTotalCount, setPurchaseTotalCount] = useState(0);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');

  // Suppliers Directory State
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  // Products List for purchase row picker
  const [allProducts, setAllProducts] = useState([]);

  // New Purchase Form State
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    supplierInvoiceNumber: '',
    discountRupees: '',
    paidAmountRupees: '',
    paymentMethod: 'CASH',
    paymentReference: '',
    notes: '',
  });
  const [purchaseItems, setPurchaseItems] = useState([
    { productId: '', quantity: 1, purchasePriceRupees: '', unit: 'piece', isLoose: false },
  ]);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  // Modals State
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  // Cancel Purchase Dialog (Admin Only)
  const [cancellingPurchase, setCancellingPurchase] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Supplier Payment Modal
  const [paymentSupplier, setPaymentSupplier] = useState(null);
  const [supplierPaymentAmtRupees, setSupplierPaymentAmtRupees] = useState('');
  const [supplierPaymentMethod, setSupplierPaymentMethod] = useState('CASH');
  const [supplierPaymentRef, setSupplierPaymentRef] = useState('');
  const [supplierPaymentNotes, setSupplierPaymentNotes] = useState('');
  const [isSubmittingSupplierPayment, setIsSubmittingSupplierPayment] = useState(false);

  // Supplier Details & Ledger Modal
  const [selectedSupplierDetails, setSelectedSupplierDetails] = useState(null);
  const [supplierLedgerTab, setSupplierLedgerTab] = useState('ledger'); // 'ledger' | 'purchases'

  // Payment Voucher Print Modal
  const [lastSupplierTx, setLastSupplierTx] = useState(null);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);

  // Feedback Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchOverview();
    fetchSuppliersList();
    fetchProductsList();
  }, []);

  useEffect(() => {
    if (activeTab === 'purchases') {
      fetchPurchases();
    } else if (activeTab === 'suppliers') {
      fetchSuppliersList();
    }
  }, [activeTab, purchasePage, paymentStatusFilter]);

  const fetchOverview = async () => {
    try {
      const res = await api.get('/suppliers/overview');
      setOverview(res.data?.overview || {});
    } catch (err) {
      console.error('Failed to load overview', err);
    }
  };

  const fetchSuppliersList = async () => {
    setLoadingSuppliers(true);
    try {
      const res = await api.get('/suppliers', { params: { limit: 100 } });
      setSuppliers(res.data?.suppliers || []);
    } catch (err) {
      console.error('Failed to load suppliers', err);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchProductsList = async () => {
    try {
      const res = await api.get('/products', { params: { limit: 500 } });
      setAllProducts(res.data?.products || []);
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const fetchPurchases = async () => {
    setLoadingPurchases(true);
    setErrorMessage('');
    try {
      const params = {
        page: purchasePage,
        limit: 15,
      };
      if (purchaseSearch.trim()) params.search = purchaseSearch.trim();
      if (paymentStatusFilter) params.paymentStatus = paymentStatusFilter;

      const res = await api.get('/purchases', { params });
      setPurchases(res.data?.purchases || []);
      setPurchaseTotalPages(res.data?.totalPages || 1);
      setPurchaseTotalCount(res.data?.total || 0);
    } catch (err) {
      console.error('Failed to load purchases:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load purchases.');
    } finally {
      setLoadingPurchases(false);
    }
  };

  // Purchase Calculation Helpers
  const calculatedPurchaseTotals = () => {
    let subtotalPaise = 0;
    purchaseItems.forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const pricePaise = rupeesToPaise(item.purchasePriceRupees || 0);
      subtotalPaise += Math.round(qty * pricePaise);
    });

    const discountPaise = Math.max(0, rupeesToPaise(purchaseForm.discountRupees || 0));
    const totalPaise = Math.max(0, subtotalPaise - discountPaise);
    const paidPaise = Math.min(totalPaise, Math.max(0, rupeesToPaise(purchaseForm.paidAmountRupees || 0)));
    const balancePayablePaise = Math.max(0, totalPaise - paidPaise);

    return {
      subtotalPaise,
      discountPaise,
      totalPaise,
      paidPaise,
      balancePayablePaise,
    };
  };

  // Dynamic row management in purchase form
  const handleItemProductChange = (index, productId) => {
    const prod = allProducts.find((p) => p._id === productId);
    const next = [...purchaseItems];
    next[index] = {
      ...next[index],
      productId,
      unit: prod?.unit || 'piece',
      isLoose: LOOSE_UNITS.includes(prod?.unit || ''),
      purchasePriceRupees: prod ? paiseToRupees(prod.purchasePricePaise).toString() : '',
    };
    setPurchaseItems(next);
  };

  const handleItemFieldChange = (index, field, value) => {
    const next = [...purchaseItems];
    next[index] = { ...next[index], [field]: value };
    setPurchaseItems(next);
  };

  const addPurchaseRow = () => {
    setPurchaseItems([
      ...purchaseItems,
      { productId: '', quantity: 1, purchasePriceRupees: '', unit: 'piece', isLoose: false },
    ]);
  };

  const removePurchaseRow = (index) => {
    if (purchaseItems.length === 1) return;
    setPurchaseItems(purchaseItems.filter((_, idx) => idx !== index));
  };

  // Submit New Purchase Form
  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!purchaseForm.supplierId) {
      setErrorMessage('Please select a supplier.');
      return;
    }

    const validItems = purchaseItems.filter((i) => i.productId && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please add at least one valid product item with quantity > 0.');
      return;
    }

    const { totalPaise, paidPaise } = calculatedPurchaseTotals();

    setIsSubmittingPurchase(true);
    setErrorMessage('');
    try {
      const payload = {
        supplierId: purchaseForm.supplierId,
        supplierInvoiceNumber: purchaseForm.supplierInvoiceNumber.trim(),
        items: validItems.map((i) => ({
          productId: i.productId,
          quantity: parseFloat(i.quantity),
          purchasePricePaise: rupeesToPaise(i.purchasePriceRupees || 0),
        })),
        discountPaise: rupeesToPaise(purchaseForm.discountRupees || 0),
        paidAmountPaise: paidPaise,
        paymentMethod: purchaseForm.paymentMethod,
        paymentReference: purchaseForm.paymentReference.trim(),
        notes: purchaseForm.notes.trim(),
        idempotencyKey: `PUR-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      };

      const res = await api.post('/purchases', payload);
      setSuccessMessage(`Purchase ${res.data?.purchase?.purchaseNumber} recorded! Stock added to inventory.`);
      
      // Reset form
      setPurchaseForm({
        supplierId: '',
        supplierInvoiceNumber: '',
        discountRupees: '',
        paidAmountRupees: '',
        paymentMethod: 'CASH',
        paymentReference: '',
        notes: '',
      });
      setPurchaseItems([
        { productId: '', quantity: 1, purchasePriceRupees: '', unit: 'piece', isLoose: false },
      ]);

      setActiveTab('purchases');
      fetchPurchases();
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to submit purchase order.');
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // Cancel Purchase Action (Admin Only)
  const handleConfirmCancelPurchase = async () => {
    if (!cancellationReason.trim()) {
      setErrorMessage('A mandatory cancellation reason is required.');
      return;
    }

    setIsCancelling(true);
    try {
      await api.post(`/purchases/${cancellingPurchase._id}/cancel`, {
        cancellationReason: cancellationReason.trim(),
      });
      setSuccessMessage(`Purchase ${cancellingPurchase.purchaseNumber} cancelled and stock reversed.`);
      setCancellingPurchase(null);
      setCancellationReason('');
      fetchPurchases();
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to cancel purchase.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Add Supplier Form
  const handleSupplierFormSubmit = async (e) => {
    e.preventDefault();
    if (!supplierFormData.name.trim()) return;

    try {
      const res = await api.post('/suppliers', supplierFormData);
      setSuccessMessage(`Supplier '${res.data?.supplier?.name}' registered.`);
      setShowAddSupplierModal(false);
      setSupplierFormData({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' });
      fetchSuppliersList();
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to add supplier.');
    }
  };

  // Record Supplier Payment (Disbursement)
  const handleSupplierPaymentSubmit = async (e) => {
    e.preventDefault();
    const amtPaise = rupeesToPaise(supplierPaymentAmtRupees || 0);

    if (amtPaise <= 0) {
      setErrorMessage('Payment amount must be greater than zero.');
      return;
    }

    if (amtPaise > paymentSupplier.currentPayablePaise) {
      setErrorMessage(`Payment cannot exceed outstanding balance of ${formatINR(paymentSupplier.currentPayablePaise)}`);
      return;
    }

    setIsSubmittingSupplierPayment(true);
    try {
      const res = await api.post(`/suppliers/${paymentSupplier._id}/payment`, {
        amountPaise: amtPaise,
        paymentMethod: supplierPaymentMethod,
        reference: supplierPaymentRef,
        notes: supplierPaymentNotes,
        idempotencyKey: `SUPP-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      });

      setSuccessMessage(`Payment of ${formatINR(amtPaise)} settled. Voucher: ${res.data?.voucherNumber}`);
      setLastSupplierTx(res.data?.transaction);
      setIsVoucherOpen(true);
      setPaymentSupplier(null);

      fetchSuppliersList();
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to record supplier payment.');
    } finally {
      setIsSubmittingSupplierPayment(false);
    }
  };

  // Open Supplier Ledger Statement
  const openSupplierStatement = async (supp) => {
    try {
      const res = await api.get(`/suppliers/${supp._id}`);
      setSelectedSupplierDetails(res.data);
    } catch (err) {
      console.error('Failed to load supplier details', err);
    }
  };

  const totals = calculatedPurchaseTotals();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-600" />
            Purchases & Supplier Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Record wholesale inventory purchases, automatically restock shelves, and track supplier payables.
          </p>
        </div>

        {/* Action Tabs */}
        <div className="inline-flex rounded-lg bg-slate-200 p-1 text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={`px-3.5 py-1.5 rounded-md transition ${
              activeTab === 'purchases' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchases History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new-purchase')}
            className={`px-3.5 py-1.5 rounded-md transition flex items-center gap-1 ${
              activeTab === 'new-purchase' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> New Purchase Entry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`px-3.5 py-1.5 rounded-md transition ${
              activeTab === 'suppliers' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Suppliers ({suppliers.length})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Outstanding Payable
            </span>
            <span className="text-2xl font-extrabold text-red-600 tracking-tight mt-0.5 block">
              {formatINR(overview.totalOutstandingPayablePaise)}
            </span>
            <span className="text-[11px] text-slate-400">
              Owed to {overview.suppliersWithPayableCount} supplier(s)
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Lifetime Purchases
            </span>
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5 block">
              {formatINR(overview.totalPurchasedPaise)}
            </span>
            <span className="text-[11px] text-slate-400">
              {overview.completedPurchasesCount} completed purchase orders
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Registered Suppliers
            </span>
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5 block">
              {suppliers.length}
            </span>
            <span className="text-[11px] text-slate-400">
              Active wholesale distributors and vendors
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Truck className="w-6 h-6" />
          </div>
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

      {/* TAB 1: PURCHASES HISTORY */}
      {activeTab === 'purchases' && (
        <>
          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex-1 relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by purchase number (PUR-...) or supplier invoice..."
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="py-2 px-3 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-700 w-full md:w-auto"
            >
              <option value="">All Payment Statuses</option>
              <option value="PAID">Fully Paid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="UNPAID">Unpaid / On Credit</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setPurchasePage(1);
                fetchPurchases();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition"
            >
              Filter
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Purchase No</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Items Stocked-In</th>
                    <th className="py-3 px-4 text-right">Total Bill</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Balance Payable</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loadingPurchases ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                        Loading purchases...
                      </td>
                    </tr>
                  ) : purchases.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400">
                        No purchase orders found. Click <strong>New Purchase Entry</strong> to restock inventory.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => {
                      const isCancelled = p.status === 'CANCELLED';

                      return (
                        <tr key={p._id} className={`hover:bg-slate-50/80 transition ${isCancelled ? 'bg-red-50/30' : ''}`}>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {p.purchaseNumber}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {formatDateTime(p.createdAt)}
                          </td>

                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            {p.supplier?.name}
                            {p.supplierInvoiceNumber && (
                              <span className="block text-[10px] text-slate-400">Inv: {p.supplierInvoiceNumber}</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                            {p.items.map((i) => `${i.name} (${i.quantity}${i.unit})`).join(', ')}
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatINR(p.totalAmountPaise)}
                          </td>

                          <td className="py-3.5 px-4 text-right text-emerald-700 font-semibold whitespace-nowrap">
                            {formatINR(p.paidAmountPaise)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                            {p.balancePayablePaise > 0 ? (
                              <span className="text-red-600">{formatINR(p.balancePayablePaise)}</span>
                            ) : (
                              <span className="text-slate-400">₹0.00</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isCancelled ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                CANCELLED
                              </span>
                            ) : p.paymentStatus === 'PAID' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Paid
                              </span>
                            ) : p.paymentStatus === 'PARTIALLY_PAID' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Partial
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                Unpaid
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isAdmin && !isCancelled && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancellingPurchase(p);
                                  setCancellationReason('');
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                                title="Cancel Purchase & Reverse Stock"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {purchaseTotalPages > 1 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Showing page <strong>{purchasePage}</strong> of <strong>{purchaseTotalPages}</strong> ({purchaseTotalCount} orders)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={purchasePage <= 1}
                    onClick={() => setPurchasePage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={purchasePage >= purchaseTotalPages}
                    onClick={() => setPurchasePage((p) => Math.min(purchaseTotalPages, p + 1))}
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

      {/* TAB 2: NEW PURCHASE ENTRY WIZARD */}
      {activeTab === 'new-purchase' && (
        <form onSubmit={handlePurchaseSubmit} className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-6">
          
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">New Wholesale Purchase & Stock-In</h3>
              <p className="text-xs text-slate-500">
                All purchased items will immediately increase inventory stock via immutable PURCHASE ledger movements.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddSupplierModal(true)}
              className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Register New Supplier
            </button>
          </div>

          {/* Supplier & Invoice Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select Supplier / Vendor <span className="text-red-500">*</span>:
              </label>
              <select
                required
                value={purchaseForm.supplierId}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} (Payable: {formatINR(s.currentPayablePaise)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Supplier Bill / Invoice # (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-904"
                value={purchaseForm.supplierInvoiceNumber}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierInvoiceNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Purchased Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Purchased Product Items
              </label>
              <button
                type="button"
                onClick={addPurchaseRow}
                className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Another Item
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
              <div className="bg-slate-50 p-2.5 grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-600 uppercase">
                <div className="col-span-5">Product</div>
                <div className="col-span-3 text-right">Quantity</div>
                <div className="col-span-3 text-right">Unit Cost (₹)</div>
                <div className="col-span-1 text-center">Del</div>
              </div>

              {purchaseItems.map((item, idx) => {
                const linePaise = Math.round(
                  (parseFloat(item.quantity) || 0) * rupeesToPaise(item.purchasePriceRupees || 0)
                );

                return (
                  <div key={idx} className="p-2.5 grid grid-cols-12 gap-2 items-center bg-white text-xs">
                    
                    {/* Product Selector */}
                    <div className="col-span-5">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => handleItemProductChange(idx, e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-slate-800 text-xs"
                      >
                        <option value="">-- Choose Product --</option>
                        {allProducts.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.unit}) - Stock: {p.currentStock}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-3 flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min={item.isLoose ? '0.001' : '1'}
                        step={item.isLoose ? '0.001' : '1'}
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                        className="w-20 px-2 py-1 border border-slate-300 rounded-md text-right font-bold text-xs"
                      />
                      <span className="text-[10px] text-slate-400 font-medium w-6">{item.unit}</span>
                    </div>

                    {/* Purchase Price */}
                    <div className="col-span-3 flex items-center justify-end gap-1">
                      <span className="text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={item.purchasePriceRupees}
                        onChange={(e) => handleItemFieldChange(idx, 'purchasePriceRupees', e.target.value)}
                        placeholder="0.00"
                        className="w-24 px-2 py-1 border border-slate-300 rounded-md text-right font-bold text-xs"
                      />
                    </div>

                    {/* Delete button */}
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        disabled={purchaseItems.length === 1}
                        onClick={() => removePurchaseRow(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals & Payment Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method:</label>
                <select
                  value={purchaseForm.paymentMethod}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                  <option value="CREDIT_UNPAID">Credit (Unpaid)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Paid Amount Now (₹):
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={purchaseForm.paidAmountRupees}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, paidAmountRupees: e.target.value })}
                  placeholder={paiseToRupees(totals.totalPaise).toString()}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPurchaseForm({
                      ...purchaseForm,
                      paidAmountRupees: paiseToRupees(totals.totalPaise).toString(),
                    })
                  }
                  className="text-[10px] text-emerald-600 font-bold hover:underline mt-0.5"
                >
                  Pay Full Total
                </button>
              </div>
            </div>

            <div className="space-y-2 text-right">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-semibold text-slate-900">{formatINR(totals.subtotalPaise)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Net Bill:</span>
                <span className="text-base text-emerald-800 font-extrabold">{formatINR(totals.totalPaise)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Immediate Payment:</span>
                <span>- {formatINR(totals.paidPaise)}</span>
              </div>
              <div className="flex justify-between text-red-600 font-bold pt-1 border-t border-slate-200">
                <span>Balance Added to Supplier Payable:</span>
                <span>{formatINR(totals.balancePayablePaise)}</span>
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('purchases')}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingPurchase}
              className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm"
            >
              {isSubmittingPurchase ? 'Stocking-In Products...' : 'Save Purchase & Restock Inventory'}
            </button>
          </div>

        </form>
      )}

      {/* TAB 3: SUPPLIERS DIRECTORY */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-xs text-slate-600">
              Manage wholesale vendors and disburse balance settlements.
            </div>
            <button
              type="button"
              onClick={() => setShowAddSupplierModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Supplier
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4">Contact Person</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4 text-right">Outstanding Payable</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{s.name}</td>
                      <td className="py-3.5 px-4 text-slate-700">{s.contactPerson || '-'}</td>
                      <td className="py-3.5 px-4 text-slate-600">{s.phone || '-'}</td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">{s.address || '-'}</td>
                      <td className="py-3.5 px-4 text-right font-black whitespace-nowrap">
                        {s.currentPayablePaise > 0 ? (
                          <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            {formatINR(s.currentPayablePaise)}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">₹0.00 (Clear)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {s.currentPayablePaise > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentSupplier(s);
                                setSupplierPaymentAmtRupees(paiseToRupees(s.currentPayablePaise).toString());
                              }}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-xs font-semibold flex items-center gap-1"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" /> Disburse
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openSupplierStatement(s)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 rounded"
                            title="View Statement & History"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD SUPPLIER MODAL */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Register Wholesale Supplier</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSupplierFormSubmit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Supplier / Vendor Name <span className="text-red-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                  placeholder="e.g. Sri Balaji Agro Traders"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person:</label>
                <input
                  type="text"
                  value={supplierFormData.contactPerson}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, contactPerson: e.target.value })}
                  placeholder="e.g. Srinivas Rao"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number:</label>
                <input
                  type="text"
                  value={supplierFormData.phone}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                  placeholder="10-digit phone number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address / Yard Location:</label>
                <input
                  type="text"
                  value={supplierFormData.address}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                  placeholder="e.g. Wholesale Grain Yard, Shed 4"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL PURCHASE MODAL */}
      {cancellingPurchase && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-red-300 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-red-600 text-white p-4">
              <h3 className="font-bold text-base">Cancel Purchase {cancellingPurchase.purchaseNumber}</h3>
              <p className="text-xs text-red-100">
                Reverses inventory stock via immutable STOCK_CORRECTION and reverses supplier payable.
              </p>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700">
                <div>Supplier: <strong>{cancellingPurchase.supplier?.name}</strong></div>
                <div>Amount: <strong>{formatINR(cancellingPurchase.totalAmountPaise)}</strong></div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Mandatory Cancellation Reason <span className="text-red-500">*</span>:
                </label>
                <textarea
                  rows="3"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Rejected shipment due to damaged packaging"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancellingPurchase(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={isCancelling || !cancellationReason.trim()}
                onClick={handleConfirmCancelPurchase}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg shadow-xs"
              >
                {isCancelling ? 'Reversing Stock...' : 'Confirm Cancel & Reverse Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER PAYMENT MODAL */}
      {paymentSupplier && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-emerald-300 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-emerald-700 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Disburse Supplier Settlement</h3>
                <p className="text-xs text-emerald-100">{paymentSupplier.name}</p>
              </div>
              <button onClick={() => setPaymentSupplier(null)} className="text-emerald-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSupplierPaymentSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-red-600">Total Payable Balance:</span>
                  <span className="text-xl font-black text-red-700 block">
                    {formatINR(paymentSupplier.currentPayablePaise)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Amount to Disburse (₹) <span className="text-red-500">*</span>:
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={supplierPaymentAmtRupees}
                    onChange={(e) => setSupplierPaymentAmtRupees(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg font-bold text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Disbursement Mode:</label>
                <select
                  value={supplierPaymentMethod}
                  onChange={(e) => setSupplierPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                </select>
              </div>

              <div>
                <input
                  type="text"
                  value={supplierPaymentRef}
                  onChange={(e) => setSupplierPaymentRef(e.target.value)}
                  placeholder="Bank UTR / UPI Ref / Cheque # (Optional)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentSupplier(null)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSupplierPayment}
                  className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  {isSubmittingSupplierPayment ? 'Recording...' : 'Disburse & Print Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER DETAILS & LEDGER MODAL */}
      {selectedSupplierDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base">{selectedSupplierDetails.supplier?.name}</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Outstanding Payable: {' '}
                  <strong className="text-red-400">
                    {formatINR(selectedSupplierDetails.supplier?.currentPayablePaise)}
                  </strong>
                </p>
              </div>
              <button onClick={() => setSelectedSupplierDetails(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase">
                    <th className="py-2">Date</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Voucher / Ref</th>
                    <th className="py-2 text-right">Debit (+)</th>
                    <th className="py-2 text-right">Credit (-)</th>
                    <th className="py-2 text-right">Payable Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {selectedSupplierDetails.recentTransactions?.map((tx) => (
                    <tr key={tx._id} className="text-slate-800 hover:bg-slate-50">
                      <td className="py-2 text-slate-600 whitespace-nowrap">{formatDateTime(tx.createdAt)}</td>
                      <td className="py-2">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          tx.type === 'PURCHASE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2 text-slate-600 whitespace-nowrap">{tx.voucherNumber || tx.referenceId || '-'}</td>
                      <td className="py-2 text-right text-amber-700 font-medium">
                        {tx.type === 'PURCHASE' ? formatINR(tx.amountPaise) : '-'}
                      </td>
                      <td className="py-2 text-right text-emerald-700 font-medium">
                        {tx.type === 'PAYMENT' || tx.type === 'PURCHASE_CANCEL' ? formatINR(tx.amountPaise) : '-'}
                      </td>
                      <td className="py-2 text-right font-bold text-slate-900">{formatINR(tx.balanceAfterPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSupplierDetails(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment / Voucher Receipt Modal */}
      <PaymentReceiptModal
        isOpen={isVoucherOpen}
        onClose={() => setIsVoucherOpen(false)}
        transaction={lastSupplierTx}
        partyType="SUPPLIER"
      />

    </div>
  );
};

export default PurchasesPage;
