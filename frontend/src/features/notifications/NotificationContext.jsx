import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((notification) => {
    const toast = {
      id: `${notification.id || Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: notification.title || 'Thông báo mới',
      message: notification.message || '',
      to: notification.to || notification.to_path || null,
    };

    setToasts((prev) => [toast, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, 6000);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.data) {
        setNotifications(data.data);
      }

      const countRes = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const countData = await countRes.json();
      if (typeof countData.unread === 'number') {
        setUnreadCount(countData.unread);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) {
      // Connect to Socket.io
      const baseSocketUrl = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : API_BASE_URL;
      const socketUrl = import.meta.env.DEV ? 'http://localhost:5001' : (baseSocketUrl || window.location.origin);
      
      const newSocket = io(socketUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling']
      });

      console.log('Attempting to connect to socket at:', socketUrl || window.location.origin);

      newSocket.on('connect', () => {
        console.log('Connected to notification socket. ID:', newSocket.id);
        console.log('Joining room for user:', user.id);
        newSocket.emit('join', String(user.id));
      });

      newSocket.on('new_notification', (notification) => {
        console.log('New notification received:', notification);
        setNotifications(prev => [notification, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
        pushToast(notification);
        
        // Show browser notification if permitted
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
          });
        }
      });

      newSocket.on('new_message', (payload) => {
        window.dispatchEvent(new CustomEvent('aptertek:new-message', { detail: payload }));
      });

      queueMicrotask(() => {
        fetchNotifications();
      });

      return () => {
        newSocket.disconnect();
      };
    } else {
      queueMicrotask(() => {
        setNotifications([]);
        setUnreadCount(0);
      });
    }
  }, [user, token, fetchNotifications, pushToast]);

  const markAllAsRead = useCallback(async () => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Mark all as read error:', err);
    }
  }, [token]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllAsRead, fetchNotifications }}>
      {children}
      <div className="fixed right-4 top-20 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div key={toast.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
            <div
              role="button"
              tabIndex={0}
              onClick={() => toast.to && window.location.assign(toast.to)}
              onKeyDown={(event) => {
                if ((event.key === 'Enter' || event.key === ' ') && toast.to) {
                  event.preventDefault();
                  window.location.assign(toast.to);
                }
              }}
              className="block w-full px-4 py-3 text-left transition hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{toast.title}</p>
                  {toast.message ? <p className="mt-1 line-clamp-2 text-sm text-slate-500">{toast.message}</p> : null}
                  <p className="mt-2 text-xs font-semibold text-cyan-700">Vừa xong</p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setToasts((prev) => prev.filter((item) => item.id !== toast.id));
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                  aria-label="Đóng thông báo"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationContext);
