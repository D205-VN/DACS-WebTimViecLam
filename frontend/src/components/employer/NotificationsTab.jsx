import React, { useState, useEffect } from 'react';
import { Bell, UserPlus, Clock, Info, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import API_BASE_URL from '../../config/api';
import { useNavigate } from 'react-router-dom';

export default function NotificationsTab() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/notifications?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setNotifications((data.data || []).map((item) => ({ ...item, read: true })));
          await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          window.dispatchEvent(new Event('notifications-updated'));
        }
      } catch (err) {
        console.error('Fetch notifications error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchNotifications();
  }, [token]);

  const getIcon = (type) => {
    switch (type) {
      case 'employer_new_candidate': return UserPlus;
      case 'admin_job_pending': return Clock;
      case 'employer_job_rejected':
      case 'seeker_application_rejected':
        return XCircle;
      case 'employer_job_approved':
      case 'seeker_application_hired':
        return CheckCircle2;
      default: return Info;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'employer_new_candidate': return 'text-emerald-500 bg-emerald-50';
      case 'admin_job_pending': return 'text-amber-500 bg-amber-50';
      case 'employer_job_rejected':
      case 'seeker_application_rejected':
        return 'text-red-500 bg-red-50';
      case 'employer_job_approved':
      case 'seeker_application_hired':
        return 'text-emerald-500 bg-emerald-50';
      default: return 'text-blue-500 bg-blue-50';
    }
  };

  if (loading) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 text-navy-700 animate-spin mb-4" />
      <p className="text-gray-500 font-medium">Đang tải thông báo...</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h3 className="font-bold text-gray-800 text-lg">Thông báo tuyển dụng</h3>
          <p className="text-xs text-gray-500 mt-1">Theo dõi tin chờ duyệt, tin bị từ chối và ứng viên mới.</p>
        </div>
        <div className="text-sm text-navy-600 font-medium">
          {notifications.length} thông báo
        </div>
      </div>
      
      <div className="divide-y divide-gray-100">
        {notifications.length > 0 ? notifications.map(note => {
          const Icon = getIcon(note.type);
          const colorClass = getColor(note.type);
          return (
            <button
              key={note.id}
              type="button"
              onClick={() => note.to && navigate(note.to, { state: note.tab ? { activeTab: note.tab } : undefined })}
              className={`w-full p-5 flex items-start gap-4 hover:bg-gray-50/50 transition-colors text-left ${!note.read ? 'bg-navy-50/30' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`text-sm font-semibold ${!note.read ? 'text-gray-900' : 'text-gray-700'}`}>{note.title}</h4>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                    {new Date(note.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
                <p className={`text-sm ${!note.read ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{note.message}</p>
              </div>
              {!note.read && <div className="w-2.5 h-2.5 bg-navy-600 rounded-full mt-2 shrink-0"></div>}
            </button>
          );
        }) : (
          <div className="p-20 text-center text-gray-500">
            Hiện chưa có thông báo nào cho nhà tuyển dụng.
          </div>
        )}
      </div>
    </div>
  );
}
