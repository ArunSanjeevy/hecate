import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, setAuthToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);
const SESSION_KEY = 'hecate-dashboard-session';

export function AuthProvider({ children }) {
  // sessionStorage survives a refresh in this tab, but is cleared when the browser session ends.
  // The JWT is never stored in localStorage, which would persist beyond the session.
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  });

  const clearSession = useCallback(() => {
    setAuthToken(null);
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  const establishSession = useCallback((token, user) => {
    const next = { token, user };
    setAuthToken(token);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  useEffect(() => {
    setAuthToken(session?.token);
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [session?.token, clearSession]);

  const value = useMemo(() => ({
    user: session?.user || null,
    isAuthenticated: Boolean(session?.token),
    login: async (credentials) => {
      const result = await apiClient.login(credentials);
      establishSession(result.token, result.user);
      return result;
    },
    signup: (credentials) => apiClient.signup(credentials),
    logout: clearSession,
  }), [session, establishSession, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
