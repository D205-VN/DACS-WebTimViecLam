import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';
import { cachedJsonFetch } from '@shared/api/requestCache';
import EmployerHeader from '@widgets/employer/EmployerHeader';
import EmployerSidebar from '@widgets/employer/EmployerSidebar';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default function EmployerPageLayout({ activeKey, children }) {
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!token) return;
    cachedJsonFetch(`${API_BASE_URL}/api/employer/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    }, { ttlMs: 15 * 1000 })
      .then((data) => { if (data?.stats) setStats(data.stats); })
      .catch(() => {});
  }, [token]);

  const displayStats = stats || { pendingJobs: 0, newCandidates: 0 };

  return (
    <div className="aw-page">
      <EmployerHeader />

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm mb-5 p-6 shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-t-2xl"></div>
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br from-indigo-100/40 to-violet-100/30 blur-3xl"></div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-extrabold bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent sm:text-2xl">
                {getGreeting()}, {user?.company_name || user?.full_name || 'Nhà tuyển dụng'}
              </h1>
              <p className="mt-1.5 text-sm text-gray-500 sm:text-base">
                {displayStats.pendingJobs > 0
                  ? `Hiện có ${displayStats.pendingJobs} tin đang chờ admin chấp nhận hoặc từ chối.`
                  : displayStats.newCandidates > 0
                    ? `Hôm nay bạn có ${displayStats.newCandidates} ứng viên mới đang chờ xử lý.`
                    : 'Chào mừng bạn đến với bảng điều khiển nhà tuyển dụng.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <span className="text-xs font-semibold text-violet-500 bg-violet-50 px-3 py-1.5 rounded-full">Employer Portal</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row">
          <EmployerSidebar activeKey={activeKey} />

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500"></div>
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-slate-500">© 2026 AptertekWork - Bản quyền thuộc về D205-VN</p>
            <div className="flex gap-5">
              <a href="#" className="text-xs text-slate-400 transition-colors hover:text-white">Điều khoản</a>
              <a href="#" className="text-xs text-slate-400 transition-colors hover:text-white">Chính sách</a>
              <a href="#" className="text-xs text-slate-400 transition-colors hover:text-white">Trợ giúp</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
