import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  ClipboardList,
  Users,
  Truck,
  UserCheck,
  BarChart3,
  LogOut,
  Menu,
  X,
  Store,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';

export const AppLayout = () => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out from Smart Kirana?')) {
      logout();
      navigate('/login');
    }
  };

  const adminNav = [
    { to: '/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
    { to: '/pos', label: 'POS Billing', icon: ShoppingCart },
    { to: '/products', label: 'Products & Catalog', icon: Package },
    { to: '/categories', label: 'Categories', icon: Layers },
    { to: '/inventory', label: 'Inventory Ledger', icon: ClipboardList, badge: 'Ph. 3' },
    { to: '/customers', label: 'Customers & Udhaar', icon: Users, badge: 'Ph. 5' },
    { to: '/purchases', label: 'Purchases & Suppliers', icon: Truck, badge: 'Ph. 5' },
    { to: '/users', label: 'Staff Accounts', icon: UserCheck },
    { to: '/reports', label: 'Reports & Analytics', icon: BarChart3, badge: 'Ph. 6' },
  ];

  const staffNav = [
    { to: '/pos', label: 'POS Billing', icon: ShoppingCart },
    { to: '/products', label: 'Product Catalog', icon: Package },
    { to: '/customers', label: 'Customers & Udhaar', icon: Users, badge: 'Ph. 5' },
    { to: '/sales-history', label: 'Billing History', icon: ClipboardList, badge: 'Ph. 4' },
  ];

  const navItems = isAdmin ? adminNav : staffNav;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left Brand + Mobile Toggle */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg focus:outline-none"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-inner">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  SMART KIRANA
                </span>
                <span className="hidden sm:block text-[10px] text-slate-400 -mt-1 font-medium tracking-wide">
                  Retail POS & Store Operations
                </span>
              </div>
            </div>
          </div>

          {/* Quick POS Shortcut Button */}
          <div className="hidden lg:flex items-center">
            <NavLink
              to="/pos"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              Open POS Counter
            </NavLink>
          </div>

          {/* Right User Status & Actions */}
          <div className="flex items-center space-x-3">
            {/* Role Badge */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium tracking-wide uppercase ${
                  isAdmin
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                    : 'bg-blue-950 text-blue-300 border border-blue-700/60'
                }`}
              >
                {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
                {isAdmin ? 'Admin' : 'Staff'}
              </span>

              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200">{user?.name}</span>
                <span className="text-[10px] text-slate-400">@{user?.username}</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="flex items-center gap-1 text-slate-300 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800 transition"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden md:inline text-xs font-medium">Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-22">
            <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isAdmin ? 'Store Administration' : 'Counter Operations'}
            </div>
            <nav className="mt-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">GST Status: Unregistered</p>
                <p className="text-[11px] text-slate-400">Bills generated as retail receipts (no tax charged).</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden bg-slate-900/60 backdrop-blur-xs flex">
            <div className="w-4/5 max-w-xs bg-white h-full p-5 flex flex-col shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <span className="font-bold text-slate-900 flex items-center gap-2">
                  <Store className="w-5 h-5 text-emerald-600" />
                  Navigation
                </span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-4 space-y-1.5 flex-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                          isActive
                            ? 'bg-emerald-600 text-white font-semibold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-rose-600 font-semibold bg-rose-50 rounded-lg text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Dynamic Route Content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* System Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Smart Kirana v1.0.0 &bull; Built for Physical Kirana Retail Operations</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            System Online (Local DB Connected)
          </span>
        </div>
      </footer>
    </div>
  );
};
