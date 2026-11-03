import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Receipt,
  Banknote,
  Smartphone,
  Users,
  Truck,
  AlertTriangle,
  Download,
  Printer,
  RefreshCw,
  Calendar,
  Layers,
  Package,
  CheckCircle2,
  BarChart3,
  PieChart as PieIcon,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import api from '../services/api';
import { formatINR, formatDateTime } from '../utils/formatters';

const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7days', label: 'Last 7 Days' },
  { key: 'last30days', label: 'Last 30 Days' },
  { key: 'thismonth', label: 'This Month' },
  { key: 'previousmonth', label: 'Prev Month' },
  { key: 'custom', label: 'Custom' },
];

const PIE_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6'];

export const ReportsPage = () => {
  const [selectedRange, setSelectedRange] = useState('thismonth');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'products' | 'inventory' | 'credit'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Data states
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [productsData, setProductsData] = useState({ bestSelling: [], leastSelling: [], categories: [] });
  const [inventoryData, setInventoryData] = useState(null);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        range: selectedRange,
        ...(selectedRange === 'custom' && customStart ? { startDate: customStart } : {}),
        ...(selectedRange === 'custom' && customEnd ? { endDate: customEnd } : {}),
      };

      const [summaryRes, timelineRes, productsRes, inventoryRes] = await Promise.all([
        api.get('/reports/dashboard', { params }),
        api.get('/reports/sales-timeline', { params }),
        api.get('/reports/products', { params }),
        api.get('/reports/inventory'),
      ]);

      setSummary(summaryRes.data.summary);
      setTimeline(timelineRes.data.timeline || []);
      setProductsData({
        bestSelling: productsRes.data.bestSelling || [],
        leastSelling: productsRes.data.leastSelling || [],
        categories: productsRes.data.categories || [],
      });
      setInventoryData(inventoryRes.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError(err.response?.data?.message || 'Failed to load business reports');
    } finally {
      setLoading(false);
    }
  }, [selectedRange, customStart, customEnd]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Export report to CSV via Blob download
  const handleExportCSV = async (type) => {
    try {
      setIsExporting(true);
      setExportMenuOpen(false);

      const params = {
        range: selectedRange,
        ...(selectedRange === 'custom' && customStart ? { startDate: customStart } : {}),
        ...(selectedRange === 'custom' && customEnd ? { endDate: customEnd } : {}),
      };

      const response = await api.get(`/reports/export/${type}`, {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report-${selectedRange}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export CSV: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsExporting(false);
    }
  };

  // Payment Breakdown for Pie Chart
  const paymentChartData = summary
    ? [
        { name: 'Cash', value: (summary.payments?.cashCollectionPaise || summary.cashCollectionsPaise || 0) / 100 },
        { name: 'UPI', value: (summary.payments?.upiCollectionPaise || summary.upiCollectionsPaise || 0) / 100 },
        { name: 'Udhaar Credit', value: (summary.payments?.udhaarCreditPaise || summary.udhaarCollectionsPaise || 0) / 100 },
      ].filter((p) => p.value > 0)
    : [];

  // Formatted timeline data for Recharts (convert paise to rupees)
  const timelineChartData = timeline.map((item) => ({
    date: item.date ? item.date.slice(5) : '-',
    fullDate: item.date,
    revenue: (item.revenuePaise || 0) / 100,
    grossProfit: (item.grossProfitPaise || 0) / 100,
    cogs: (item.cogsPaise || 0) / 100,
    bills: item.billCount || 0,
  }));

  // Top 5 Products data
  const topProductsChartData = (productsData.bestSelling || []).slice(0, 5).map((p) => ({
    name: p.name?.length > 14 ? p.name.slice(0, 14) + '...' : p.name,
    fullName: p.name,
    soldQty: p.netQuantity || 0,
    revenue: (p.totalRevenuePaise || 0) / 100,
    profit: (p.grossProfitPaise || 0) / 100,
  }));

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header with Date Filter Controls & Action Buttons */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:border-none print:shadow-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Admin Business Intelligence
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-medium text-slate-500">
              {summary?.period?.label || 'Selected Period'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600 print:hidden" />
            Store Analytics & Financial Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time ledger analytics &bull; Snapshot at {formatDateTime(new Date())}
          </p>
        </div>

        {/* Action Controls (Hidden during print) */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {/* Refresh button */}
          <button
            onClick={fetchReports}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Print button */}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print Report
          </button>

          {/* Export CSV Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </button>

            {exportMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs"
                onMouseLeave={() => setExportMenuOpen(false)}
              >
                <div className="px-3 py-1 font-bold text-[10px] uppercase tracking-wider text-slate-400">
                  Select CSV Report
                </div>
                <button
                  onClick={() => handleExportCSV('sales')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                >
                  <span>Sales Invoices Breakdown</span>
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => handleExportCSV('products')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                >
                  <span>Product Sales & Profitability</span>
                  <Package className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => handleExportCSV('inventory')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                >
                  <span>Inventory Stock Valuation</span>
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => handleExportCSV('customers')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                >
                  <span>Customer Udhaar Balances</span>
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => handleExportCSV('suppliers')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                >
                  <span>Supplier Outstanding Payables</span>
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Range Selector Bar (Hidden during print) */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400 ml-1 mr-1 hidden sm:block" />
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setSelectedRange(preset.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedRange === preset.key
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {selectedRange === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Core Financial & Retail KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Sales Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Net Sales Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {formatINR(summary?.netSalesRevenuePaise || summary?.totalSalesPaise || 0)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Gross: {formatINR(summary?.sales?.grossSalesPaise || 0)}</span>
            {(summary?.sales?.returnsRefundPaise || 0) > 0 && (
              <span className="text-rose-500 font-medium">
                Ret: -{formatINR(summary.sales.returnsRefundPaise)}
              </span>
            )}
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Gross Profit (Wholesale Margin)</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {summary?.profit?.grossProfitMarginPct || summary?.grossProfitMarginPct || 0}%
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600">
            {formatINR(summary?.profit?.grossProfitPaise || summary?.grossProfitPaise || 0)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            COGS: {formatINR(summary?.profit?.costOfGoodsSoldPaise || 0)}
          </p>
        </div>

        {/* Completed Bills & Average Bill Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Completed Bills</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {summary?.sales?.completedBillsCount || summary?.totalBills || 0}{' '}
            <span className="text-xs font-normal text-slate-400">bills</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Avg Bill: {formatINR(summary?.sales?.avgBillValuePaise || summary?.averageBillValuePaise || 0)}
          </p>
        </div>

        {/* Digital vs Cash Payments */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Cash vs Digital</span>
            <div className="flex gap-1">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <Smartphone className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <p className="text-base font-bold text-slate-900">
            <span className="text-emerald-700">
              {formatINR(summary?.payments?.cashCollectionPaise || summary?.cashCollectionsPaise || 0)}
            </span>{' '}
            <span className="text-xs text-slate-400">Cash</span>
          </p>
          <p className="text-xs font-medium text-indigo-700 mt-1">
            {formatINR(summary?.payments?.upiCollectionPaise || summary?.upiCollectionsPaise || 0)}{' '}
            <span className="text-[10px] text-slate-400">UPI</span>
          </p>
        </div>
      </div>

      {/* Second Row KPIs: Inventory Valuation, Customer Credit & Supplier Payables */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Inventory Valuation */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Inventory Valuation (Cost)</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {formatINR(summary?.inventory?.totalValuationPaise || summary?.inventoryValuationPaise || 0)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary?.inventory?.totalProductsCount || 0} Products ({summary?.inventory?.totalStockQuantity || 0} units)
          </p>
        </div>

        {/* Customer Udhaar Credit Debt */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Customer Udhaar (To Collect)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600">
            {formatINR(summary?.balances?.customerCreditOutstandingPaise || summary?.customerOutstandingPaise || 0)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary?.balances?.customersWithCreditCount || 0} Customers with pending balance
          </p>
        </div>

        {/* Supplier Outstanding Payable */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Supplier Payables (To Pay)</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-600">
            {formatINR(summary?.balances?.supplierPayableOutstandingPaise || summary?.supplierPayablePaise || 0)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary?.balances?.suppliersWithPayableCount || 0} Wholesalers/Distributors
          </p>
        </div>

        {/* Stock Alerts Count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Inventory Stock Alerts</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-rose-600">
              {summary?.inventory?.lowStockCount || summary?.lowStockCount || 0}
            </p>
            <span className="text-xs text-slate-400">low stock</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary?.inventory?.outOfStockCount || 0} Out of stock &bull;{' '}
            {summary?.inventory?.negativeStockCount || 0} Negative
          </p>
        </div>
      </div>

      {/* Interactive Recharts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Gross Profit Timeline (2 Cols) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Daily Sales & Gross Profit Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">Timeline breakdown of revenue and gross margin</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              ₹ in Rupees
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {timelineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    formatter={(val, name) => [
                      formatINR(Math.round(val * 100)),
                      name === 'revenue' ? 'Sales Revenue' : 'Gross Profit',
                    ]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    formatter={(val) => (val === 'revenue' ? 'Sales Revenue' : 'Gross Profit')}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                  />
                  <Area
                    type="monotone"
                    dataKey="grossProfit"
                    stroke="#6366F1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorProf)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No sales recorded in the selected period.
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods Breakdown (1 Col) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Payment Breakdown</h2>
              <p className="text-xs text-slate-400 mt-0.5">Collections by payment channel</p>
            </div>
            <PieIcon className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-48 w-full">
            {paymentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {paymentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatINR(Math.round(val * 100))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No payment transactions yet.
              </div>
            )}
          </div>

          <div className="mt-3 space-y-1.5 pt-3 border-t border-slate-100 text-xs">
            {paymentChartData.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">{formatINR(Math.round(item.value * 100))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Deep-Dive Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation Tab Pills */}
        <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-200 print:hidden">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'overview'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Product Profitability & Sales
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'inventory'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inventory Valuation & Low-Stock Alerts
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'categories'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Category Revenue Breakdown
          </button>
        </div>

        {/* Tab 1: Product Profitability */}
        {activeTab === 'overview' && (
          <div className="p-5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Top Performing Products (by Sold Quantity)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gross profit calculated from historical purchase cost snapshot at checkout
                </p>
              </div>
              <button
                onClick={() => handleExportCSV('products')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 print:hidden"
              >
                <Download className="w-3.5 h-3.5" />
                Export Products CSV
              </button>
            </div>

            {/* Top Products Bar Chart */}
            {topProductsChartData.length > 0 && (
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val, name) => [
                        name === 'revenue' || name === 'profit' ? formatINR(Math.round(val * 100)) : val,
                        name === 'revenue' ? 'Revenue' : name === 'profit' ? 'Gross Profit' : 'Sold Quantity',
                      ]}
                      labelFormatter={(lbl, pl) => pl?.[0]?.payload?.fullName || lbl}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue (₹)" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Gross Profit (₹)" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Best Selling Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-right">Sold Qty</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                    <th className="py-2.5 px-3 text-right">COGS</th>
                    <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    <th className="py-2.5 px-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(productsData.bestSelling || []).length > 0 ? (
                    productsData.bestSelling.map((p, idx) => {
                      const rev = p.totalRevenuePaise || 0;
                      const cogs = p.totalCogsPaise || 0;
                      const profit = p.grossProfitPaise || 0;
                      const margin = rev > 0 ? Math.round((profit / rev) * 1000) / 10 : 0;
                      return (
                        <tr key={p._id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2 px-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{p.name}</td>
                          <td className="py-2 px-3 text-right font-medium">
                            {p.netQuantity} {p.unit || ''}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">{formatINR(rev)}</td>
                          <td className="py-2 px-3 text-right text-slate-500">{formatINR(cogs)}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600">{formatINR(profit)}</td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-700">{margin}%</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No product sales recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Inventory Valuation & Stock Alerts */}
        {activeTab === 'inventory' && (
          <div className="p-5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Category-Wise Stock Valuation</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inventory calculated using purchase price cost standard
                </p>
              </div>
              <button
                onClick={() => handleExportCSV('inventory')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 print:hidden"
              >
                <Download className="w-3.5 h-3.5" />
                Export Valuation CSV
              </button>
            </div>

            {/* Valuation by Category Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Products Count</th>
                    <th className="py-2.5 px-3 text-right">Total Units</th>
                    <th className="py-2.5 px-3 text-right">Valuation (at Cost)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(inventoryData?.categoryValuation || []).map((cat, idx) => (
                    <tr key={cat._id || idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{cat.categoryName}</td>
                      <td className="py-2.5 px-3 text-right">{cat.productsCount} SKUs</td>
                      <td className="py-2.5 px-3 text-right">{cat.totalStockQuantity}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatINR(cat.totalValuationPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Low-Stock SKUs Alert List */}
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Low Stock & Out of Stock Alerts (Below Minimum Level)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-rose-50/60 text-slate-600 uppercase tracking-wider font-semibold border-y border-rose-200">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Current Stock</th>
                      <th className="py-2.5 px-3 text-right">Min Threshold</th>
                      <th className="py-2.5 px-3 text-right">Cost Price</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(inventoryData?.lowStockProducts || []).length > 0 ? (
                      inventoryData.lowStockProducts.map((p) => (
                        <tr key={p._id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{p.name}</td>
                          <td className="py-2.5 px-3 text-slate-500">{p.category?.name || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-black text-rose-600">
                            {p.currentStock} {p.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {p.minStockLevel || p.minStockThreshold || 5} {p.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                            {formatINR(p.purchasePricePaise)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                p.currentStock <= 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {p.currentStock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          All products are currently above their minimum safety thresholds.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Category Revenue Breakdown */}
        {activeTab === 'categories' && (
          <div className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Category Sales Revenue</h3>
            <p className="text-xs text-slate-400">Total revenue generated per department</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Department / Category</th>
                    <th className="py-2.5 px-3 text-right">Items Sold</th>
                    <th className="py-2.5 px-3 text-right">Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(productsData.categories || []).length > 0 ? (
                    productsData.categories.map((c, idx) => (
                      <tr key={c._id || idx} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{c.categoryName}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{c.soldCount}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatINR(c.revenuePaise)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        No category sales recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
