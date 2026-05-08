import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Briefcase } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';
import EmployerHeader from '@widgets/employer/EmployerHeader';
import EmployerSidebar from '@widgets/employer/EmployerSidebar';
import ManageJobsTab from '@widgets/employer/ManageJobsTab';
import ManageCandidatesTab from '@widgets/employer/ManageCandidatesTab';
import CompanyProfileTab from '@widgets/employer/CompanyProfileTab';
import NotificationsTab from '@widgets/employer/NotificationsTab';
import AnalyticsTab from '@widgets/employer/AnalyticsTab';
import DashboardTab from '@widgets/employer/DashboardTab';
import OnboardingTab from '@widgets/employer/OnboardingTab';
import ManageMeetingRoomsTab from '@widgets/employer/ManageMeetingRoomsTab';
import AITestManagementContent from '@widgets/employer/AITestManagementContent';
import {
  getEmployerDashboardPath,
  getEmployerDashboardState,
  getEmployerDashboardTab,
} from '@shared/utils/employerDashboardRoutes';
import { cachedJsonFetch } from '@shared/api/requestCache';
import { prefetchEmployerPortalData } from '@shared/api/employerPrefetch';

export default function EmployerDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => getEmployerDashboardTab(location));
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setActiveTab(getEmployerDashboardTab(location));
  }, [location]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await cachedJsonFetch(`${API_BASE_URL}/api/employer/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        }, { ttlMs: 15 * 1000 });
        setStats(data.stats);
        setRecentJobs(data.recentJobs || []);
        prefetchEmployerPortalData(token);
      } catch (err) {
        console.error('Error fetching dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchDashboard();
    else setLoading(false);
  }, [token]);

  // Fallback stats when API not ready
  const displayStats = stats || {
    totalJobs: 0,
    activeJobs: 0,
    pendingJobs: 0,
    rejectedJobs: 0,
    totalCandidates: 0,
    newCandidates: 0,
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(getEmployerDashboardPath(tab), { state: getEmployerDashboardState(tab) });
  };

  // Greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
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
              <h1 className="text-xl font-extrabold sm:text-2xl bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">
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
          <EmployerSidebar activeKey={activeTab} onSelect={handleTabChange} />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'dashboard' && (
              <DashboardTab 
                stats={stats} 
                recentJobs={recentJobs} 
                loading={loading} 
                setActiveTab={handleTabChange}
              />
            )}

            {activeTab === 'jobs' && <ManageJobsTab />}
            {activeTab === 'candidates' && <ManageCandidatesTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
            {activeTab === 'company' && <CompanyProfileTab />}
            {activeTab === 'onboarding' && <OnboardingTab />}
            {activeTab === 'ai-tests' && <AITestManagementContent />}
            {activeTab === 'meeting-rooms' && <ManageMeetingRoomsTab />}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500"></div>
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 border-b border-slate-800/60 pb-8 lg:grid-cols-[1.35fr_repeat(3,minmax(0,1fr))]">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-extrabold tracking-tight">
                    <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">Aptertek</span>
                    <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Work</span>
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Employer Portal</p>
                </div>
              </div>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-400">
                Nền tảng quản lý tuyển dụng thông minh — đăng tin, sàng lọc ứng viên, phỏng vấn online và phân tích hiệu quả tuyển dụng.
              </p>
            </div>

            {/* Công cụ NTD */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Công cụ NTD</h4>
              <div className="mt-4 space-y-3">
                <button onClick={() => handleTabChange('jobs')} className="group flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">Quản lý tin tuyển dụng</button>
                <button onClick={() => handleTabChange('candidates')} className="group flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">Quản lý ứng viên</button>
                <button onClick={() => handleTabChange('ai-tests')} className="group flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">Bài Test AI</button>
                <button onClick={() => navigate('/employer/post-job')} className="group flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">Đăng tin tuyển dụng</button>
              </div>
            </div>

            {/* Quản lý */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Quản lý</h4>
              <div className="mt-4 space-y-3">
                <button onClick={() => handleTabChange('analytics')} className="group flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">Phân tích & Thống kê</button>
                <button onClick={() => handleTabChange('company')} className="group flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">Hồ sơ công ty</button>
                <button onClick={() => handleTabChange('onboarding')} className="group flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">Onboarding</button>
                <button onClick={() => handleTabChange('meeting-rooms')} className="group flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">Phòng phỏng vấn</button>
              </div>
            </div>

            {/* Hỗ trợ */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Hỗ trợ & Liên hệ</h4>
              <div className="mt-4 space-y-3">
                <a href="mailto:support@aptertekwork.vn" className="flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">
                  📧 support@aptertekwork.vn
                </a>
                <a href="tel:19006868" className="flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">
                  📞 1900 6868
                </a>
                <div className="flex items-start gap-2 text-sm text-slate-400">
                  📍 Tầng 12, Lagimark, Bình Thạnh, TP.HCM
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} AptertekWork. Bản quyền thuộc về D205-VN.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="transition-all duration-200 hover:text-white">Điều khoản</a>
              <a href="#" className="transition-all duration-200 hover:text-white">Chính sách</a>
              <a href="#" className="transition-all duration-200 hover:text-white">Trợ giúp</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
