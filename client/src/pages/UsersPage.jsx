import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/formatters';
import {
  UserCheck,
  UserPlus,
  Shield,
  ShieldCheck,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Lock,
  User,
} from 'lucide-react';

export const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // New staff form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    role: 'STAFF',
  });
  const [isCreating, setIsCreating] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const { data } = await api.get('/auth/users');
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to load user list.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user) => {
    if (user._id === currentUser.id) {
      alert('You cannot deactivate your own active session.');
      return;
    }

    const actionText = user.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionText} '${user.name}' (@${user.username})?`)) {
      return;
    }

    try {
      const { data } = await api.patch(`/auth/users/${user._id}/status`);
      if (data.success) {
        setSuccessMessage(data.message);
        fetchUsers();
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to change user status.');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newStaff.name.trim() || !newStaff.username.trim() || !newStaff.password) {
      setErrorMessage('Please fill all required fields.');
      return;
    }

    if (newStaff.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsCreating(true);
    try {
      const { data } = await api.post('/auth/users', newStaff);
      if (data.success) {
        setSuccessMessage(`User '${data.user.name}' created successfully.`);
        setNewStaff({ name: '', username: '', password: '', phone: '', role: 'STAFF' });
        setShowAddForm(false);
        fetchUsers();
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to create user.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-emerald-600" />
            Store Accounts & Role Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage owner (ADMIN) and counter operator (STAFF) accounts.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <UserPlus className="w-4 h-4" />
          {showAddForm ? 'Cancel New Account' : 'Add Staff Account'}
        </button>
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
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Add Staff Form Accordion */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm animate-fadeIn">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-600" />
            Create Store Staff Account
          </h2>
          <form onSubmit={handleCreateStaff} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Staff Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username (Login ID) *</label>
              <input
                type="text"
                placeholder="e.g. ramesh"
                value={newStaff.username}
                onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password * (min 6 chars)</label>
              <input
                type="password"
                placeholder="••••••••"
                value={newStaff.password}
                onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Staff Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Configured Store Accounts ({users.length})</h2>
          <span className="text-[11px] text-slate-500">Shop Staff and Owner</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
            <p className="text-xs">Fetching user directory...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isCurrent = u._id === currentUser.id;
                  const isAdminRole = u.role === 'ADMIN';

                  return (
                    <tr key={u._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div>{u.name}</div>
                            {isCurrent && (
                              <span className="text-[10px] text-emerald-600 font-medium">(You)</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-mono">@{u.username}</td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isAdminRole
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {isAdminRole ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {u.phone ? u.phone : <span className="text-slate-300">-</span>}
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        {u.lastLogin ? formatDateTime(u.lastLogin) : 'Never'}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.isActive ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isCurrent ? (
                          <span className="text-[11px] text-slate-400 italic">Current Session</span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${
                              u.isActive
                                ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                            }`}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
