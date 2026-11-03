import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, ShoppingCart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UnauthorizedPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4 shadow-inner">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Restricted Store Area</h1>
      <p className="text-sm text-slate-500 mt-2 max-w-md">
        Your current role is <strong className="text-slate-800">{user?.role}</strong>. This module is restricted to
        Store Administration (ADMIN) privileges.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <NavLink
          to="/pos"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
        >
          <ShoppingCart className="w-4 h-4" />
          Go to POS Billing Counter
        </NavLink>
      </div>
    </div>
  );
};
