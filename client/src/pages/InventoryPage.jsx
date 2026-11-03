import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatINR, formatDateTime } from '../utils/formatters';
import { StockInModal } from '../components/StockInModal';
import { StockOutModal } from '../components/StockOutModal';
import { StockAdjustModal } from '../components/StockAdjustModal';
import { OpeningStockModal } from '../components/OpeningStockModal';
import {
  ClipboardList,
  Plus,
  Minus,
  Sliders,
  FileText,
  AlertTriangle,
  TrendingUp,
  Banknote,
  Boxes,
  ShieldAlert,
  Loader2,
  CheckCircle,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
  Package,
} from 'lucide-react';

export const InventoryPage = () => {
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'ledger', 'lowstock'
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [valuationData, setValuationData] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);

  // Ledger state
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Stock overview search & filter
  const [overviewSearch, setOverviewSearch] = useState('');
  const [overviewCategory, setOverviewCategory] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals state
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isOpeningStockOpen, setIsOpeningStockOpen] = useState(false);
  const [targetProductId, setTargetProductId] = useState('');

  // Fetch initial products and categories
  const loadInitialData = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/products?limit=100'),
        api.get('/categories'),
      ]);

      if (prodRes.data.success) {
        setProducts(prodRes.data.products);
      }
      if (catRes.data.success) {
        setCategories(catRes.data.categories);
      }
    } catch (err) {
      console.error('Failed to load catalog data:', err);
    }
  }, []);

  // Fetch Stock Valuation (Admin only)
  const loadValuation = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get('/inventory/valuation');
      if (data.success) {
        setValuationData(data);
      }
    } catch (err) {
      console.error('Failed to load valuation:', err);
    }
  }, [isAdmin]);

  // Fetch Low Stock Report
  const loadLowStock = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory/low-stock?limit=100');
      if (data.success) {
        setLowStockItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load low stock:', err);
    }
  }, []);

  // Fetch Ledger History
  const loadLedger = useCallback(async () => {
    try {
      const params = {
        page: ledgerPage,
        limit: 20,
        type: ledgerTypeFilter,
        search: ledgerSearch.trim(),
      };
      const { data } = await api.get('/inventory/ledger', { params });
      if (data.success) {
        setLedgerEntries(data.transactions);
        setLedgerTotalPages(data.totalPages);
        setLedgerTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to load ledger:', err);
    }
  }, [ledgerPage, ledgerTypeFilter, ledgerSearch]);

  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadInitialData(), loadValuation(), loadLowStock(), loadLedger()]);
    setIsLoading(false);
  }, [loadInitialData, loadValuation, loadLowStock, loadLedger]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Ledger filter debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLedger();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadLedger]);

  const openActionWithProduct = (actionType, prodId) => {
    setTargetProductId(prodId);
    if (actionType === 'in') setIsStockInOpen(true);
    if (actionType === 'out') setIsStockOutOpen(true);
    if (actionType === 'adjust') setIsAdjustOpen(true);
  };

  const handleActionSuccess = (msg) => {
    setSuccessMessage(msg);
    refreshAllData();
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Filtered Overview Products
  const filteredOverviewProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(overviewSearch.toLowerCase()) ||
      p.barcodes?.some((bc) => bc.includes(overviewSearch));
    const matchesCat = !overviewCategory || p.category?._id === overviewCategory || p.category === overviewCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
            Inventory Control & Stock Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable transaction ledger, purchase receipts, stock removals, and purchase-cost valuation.
          </p>
        </div>

        {/* Quick Action Toolbar (Admin only) */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setTargetProductId('');
                setIsStockInOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition"
            >
              <Plus className="w-4 h-4" />
              Stock-In
            </button>
            <button
              onClick={() => {
                setTargetProductId('');
                setIsStockOutOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition"
            >
              <Minus className="w-4 h-4" />
              Stock-Out
            </button>
            <button
              onClick={() => {
                setTargetProductId('');
                setIsAdjustOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition"
            >
              <Sliders className="w-4 h-4" />
              Adjust Stock
            </button>
            <button
              onClick={() => setIsOpeningStockOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-2xs transition"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              Opening Stock
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Valuation Metrics Banner (Admin only) */}
      {isAdmin && valuationData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Inventory Valuation</span>
              <Banknote className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{formatINR(valuationData.valuationPaise)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Calculated strictly at purchase cost</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Retail Selling Value</span>
              <TrendingUp className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{formatINR(valuationData.retailRevenuePaise)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Potential gross revenue at full retail</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Est. Margin Spread</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-700">
              {formatINR(valuationData.estimatedGrossProfitPaise)}
            </p>
            <p className="text-[10px] text-emerald-600 mt-1 font-semibold">
              {valuationData.potentialMarginPercent}% average margin spread
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Stock Health</span>
              <Boxes className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-2xl font-black text-slate-900">{lowStockItems.length}</p>
              <span className="text-xs text-rose-600 font-semibold">Low-stock SKUs</span>
            </div>
            {valuationData.negativeStockItemCount > 0 && (
              <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                {valuationData.negativeStockItemCount} product(s) in negative override
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Stock Levels Overview ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'ledger'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Immutable Movement Ledger ({ledgerTotal})
        </button>

        <button
          onClick={() => setActiveTab('lowstock')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'lowstock'
              ? 'border-rose-600 text-rose-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          Low Stock Alerts ({lowStockItems.length})
        </button>
      </div>

      {/* TAB 1: STOCK OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search stock by product name or barcode..."
                value={overviewSearch}
                onChange={(e) => setOverviewSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="w-full sm:w-56">
              <select
                value={overviewCategory}
                onChange={(e) => setOverviewCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Current Stock</th>
                    <th className="py-3 px-4">Threshold</th>
                    {isAdmin && <th className="py-3 px-4">Cost Value</th>}
                    {isAdmin && <th className="py-3 px-4 text-right">Quick Stock Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOverviewProducts.map((p) => {
                    const stock = Number(p.currentStock) || 0;
                    const isLow = stock <= p.minStockLevel;
                    const isNeg = stock < 0;

                    return (
                      <tr key={p._id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-400">
                            Unit: {p.unit} {p.isLoose && '(Loose Decimal)'}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          {p.category?.name || 'Uncategorized'}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-black font-mono text-sm ${
                                isNeg
                                  ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200'
                                  : isLow
                                  ? 'text-amber-700'
                                  : 'text-slate-900'
                              }`}
                            >
                              {p.isLoose ? stock.toFixed(3) : stock} {p.unit}
                            </span>
                            {isNeg && (
                              <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-bold">
                                Negative Stock
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-500 font-mono">
                          Min: {p.minStockLevel} {p.unit}
                        </td>

                        {isAdmin && (
                          <td className="py-3 px-4 font-medium text-slate-700">
                            {stock > 0 ? formatINR(stock * p.purchasePricePaise) : '₹0.00'}
                          </td>
                        )}

                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openActionWithProduct('in', p._id)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-semibold border border-emerald-200 transition"
                              >
                                + Stock-In
                              </button>
                              <button
                                onClick={() => openActionWithProduct('out', p._id)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg text-[11px] font-semibold border border-rose-200 transition"
                              >
                                - Removal
                              </button>
                              <button
                                onClick={() => openActionWithProduct('adjust', p._id)}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-[11px] font-semibold border border-blue-200 transition"
                              >
                                Adjust
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IMMUTABLE LEDGER HISTORY */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Ledger Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ledger by reason or reference..."
                value={ledgerSearch}
                onChange={(e) => {
                  setLedgerSearch(e.target.value);
                  setLedgerPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="w-full sm:w-64">
              <select
                value={ledgerTypeFilter}
                onChange={(e) => {
                  setLedgerTypeFilter(e.target.value);
                  setLedgerPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Movement Types</option>
                <option value="OPENING_STOCK">OPENING_STOCK</option>
                <option value="PURCHASE">PURCHASE (Stock-In)</option>
                <option value="SALE">SALE</option>
                <option value="SALE_RETURN">SALE_RETURN</option>
                <option value="DAMAGE">DAMAGE</option>
                <option value="WASTAGE">WASTAGE</option>
                <option value="MANUAL_ADJUSTMENT">MANUAL_ADJUSTMENT</option>
                <option value="STOCK_CORRECTION">STOCK_CORRECTION</option>
              </select>
            </div>
          </div>

          {/* Ledger Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Quantity Change</th>
                    <th className="py-3 px-4">Stock Shift</th>
                    <th className="py-3 px-4">Reason & Reference</th>
                    <th className="py-3 px-4">Authorized By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400">
                        No ledger movements recorded matching the filter.
                      </td>
                    </tr>
                  ) : (
                    ledgerEntries.map((tx) => {
                      const isPositive = tx.quantityDelta >= 0;

                      return (
                        <tr key={tx._id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">
                            {formatDateTime(tx.createdAt)}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900">{tx.product?.name || 'Deleted Product'}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                tx.type === 'PURCHASE' || tx.type === 'OPENING_STOCK'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : tx.type === 'DAMAGE' || tx.type === 'WASTAGE'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono font-bold">
                            <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
                              {isPositive ? `+${tx.quantityDelta}` : tx.quantityDelta} {tx.unit}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {tx.previousStock} &rarr;{' '}
                            <strong className={tx.newStock < 0 ? 'text-rose-700 font-bold' : 'text-slate-900'}>
                              {tx.newStock} {tx.unit}
                            </strong>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">{tx.reason}</div>
                            {tx.referenceId && (
                              <div className="text-[10px] text-slate-400 font-mono">Ref: {tx.referenceId}</div>
                            )}
                            {tx.isNegativeStockOverride && (
                              <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-300">
                                <ShieldAlert className="w-3 h-3 text-amber-600" />
                                Override: {tx.overrideReason}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-600">
                            <div>{tx.user?.name || 'System'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">@{tx.user?.username}</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <div>
                Page <strong>{ledgerPage}</strong> of <strong>{ledgerTotalPages}</strong> ({ledgerTotal} entries)
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  disabled={ledgerPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-semibold text-slate-800">{ledgerPage}</span>
                <button
                  onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))}
                  disabled={ledgerPage >= ledgerTotalPages}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LOW STOCK SHORTAGE CENTER */}
      {activeTab === 'lowstock' && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-rose-900 text-sm">Active Stock Shortage Alerts</h3>
              <p className="text-xs text-rose-800 mt-0.5">
                These items have fallen at or below their configured minimum safety stock threshold.
                Reorder promptly to prevent retail out-of-stock situations.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Current Stock</th>
                  <th className="py-3 px-4">Minimum Threshold</th>
                  <th className="py-3 px-4">Shortage Amount</th>
                  <th className="py-3 px-4">Urgency Status</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Quick Restock</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-emerald-700 font-semibold">
                      🎉 All products are safely stocked above minimum levels!
                    </td>
                  </tr>
                ) : (
                  lowStockItems.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                      <td className="py-3 px-4 text-slate-600">{item.category?.name || 'General'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-700">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {item.minStockLevel} {item.unit}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-700">
                        {item.shortage} {item.unit} needed
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.currentStock <= 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.currentStock <= 0 ? 'Out of Stock' : 'Low Stock Warning'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openActionWithProduct('in', item._id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Restock
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <StockInModal
        isOpen={isStockInOpen}
        onClose={() => setIsStockInOpen(false)}
        products={products}
        preselectedProductId={targetProductId}
        onSuccess={handleActionSuccess}
      />

      <StockOutModal
        isOpen={isStockOutOpen}
        onClose={() => setIsStockOutOpen(false)}
        products={products}
        preselectedProductId={targetProductId}
        onSuccess={handleActionSuccess}
      />

      <StockAdjustModal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        products={products}
        preselectedProductId={targetProductId}
        onSuccess={handleActionSuccess}
      />

      <OpeningStockModal
        isOpen={isOpeningStockOpen}
        onClose={() => setIsOpeningStockOpen(false)}
        products={products}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
};
