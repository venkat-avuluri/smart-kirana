import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatINR, formatDateTime } from '../utils/formatters';
import api from '../services/api';
import {
  TrendingUp,
  Receipt,
  Banknote,
  Smartphone,
  AlertTriangle,
  Users,
  ShoppingCart,
  Database,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const DashboardPage = () => {
  const { user } = useAuth();
  const [healthStatus, setHealthStatus] = useState(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);

  // Load real server and DB health
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const { data } = await api.get('/health', { baseURL: '/api' });
        setHealthStatus(data);
      } catch (err) {
        setHealthStatus({ success: false, message: 'Server unreachable' });
      } finally {
        setIsLoadingHealth(false);
      }
    };

    fetchHealth();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome & Store Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Admin Console
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500">Unregistered GST Retailer</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.name || 'Store Owner'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time store snapshot &bull; Last login: {formatDateTime(user?.lastLogin || new Date())}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <NavLink
            to="/pos"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 transition"
          >
            <ShoppingCart className="w-4 h-4" />
            Launch POS Billing Counter
          </NavLink>
        </div>
      </div>

      {/* Backend & DB Health Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Database Connection</p>
              <p className="text-sm font-bold text-slate-900">
                {isLoadingHealth ? 'Checking...' : healthStatus?.database?.connected ? 'MongoDB Active' : 'Disconnected'}
              </p>
            </div>
          </div>
          {healthStatus?.database?.connected && (
            <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Ready
            </span>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Role & Security Mode</p>
              <p className="text-sm font-bold text-slate-900">RBAC Active ({user?.role})</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
            JWT Protected
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Active Phase</p>
              <p className="text-sm font-bold text-slate-900">Phase 1: Foundation</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
            Verified
          </span>
        </div>
      </div>

      {/* Real Retail KPI Metrics Grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
          Today's Retail Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Today's Sales */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Today's Total Sales</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">{formatINR(0)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Ready for Phase 4 POS billing</p>
          </div>

          {/* Bills Generated */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Bills Generated</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">0 bills</p>
            <p className="text-[11px] text-slate-400 mt-1">Sequential invoice numbering</p>
          </div>

          {/* Cash Sales */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Total Cash Sales</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">{formatINR(0)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Direct register cash intake</p>
          </div>

          {/* UPI Sales */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Total UPI Sales</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">{formatINR(0)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Digital QR payments</p>
          </div>

          {/* Customer Credit (Udhaar) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Customer Udhaar Balance</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-600">{formatINR(0)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Outstanding customer credit</p>
          </div>

          {/* Low Stock Warning */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Low-Stock SKUs</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">0 items</p>
            <p className="text-[11px] text-slate-400 mt-1">Below minimum threshold</p>
          </div>

          {/* Catalog SKUs */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Product Catalog</span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">0 SKUs</p>
            <p className="text-[11px] text-slate-400 mt-1">Phase 2 catalog loading</p>
          </div>

          {/* Categories */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Categories</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">0 Active</p>
            <p className="text-[11px] text-slate-400 mt-1">Grains, Oils, FMCG, Loose</p>
          </div>
        </div>
      </div>

      {/* Phase Roadmap Walkthrough Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase">
              Phase 1 Milestone Complete
            </span>
            <h3 className="text-xl font-bold mt-1">Core Architecture & Role Security Deployed</h3>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Foundation established: MongoDB connected, JWT + Bcrypt authentication, strict ADMIN vs STAFF roles,
              integer paise currency standard, and responsive layout.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <NavLink
              to="/users"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              Manage Staff Accounts
            </NavLink>
            <NavLink
              to="/pos"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/25 transition"
            >
              <span>Test POS View</span>
              <ArrowRight className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
};
