import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  IndianRupee,
  Receipt,
  FileText,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Printer,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit2,
  ArrowDownLeft,
  ShieldAlert,
  X,
  CreditCard,
  QrCode,
  TrendingDown,
  UserCheck,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatINR, formatDateTime, rupeesToPaise, paiseToRupees } from '../utils/formatters';
import PaymentReceiptModal from '../components/PaymentReceiptModal';

export const CustomersPage = () => {
  const { user } = useAuth();

  // State
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [hasCreditOnly, setHasCreditOnly] = useState(false);

  // Overview KPIs
  const [overview, setOverview] = useState({
    totalOutstandingCreditPaise: 0,
    customersWithCreditCount: 0,
    todayCollectedPaise: 0,
    todayCollectionsCount: 0,
  });

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Customer Details / Ledger Modal
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('ledger'); // 'ledger' | 'sales'
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Collect Payment Modal
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashTenderedRupees, setCashTenderedRupees] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Receipt Modal
  const [lastPaymentTx, setLastPaymentTx] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Feedback Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchCustomers();
    fetchOverview();
  }, [page, hasCreditOnly]);

  const fetchOverview = async () => {
    try {
      const res = await api.get('/customers/overview');
      setOverview(res.data?.summary || {});
    } catch (err) {
      console.error('Failed to load Udhaar overview', err);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const params = {
        page,
        limit: 15,
        hasCreditOnly,
      };
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/customers', { params });
      setCustomers(res.data?.customers || []);
      setTotalPages(res.data?.totalPages || 1);
      setTotalCount(res.data?.total || 0);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', address: '', notes: '' });
    setShowAddModal(true);
  };

  const openEditModal = (cust) => {
    setEditingCustomer(cust);
    setFormData({
      name: cust.name,
      phone: cust.phone || '',
      address: cust.address || '',
      notes: cust.notes || '',
    });
    setShowAddModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('Customer name is required.');
      return;
    }

    setIsSubmittingForm(true);
    setErrorMessage('');
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer._id}`, formData);
        setSuccessMessage(`Customer '${formData.name}' updated successfully.`);
      } else {
        await api.post('/customers', formData);
        setSuccessMessage(`Customer '${formData.name}' added successfully.`);
      }

      setShowAddModal(false);
      fetchCustomers();
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to save customer.');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const openCustomerDetails = async (cust) => {
    setSelectedCustomer(cust);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/customers/${cust._id}`);
      setCustomerDetails(res.data);
    } catch (err) {
      console.error('Failed to load customer details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openPaymentModal = (cust) => {
    setPaymentCustomer(cust);
    const balanceRupees = paiseToRupees(cust.currentBalancePaise);
    setPaymentAmountRupees(balanceRupees > 0 ? balanceRupees.toString() : '');
    setCashTenderedRupees(balanceRupees > 0 ? balanceRupees.toString() : '');
    setPaymentMethod('CASH');
    setPaymentReference('');
    setPaymentNotes('');
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const amtPaise = rupeesToPaise(paymentAmountRupees || 0);

    if (amtPaise <= 0) {
      setErrorMessage('Payment amount must be greater than zero.');
      return;
    }

    if (amtPaise > paymentCustomer.currentBalancePaise) {
      setErrorMessage(`Payment cannot exceed current outstanding balance of ${formatINR(paymentCustomer.currentBalancePaise)}`);
      return;
    }

    setIsSubmittingPayment(true);
    setErrorMessage('');
    try {
      const res = await api.post(`/customers/${paymentCustomer._id}/payment`, {
        amountPaise: amtPaise,
        paymentMethod,
        reference: paymentReference,
        notes: paymentNotes,
        idempotencyKey: `CUST-REPAY-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      });

      setSuccessMessage(`Repayment of ${formatINR(amtPaise)} recorded. Receipt: ${res.data?.receiptNumber}`);
      setLastPaymentTx(res.data?.transaction);
      setIsReceiptOpen(true);
      setPaymentCustomer(null);

      fetchCustomers();
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to record customer repayment.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Customer & Udhaar Credit Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Maintain customer store credit accounts, collect repayments, and audit immutable credit ledgers.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm hover:shadow transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Outstanding Store Credit */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Outstanding Udhaar
            </span>
            <span className="text-2xl font-extrabold text-red-600 tracking-tight mt-0.5 block">
              {formatINR(overview.totalOutstandingCreditPaise)}
            </span>
            <span className="text-[11px] text-slate-400">
              Across {overview.customersWithCreditCount} customer(s) with pending balance
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        {/* Indebted Customers Count */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Pending Credit Accounts
            </span>
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5 block">
              {overview.customersWithCreditCount}
            </span>
            <span className="text-[11px] text-slate-400">
              Customers currently holding active store debt
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Collections Today */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Collected Today
            </span>
            <span className="text-2xl font-extrabold text-emerald-600 tracking-tight mt-0.5 block">
              {formatINR(overview.todayCollectedPaise)}
            </span>
            <span className="text-[11px] text-slate-400">
              {overview.todayCollectionsCount} payment receipt(s) settled today
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingDown className="w-6 h-6" />
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

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={hasCreditOnly}
              onChange={(e) => {
                setHasCreditOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Show Pending Credit Only</span>
          </label>

          <button
            type="button"
            onClick={() => {
              setPage(1);
              fetchCustomers();
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition"
          >
            Search
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Address / Notes</th>
                <th className="py-3 px-4 text-center">Purchases</th>
                <th className="py-3 px-4 text-right">Outstanding Udhaar</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading customers directory...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No customers found. Click <strong>Add Customer</strong> to register a new account.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => {
                  const hasDebt = cust.currentBalancePaise > 0;

                  return (
                    <tr key={cust._id} className="hover:bg-slate-50/80 transition">
                      
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {cust.name}
                        {cust.notes && (
                          <span className="block text-[11px] text-slate-400 font-normal truncate max-w-xs">
                            {cust.notes}
                          </span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {cust.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {cust.phone}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Address */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {cust.address ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {cust.address}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Purchases */}
                      <td className="py-3.5 px-4 text-center text-slate-700">
                        <span className="font-semibold">{cust.totalPurchasesCount || 0}</span> bills
                      </td>

                      {/* Outstanding Balance */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {hasDebt ? (
                          <span className="font-black text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md text-xs">
                            {formatINR(cust.currentBalancePaise)}
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-700 text-xs">
                            ₹0.00 (Clear)
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Collect Repayment */}
                          {hasDebt && (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(cust)}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" /> Collect
                            </button>
                          )}

                          {/* View Details & Ledger */}
                          <button
                            type="button"
                            onClick={() => openCustomerDetails(cust)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                            title="View Statement & History"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Edit Customer */}
                          <button
                            type="button"
                            onClick={() => openEditModal(cust)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} customers)
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

      {/* ADD / EDIT CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingCustomer ? 'Edit Customer Profile' : 'Register New Customer'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Customer Full Name <span className="text-red-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Chandra Sharma"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Number (Optional):
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="10-digit mobile number (e.g. 9876543210)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Used for identification and preventing duplicate accounts.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Address / Residence (Optional):
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. House 14, Near Water Tank"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Internal Notes:
                </label>
                <textarea
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Clears udhaar every Saturday"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs"
                >
                  {isSubmittingForm ? 'Saving...' : editingCustomer ? 'Update Profile' : 'Save Customer'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* COLLECT REPAYMENT MODAL */}
      {paymentCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-emerald-300 overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="bg-emerald-700 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Collect Udhaar Repayment</h3>
                <p className="text-xs text-emerald-100">
                  {paymentCustomer.name} • {paymentCustomer.phone || 'No phone'}
                </p>
              </div>
              <button onClick={() => setPaymentCustomer(null)} className="text-emerald-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4 text-xs">
              
              {/* Outstanding Banner */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-red-600">Current Outstanding Balance:</span>
                  <span className="text-xl font-black text-red-700 block">
                    {formatINR(paymentCustomer.currentBalancePaise)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentAmountRupees(paiseToRupees(paymentCustomer.currentBalancePaise).toString());
                    setCashTenderedRupees(paiseToRupees(paymentCustomer.currentBalancePaise).toString());
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded transition"
                >
                  Pay Full Balance
                </button>
              </div>

              {/* Amount to Collect */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Amount to Settle (₹) <span className="text-red-500">*</span>:
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={paymentAmountRupees}
                    onChange={(e) => {
                      setPaymentAmountRupees(e.target.value);
                      if (paymentMethod === 'CASH') setCashTenderedRupees(e.target.value);
                    }}
                    placeholder="Enter amount in ₹"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold text-base focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Mode:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-2 px-3 border rounded-lg font-semibold flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                        : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    <IndianRupee className="w-4 h-4" /> Cash
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`py-2 px-3 border rounded-lg font-semibold flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === 'UPI'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                        : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    <QrCode className="w-4 h-4" /> UPI / QR
                  </button>
                </div>
              </div>

              {/* Cash Tendered / Change for Cash */}
              {paymentMethod === 'CASH' && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex justify-between items-center text-slate-700 font-medium">
                    <span>Cash Tendered (₹):</span>
                    <input
                      type="number"
                      value={cashTenderedRupees}
                      onChange={(e) => setCashTenderedRupees(e.target.value)}
                      className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold"
                    />
                  </div>
                  {parseFloat(cashTenderedRupees) > parseFloat(paymentAmountRupees) && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Change to Return:</span>
                      <span>
                        {formatINR(rupeesToPaise((parseFloat(cashTenderedRupees) || 0) - (parseFloat(paymentAmountRupees) || 0)))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* UPI Ref */}
              {paymentMethod === 'UPI' && (
                <div>
                  <label className="block text-slate-600 mb-1">UPI Ref / Transaction ID (Optional):</label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. 123456789012"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Notes / Comments (Optional)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentCustomer(null)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  {isSubmittingPayment ? 'Recording...' : 'Collect & Print Receipt'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER DETAILS & CREDIT STATEMENT MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  {selectedCustomer.name}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Ph: {selectedCustomer.phone || 'None'} • Outstanding Balance: {' '}
                  <strong className={selectedCustomer.currentBalancePaise > 0 ? 'text-red-400' : 'text-emerald-400'}>
                    {formatINR(selectedCustomer.currentBalancePaise)}
                  </strong>
                </p>
              </div>

              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100 px-4 pt-2 gap-2 shrink-0 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveDetailTab('ledger')}
                className={`py-2 px-3 border-b-2 font-bold transition ${
                  activeDetailTab === 'ledger'
                    ? 'border-emerald-600 text-emerald-800 bg-white rounded-t'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Credit Ledger Statement
              </button>
              <button
                type="button"
                onClick={() => setActiveDetailTab('sales')}
                className={`py-2 px-3 border-b-2 font-bold transition ${
                  activeDetailTab === 'sales'
                    ? 'border-emerald-600 text-emerald-800 bg-white rounded-t'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Purchase Bills History
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-4 overflow-y-auto flex-1 text-xs">
              {loadingDetails ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  Loading customer credit statement...
                </div>
              ) : activeDetailTab === 'ledger' ? (
                <div>
                  <div className="mb-3 text-[11px] text-slate-500">
                    Showing immutable ledger entries recorded against this customer's credit line:
                  </div>

                  {customerDetails?.recentTransactions?.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      No ledger transactions found for this customer.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase">
                          <th className="py-2">Date & Time</th>
                          <th className="py-2">Type</th>
                          <th className="py-2">Reference</th>
                          <th className="py-2 text-right">Debit (+)</th>
                          <th className="py-2 text-right">Credit (-)</th>
                          <th className="py-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {customerDetails?.recentTransactions?.map((tx) => {
                          const isCreditSale = tx.type === 'CREDIT_SALE';
                          const isPayment = tx.type === 'PAYMENT';
                          const isVoid = tx.type === 'SALE_VOID';

                          return (
                            <tr key={tx._id} className="text-slate-800 hover:bg-slate-50">
                              <td className="py-2 text-slate-600 whitespace-nowrap">
                                {formatDateTime(tx.createdAt)}
                              </td>
                              <td className="py-2 whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                  isCreditSale ? 'bg-amber-100 text-amber-800' :
                                  isPayment ? 'bg-emerald-100 text-emerald-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {tx.type}
                                </span>
                              </td>
                              <td className="py-2 text-slate-600 whitespace-nowrap">
                                {tx.receiptNumber || tx.referenceId || '-'}
                              </td>
                              <td className="py-2 text-right font-medium text-amber-700">
                                {isCreditSale ? formatINR(tx.amountPaise) : '-'}
                              </td>
                              <td className="py-2 text-right font-medium text-emerald-700">
                                {isPayment || isVoid ? formatINR(tx.amountPaise) : '-'}
                              </td>
                              <td className="py-2 text-right font-bold text-slate-900">
                                {formatINR(tx.balanceAfterPaise)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div>
                  {customerDetails?.recentSales?.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      No bills recorded for this customer.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customerDetails?.recentSales?.map((sale) => (
                        <div key={sale._id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-900">{sale.invoiceNumber}</span>
                            <span className="text-slate-500 ml-2">{formatDateTime(sale.createdAt)}</span>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              {sale.items.length} item(s): {sale.items.map((i) => i.name).join(', ')}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-sm text-slate-900 block">{formatINR(sale.finalAmountPaise)}</span>
                            <span className="text-[10px] text-slate-500 font-semibold uppercase">{sale.paymentStatus}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Payment Receipt Voucher Modal */}
      <PaymentReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        transaction={lastPaymentTx}
        partyType="CUSTOMER"
      />

    </div>
  );
};

export default CustomersPage;
