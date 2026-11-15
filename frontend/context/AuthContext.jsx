import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../utils/api.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await apiRequest('/api/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      setStoredToken('');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function login(email, password) {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: payload,
    });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setStoredToken('');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
