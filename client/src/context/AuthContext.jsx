import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_kirana_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('smart_kirana_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  // Validate session on app initialization
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem('smart_kirana_token');
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('smart_kirana_user', JSON.stringify(data.user));
        }
      } catch (err) {
        console.warn('Session verification failed, clearing auth:', err.message);
        localStorage.removeItem('smart_kirana_token');
        localStorage.removeItem('smart_kirana_user');
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (username, password) => {
    try {
      const { data } = await api.post('/auth/login', { username, password });
      if (data.success) {
        localStorage.setItem('smart_kirana_token', data.token);
        localStorage.setItem('smart_kirana_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message || 'Login failed' };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to connect to server';
      return { success: false, message };
    }
  };

  const logout = () => {
    localStorage.removeItem('smart_kirana_token');
    localStorage.removeItem('smart_kirana_user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    role: user?.role || null,
    isAdmin: user?.role === 'ADMIN',
    isStaff: user?.role === 'STAFF',
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
