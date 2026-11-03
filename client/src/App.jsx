import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosPlaceholderPage } from './pages/PosPlaceholderPage';
import { UsersPage } from './pages/UsersPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

// Smart Home Redirect based on logged-in role
const HomeRedirect = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return user?.role === 'ADMIN' ? <Navigate to="/dashboard" replace /> : <Navigate to="/pos" replace />;
};

// Login Route Guard (redirects already logged-in users away from /login)
const PublicLoginRoute = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) {
    return user?.role === 'ADMIN' ? <Navigate to="/dashboard" replace /> : <Navigate to="/pos" replace />;
  }
  return <LoginPage />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login */}
          <Route path="/login" element={<PublicLoginRoute />} />

          {/* Authenticated Application Shell */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomeRedirect />} />

            {/* Admin-Only Dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Admin-Only Staff Management */}
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />

            {/* POS Billing Counter (Admin & Staff) */}
            <Route
              path="/pos"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                  <PosPlaceholderPage />
                </ProtectedRoute>
              }
            />

            {/* Access Denied */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
