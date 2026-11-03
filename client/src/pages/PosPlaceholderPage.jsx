import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingCart,
  Barcode,
  Search,
  CreditCard,
  Banknote,
  Smartphone,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const PosPlaceholderPage = () => {
  const { user, isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      {/* POS Top Bar Banner */}
      <div className="bg-emerald-700 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-800/80 px-2 py-0.5 rounded text-emerald-200">
              POS Terminal
            </span>
            <span className="text-xs text-emerald-200">Operator: {user?.name} (@{user?.username})</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Express Billing Counter</h1>
          <p className="text-xs text-emerald-100 mt-1">
            Optimized for rapid checkout &bull; Cash, UPI, Split payments & Udhaar credit
          </p>
        </div>

        {isAdmin && (
          <NavLink
            to="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl border border-emerald-600 transition"
          >
            Switch to Admin Dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </NavLink>
        )}
      </div>

      {/* POS Interface Preview Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Barcode and Search Preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Scan Barcode or Search Product (Name / SKU)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                disabled
                placeholder="Product search will become interactive in Phase 2 & Phase 4..."
                className="w-full pl-11 pr-24 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl cursor-not-allowed text-slate-400"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-slate-400 bg-slate-200/60 px-2 py-1 rounded">
                  <Barcode className="w-3.5 h-3.5" /> Barcode Ready
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Supported Units:</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded">Kilograms (kg)</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded">Grams (g)</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded">Litres (l)</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded">Millilitres (ml)</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded">Pieces (pc)</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded">Packets (pkt)</span>
            </div>
          </div>

          {/* POS Cart Empty Preview */}
          <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Counter Register Ready</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Phase 1 foundation is operational! Product catalog loading is scheduled for Phase 2,
              followed by the POS live cart in Phase 4.
            </p>
          </div>
        </div>

        {/* Right Col: Payment Options & Rules Box */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              Kirana Billing Rules
            </h3>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50">
                <Banknote className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Cash & UPI Settlement</p>
                  <p className="text-[11px] text-slate-500">Quick tender shortcuts (₹100, ₹200, ₹500)</p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50">
                <BookOpen className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Customer Udhaar (Credit)</p>
                  <p className="text-[11px] text-slate-500">Zero-interest store credit with running ledger</p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Negative Stock Policy</p>
                  <p className="text-[11px] text-amber-700">
                    Non-blocking warning allows authorized counter staff to complete sale without pausing customer line.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
