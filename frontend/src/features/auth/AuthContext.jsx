import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from './auth.api';
import { authStorage } from './auth.storage';

const AuthContext = createContext(null);

const SUSPENSION_CHECK_INTERVAL_MS = 60 * 1000;
const SUSPENSION_CHECK_MIN_GAP_MS = 15 * 1000;
const SUSPENDED_MESSAGE = 'Tài khoản của bạn đã bị tạm dừng bởi quản trị viên. Bạn sẽ được đăng xuất.';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authStorage.getUser());
  const [token, setToken] = useState(() => authStorage.getToken());
  const [loading, setLoading] = useState(() => !!authStorage.getToken());

  const clearSession = useCallback(() => {
    authStorage.clearSession();
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const handleSuspendedSession = useCallback(() => {
    clearSession();
    alert(SUSPENDED_MESSAGE);
    window.location.href = '/login';
  }, [clearSession]);

  // Verify token & refresh user when token changes
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function verifyCurrentSession() {
      try {
        const data = await authApi.getMe(token);
        if (cancelled) return;

        if (data?.user) {
          setUser(data.user);
          authStorage.setUser(data.user);
        }
      } catch (err) {
        if (cancelled) return;

        if (err.suspended) {
          handleSuspendedSession();
          return;
        }

        if (err.status === 401 || err.status === 403) {
          clearSession();
          return;
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    verifyCurrentSession();

    return () => {
      cancelled = true;
    };
  }, [clearSession, handleSuspendedSession, token]);

  // Periodic check for account suspension while a session is already open
  useEffect(() => {
    if (!token || !user) return;
    let lastSuspensionCheckAt = 0;

    const checkSuspension = async () => {
      const now = Date.now();
      if (now - lastSuspensionCheckAt < SUSPENSION_CHECK_MIN_GAP_MS) return;
      lastSuspensionCheckAt = now;

      try {
        await authApi.getMe(token);
      } catch (err) {
        if (err.status === 403 && err.suspended) {
          handleSuspendedSession();
        }
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
  }, [handleSuspendedSession, token, user]);

  const login = useCallback((newToken, userData, options) => {
    authStorage.setSession(newToken, userData, options);
    setToken(newToken);
    setUser(userData);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const updateUser = useCallback((nextUser) => {
    setUser((prevUser) => {
      const resolvedUser = typeof nextUser === 'function' ? nextUser(prevUser) : nextUser;
      authStorage.setUser(resolvedUser);

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
