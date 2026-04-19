import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_BASE = 'http://localhost:5001/api/auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Khôi phục user ngay lập tức từ localStorage để tránh flash
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Verify token & refresh user data on mount
  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => {
          if (!res.ok) throw new Error('Token invalid');
          return res.json();
        })
        .then(data => {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
          setLoading(false);
        })
        .catch(() => {
          // Token expired or invalid — clear everything
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []); // Chỉ chạy 1 lần khi mount

  const login = useCallback((newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
