import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Plus,
  Users,
  Bell,
  Video,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';
import { cachedJsonFetch } from '@shared/api/requestCache';
import { getEmployerDashboardPath, getEmployerDashboardState } from '@shared/utils/employerDashboardRoutes';
import EmployerHeader from '@widgets/employer/EmployerHeader';

const sidebarItems = [
  { key: 'dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
  { key: 'jobs', label: 'Nhóm Tuyển dụng', icon: FileText },
  { key: 'candidates', label: 'Nhóm Ứng viên', icon: Users },
  { key: 'notifications', label: 'Thông báo', icon: Bell },
  { key: 'analytics', label: 'Phân tích & Thống kê', icon: BarChart3 },
  { key: 'ai-tests', label: 'Bài Test AI', icon: BrainCircuit },
  { key: 'company', label: 'Hồ sơ công ty', icon: Building2 },
  { key: 'onboarding', label: 'Hồ sơ & Onboarding', icon: ClipboardCheck },
  { key: 'meeting-rooms', label: 'Phòng Meet', icon: Video },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default function EmployerPageLayout({ activeKey, children }) {
  const navigate = useNavigate();
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

  const handleNavigate = (item) => {
    navigate(getEmployerDashboardPath(item.key), { state: getEmployerDashboardState(item.key) });
  };

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
          <aside className="w-full lg:w-64 shrink-0">
            <div className="sticky top-[72px] rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm p-4 shadow-sm">
              <h3 className="font-bold text-gray-400 mb-4 px-2 uppercase text-[11px] tracking-wider">Hệ thống</h3>
              <div className="space-y-1">
                {sidebarItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => handleNavigate(item)}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm font-medium transition-all duration-300 ${
                      activeKey === item.key
                        ? 'bg-gradient-to-r from-indigo-50 to-violet-50 font-semibold text-indigo-700 shadow-sm shadow-indigo-100/50'
                        : 'text-gray-600 hover:bg-indigo-50/40 hover:text-indigo-700'
                    }`}
                  >
                    <item.icon className={`w-[18px] h-[18px] transition-colors duration-300 ${activeKey === item.key ? 'text-indigo-600' : ''}`} />
                    {item.label}
                  </button>
                ))}
              </div>

              <hr className="my-4 border-indigo-50" />

              <button
                onClick={() => navigate('/employer/post-job')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200/60 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-300/60 hover:from-indigo-700 hover:to-violet-700 hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                Đăng tin mới
              </button>
            </div>
          </aside>

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
