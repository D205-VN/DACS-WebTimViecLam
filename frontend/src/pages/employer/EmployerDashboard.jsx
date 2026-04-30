import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Building2, Plus, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';
import EmployerHeader from '@widgets/employer/EmployerHeader';
import ManageJobsTab from '@widgets/employer/ManageJobsTab';
import ManageCandidatesTab from '@widgets/employer/ManageCandidatesTab';
import CompanyProfileTab from '@widgets/employer/CompanyProfileTab';
import NotificationsTab from '@widgets/employer/NotificationsTab';
import AnalyticsTab from '@widgets/employer/AnalyticsTab';
import DashboardTab from '@widgets/employer/DashboardTab';
import { Bell, BarChart3 } from 'lucide-react';
import OnboardingTab from '@widgets/employer/OnboardingTab';
export default function EmployerDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'dashboard');
  const [stats, setStats] = useState(null);

  // Update activeTab if location state changes
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async () => {
      console.log('Fetching dashboard data with token:', token ? 'Exists' : 'Missing');
      try {
        const res = await fetch(`${API_BASE_URL}/api/employer/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Dashboard response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('Dashboard data received:', data);
          setStats(data.stats);
          setRecentJobs(data.recentJobs || []);
        } else {
          const errorData = await res.json();
          console.error('Dashboard fetch failed:', errorData);
        }
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

  const sidebarItems = [
    { key: 'dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
    { key: 'jobs', label: 'Nhóm Tuyển dụng', icon: FileText },
    { key: 'candidates', label: 'Nhóm Ứng viên', icon: Users },
    { key: 'notifications', label: 'Thông báo', icon: Bell },
    { key: 'analytics', label: 'Phân tích & Thống kê', icon: BarChart3 },
    { key: 'company', label: 'Hồ sơ công ty', icon: Building2 },
    { key: 'onboarding', label: 'Hồ sơ & Onboarding', icon: ClipboardCheck },
  ];

  // Greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <EmployerHeader />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-navy-700 via-navy-800 to-navy-900 rounded-2xl p-8 mb-8 text-white relative overflow-hidden shadow-xl">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-navy-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-success-500/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              {getGreeting()}, {user?.company_name || user?.full_name || 'Nhà tuyển dụng'}! 👋
            </h1>
            <p className="text-navy-200 text-sm sm:text-base">
              {displayStats.pendingJobs > 0
                ? `Hiện có ${displayStats.pendingJobs} tin đang chờ admin chấp nhận hoặc từ chối.`
                : displayStats.newCandidates > 0
                  ? `Hôm nay bạn có ${displayStats.newCandidates} ứng viên mới đang chờ xử lý.`
                  : 'Chào mừng bạn đến với bảng điều khiển nhà tuyển dụng.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 sticky top-24">
              <h3 className="font-bold text-gray-400 mb-4 px-2 uppercase text-[11px] tracking-wider">Hệ thống</h3>
              <div className="space-y-1">
                {sidebarItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all duration-200 ${
                      activeTab === item.key
                        ? 'bg-navy-50 text-navy-700 font-semibold shadow-sm'
                        : 'text-gray-600 hover:bg-navy-50/50 hover:text-navy-700'
                    }`}
                  >
                    <item.icon className="w-4.5 h-4.5" />
                    {item.label}
                  </button>
                ))}
              </div>

              <hr className="my-4 border-gray-100" />

              <button
                onClick={() => navigate('/employer/post-job')}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-navy-600 to-navy-800 text-white p-3 rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                Đăng tin mới
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'dashboard' && (
              <DashboardTab 
                stats={stats} 
                recentJobs={recentJobs} 
                loading={loading} 
                setActiveTab={setActiveTab} 
              />
            )}

            {activeTab === 'jobs' && <ManageJobsTab />}
            {activeTab === 'candidates' && <ManageCandidatesTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
            {activeTab === 'company' && <CompanyProfileTab />}
            {activeTab === 'onboarding' && <OnboardingTab />}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-navy-900 text-navy-300 mt-16">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-navy-400">© 2026 AptertekWork — Bản quyền thuộc về D205-VN</p>
            <div className="flex gap-4">
              <a href="#" className="text-xs text-navy-400 hover:text-navy-200 transition-colors">Điều khoản</a>
              <a href="#" className="text-xs text-navy-400 hover:text-navy-200 transition-colors">Chính sách</a>
              <a href="#" className="text-xs text-navy-400 hover:text-navy-200 transition-colors">Trợ giúp</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
