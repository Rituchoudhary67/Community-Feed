import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth status on mount
  useEffect(() => {
    authAPI.me()
      .then(res => {
        if (res.data.authenticated) {
          setUser({ id: res.data.id, username: res.data.username });
        }
      })
      .catch(() => {}) // not logged in
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await authAPI.login(username, password);
    setUser({ id: res.data.id, username: res.data.username });
    return res.data;
  }, []);

  const register = useCallback(async (username, password) => {
    const res = await authAPI.register(username, password);
    setUser({ id: res.data.id, username: res.data.username });
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    await authAPI.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
