import { useNotifications } from '@components/providers/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Info, AlertTriangle, XCircle, Trash2, Loader2, Eye } from 'lucide-react';

function getNotificationMeta(type) {
  switch (type) {
    case 'employer_job_approved':
      return { icon: CheckCircle2, iconClass: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white', label: 'Tin được duyệt' };
    case 'employer_job_rejected':
      return { icon: XCircle, iconClass: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white', label: 'Tin bị từ chối' };
    case 'employer_new_candidate':
      return { icon: Info, iconClass: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white', label: 'Ứng viên mới' };
    case 'employer_interview_scheduled':
      return { icon: AlertTriangle, iconClass: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white', label: 'Lịch phỏng vấn' };
    default:
      return { icon: Bell, iconClass: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white', label: 'Thông báo' };
  }
}

function formatNotificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function NotificationsTab() {
  const { notifications, loading, markAllAsRead, markAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  const handleViewNotification = async (notif) => {
    await markAsRead(notif.id);
    const target = notif.to || notif.to_path || '/employer/dashboard';
    navigate(target, { state: notif.tab ? { activeTab: notif.tab } : undefined });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm">
      {/* Gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-t-2xl"></div>

      {/* Header */}
      <div className="flex items-center justify-between p-5 pt-6 border-b border-indigo-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200/60">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Thông báo</h2>
            <p className="text-xs text-gray-400">Cập nhật trạng thái tin tuyển dụng và ứng viên</p>
          </div>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-sm font-semibold text-indigo-600 hover:text-violet-700 transition-colors px-4 py-2 rounded-xl hover:bg-indigo-50/80"
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="divide-y divide-indigo-50/80">
        {notifications.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
              <Bell className="w-8 h-8 text-indigo-300" />
            </div>
            <p className="text-gray-500 font-medium">Chưa có thông báo nào</p>
            <p className="text-sm text-gray-400 mt-1">Khi có cập nhật mới, bạn sẽ thấy tại đây.</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const meta = getNotificationMeta(notif.type);
            const IconComp = meta.icon;
            return (
              <div
                key={notif.id}
                className={`flex items-start gap-4 px-5 py-4 transition-all duration-300 hover:bg-indigo-50/30 group ${
                  !notif.read ? 'bg-gradient-to-r from-indigo-50/40 to-violet-50/30' : ''
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md ${meta.iconClass}`}>
                  <IconComp className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-semibold ${!notif.read ? 'text-gray-800' : 'text-gray-600'}`}>{notif.title}</p>
                      <p className="mt-1 text-xs text-gray-500 leading-relaxed">{notif.message}</p>
                    </div>
                    {!notif.read && (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-sm shadow-indigo-200"></span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">{formatNotificationTime(notif.created_at)}</p>
                </div>
                <button
                  onClick={() => deleteNotification(notif.id)}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
                  title="Xóa thông báo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleViewNotification(notif)}
                  className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
                  title="Xem và đánh dấu đã đọc"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
