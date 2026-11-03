import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(username.trim(), password);
    setIsSubmitting(false);

    if (result.success) {
      // Direct Admin to Dashboard and Staff to POS
      if (result.user.role === 'ADMIN') {
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      } else {
        const from = location.state?.from?.pathname || '/pos';
        navigate(from, { replace: true });
      }
    } else {
      setErrorMessage(result.message);
    }
  };

  const fillQuickCredentials = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Brand Header */}
      <div className="w-full max-w-md text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 mb-3">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">SMART KIRANA</h1>
        <p className="text-sm text-slate-400 mt-1">Retail Management & POS Billing System</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Sign In to Counter</h2>
          <p className="text-xs text-slate-500 mt-1">
            Enter your shop credentials to access POS billing or store administration.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or staff"
                autoComplete="username"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition"
          >
            {isSubmitting ? (
              <span className="inline-block animate-pulse">Authenticating...</span>
            ) : (
              <>
                <span>Sign In to System</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Development Environment Account Helper */}
        {import.meta.env.DEV && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Quick Select Role (Development Mode)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setErrorMessage('');
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Select Owner (admin)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('staff');
                  setErrorMessage('');
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                Select Staff (staff)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Safety Notice Footer */}
      <div className="mt-6 text-center text-xs text-slate-500 max-w-sm">
        <p>🔒 Internal store network only. Transactions logged with user audit tracking.</p>
      </div>
    </div>
  );
};
