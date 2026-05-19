import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API_BASE_URL from '@shared/api/baseUrl';

const AuthContext = createContext(null);

const API_BASE = `${API_BASE_URL}/api/auth`;
const SUSPENSION_CHECK_INTERVAL_MS = 60 * 1000;
const SUSPENSION_CHECK_MIN_GAP_MS = 15 * 1000;

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
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            const data = await res.json().catch(() => ({}));
            if (data.suspended) {
              throw new Error('SUSPENDED');
            }
            throw new Error('Token invalid');
          }
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
        if (err.message === 'SUSPENDED') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
          setLoading(false);
          alert('Tài khoản của bạn đã bị tạm dừng bởi quản trị viên. Bạn sẽ được đăng xuất.');
          window.location.href = '/login';
          return;
        }
        if (err.message === 'Token invalid') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
        setLoading(false);
      });
  }, [token]);

  // Periodic check for account suspension while a session is already open
  useEffect(() => {
    if (!token || !user) return;
    let lastSuspensionCheckAt = 0;

    const checkSuspension = async () => {
      const now = Date.now();
      if (now - lastSuspensionCheckAt < SUSPENSION_CHECK_MIN_GAP_MS) return;
      lastSuspensionCheckAt = now;

      try {
        const res = await fetch(`${API_BASE}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data.suspended) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            alert('Tài khoản của bạn đã bị tạm dừng bởi quản trị viên. Bạn sẽ được đăng xuất.');
            window.location.href = '/login';
          }
        }
      } catch {
        // Network error — ignore
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSuspension();
      }
    };

    const interval = setInterval(checkSuspension, SUSPENSION_CHECK_INTERVAL_MS);
    window.addEventListener('focus', checkSuspension);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkSuspension);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, user]);

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
