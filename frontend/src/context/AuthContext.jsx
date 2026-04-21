import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API_BASE_URL from '../config/api';

const AuthContext = createContext(null);

const API_BASE = `${API_BASE_URL}/api/auth`;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Khôi phục user ngay lập tức từ localStorage để tránh flash
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(() => !!localStorage.getItem('token'));

  // Verify token & refresh user when token changes
  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          // Only clear token if server explicitly rejects it (401/403)
          if (res.status === 401 || res.status === 403) {
            throw new Error('Token invalid');
          }
          // For other errors (500, etc.), keep the cached user
          setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.message === 'Token invalid') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
        // Network error: keep cached user, don't logout
        setLoading(false);
      });
  }, [token]);

  const login = useCallback((newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const updateUser = useCallback((nextUser) => {
    setUser((prevUser) => {
      const resolvedUser = typeof nextUser === 'function' ? nextUser(prevUser) : nextUser;

      if (resolvedUser) {
        localStorage.setItem('user', JSON.stringify(resolvedUser));
      } else {
        localStorage.removeItem('user');
      }

      return resolvedUser;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook is intentionally co-located with provider (Vite fast refresh).
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
