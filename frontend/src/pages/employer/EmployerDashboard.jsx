import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Building2, Plus, TrendingUp, Clock, Eye, Briefcase, ChevronRight, Calendar, MapPin, DollarSign, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EmployerHeader from '../../components/employer/EmployerHeader';

export default function EmployerDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/employer/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setRecentJobs(data.recentJobs || []);
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
    totalCandidates: 0,
    newCandidates: 0,
  };

  const statCards = [
    { label: 'Tổng tin đăng', value: displayStats.totalJobs, icon: FileText, color: 'from-blue-500 to-blue-600', bgLight: 'bg-blue-50', textColor: 'text-blue-600' },
    { label: 'Tin đang tuyển', value: displayStats.activeJobs, icon: TrendingUp, color: 'from-emerald-500 to-emerald-600', bgLight: 'bg-emerald-50', textColor: 'text-emerald-600' },
    { label: 'Tổng ứng viên', value: displayStats.totalCandidates, icon: Users, color: 'from-violet-500 to-violet-600', bgLight: 'bg-violet-50', textColor: 'text-violet-600' },
    { label: 'Ứng viên mới', value: displayStats.newCandidates, icon: UserPlus, color: 'from-amber-500 to-amber-600', bgLight: 'bg-amber-50', textColor: 'text-amber-600' },
  ];

  const sidebarItems = [
    { key: 'dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
    { key: 'jobs', label: 'Quản lý tin đăng', icon: FileText },
    { key: 'candidates', label: 'Ứng viên ứng tuyển', icon: Users },
    { key: 'company', label: 'Hồ sơ công ty', icon: Building2 },
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
              {displayStats.newCandidates > 0
                ? `Hôm nay bạn có ${displayStats.newCandidates} ứng viên mới đang chờ phỏng vấn.`
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
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {statCards.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div className={`${item.bgLight} ${item.textColor} w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider mb-1">{item.label}</p>
                  <h2 className="text-2xl font-bold text-gray-800">{item.value}</h2>
                </div>
              ))}
            </div>

            {/* Recent Jobs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-lg">Tin tuyển dụng mới nhất</h3>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className="text-navy-600 text-sm font-semibold hover:text-navy-800 flex items-center gap-1 transition-colors"
                >
                  Xem tất cả
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-700"></div>
                  </div>
                ) : recentJobs.length > 0 ? (
                  recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-gray-50/80 border border-gray-100 rounded-xl hover:border-navy-200 hover:shadow-sm transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-4 mb-3 md:mb-0">
                        <div className="bg-white p-3 rounded-lg border border-gray-200 text-navy-600 group-hover:bg-gradient-to-br group-hover:from-navy-600 group-hover:to-navy-800 group-hover:text-white group-hover:border-transparent transition-all duration-200 shadow-sm">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 group-hover:text-navy-700 transition-colors">{job.title}</h4>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            {job.location && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {job.location}
                              </span>
                            )}
                            {job.salary && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <DollarSign className="w-3 h-3" /> {job.salary}
                              </span>
                            )}
                            {job.deadline && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Hết hạn: {new Date(job.deadline).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                            {job.applicant_count !== undefined && (
                              <span className="text-xs font-medium text-success-600 flex items-center gap-1">
                                <Users className="w-3 h-3" /> {job.applicant_count} Ứng viên
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all">
                          Sửa
                        </button>
                        <button className="px-4 py-2 bg-gradient-to-r from-navy-600 to-navy-800 text-white rounded-lg text-sm font-semibold hover:shadow-md transition-all">
                          Ứng viên
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  /* Empty state with sample data */
                  [1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-gray-50/80 border border-gray-100 rounded-xl hover:border-navy-200 hover:shadow-sm transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-4 mb-3 md:mb-0">
                        <div className="bg-white p-3 rounded-lg border border-gray-200 text-navy-600 group-hover:bg-gradient-to-br group-hover:from-navy-600 group-hover:to-navy-800 group-hover:text-white group-hover:border-transparent transition-all duration-200 shadow-sm">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 group-hover:text-navy-700 transition-colors">
                            {i === 1 ? 'Frontend Developer (ReactJS)' : i === 2 ? 'Backend Developer (Node.js)' : 'UI/UX Designer'}
                          </h4>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> TP. Hồ Chí Minh
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Hết hạn: 30/04/2026
                            </span>
                            <span className="text-xs font-medium text-success-600 flex items-center gap-1">
                              <Users className="w-3 h-3" /> {15 - i * 3} Ứng viên
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all">
                          Sửa
                        </button>
                        <button className="px-4 py-2 bg-gradient-to-r from-navy-600 to-navy-800 text-white rounded-lg text-sm font-semibold hover:shadow-md transition-all">
                          Ứng viên
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <button
                onClick={() => navigate('/employer/post-job')}
                className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-navy-200 hover:-translate-y-0.5 transition-all duration-200 text-left group"
              >
                <div className="w-10 h-10 bg-navy-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-navy-100 transition-colors">
                  <Plus className="w-5 h-5 text-navy-600" />
                </div>
                <h4 className="font-bold text-gray-800 mb-1">Đăng tin mới</h4>
                <p className="text-xs text-gray-500">Tạo tin tuyển dụng để tìm ứng viên phù hợp</p>
              </button>

              <button
                onClick={() => setActiveTab('candidates')}
                className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-navy-200 hover:-translate-y-0.5 transition-all duration-200 text-left group"
              >
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <h4 className="font-bold text-gray-800 mb-1">Xem ứng viên</h4>
                <p className="text-xs text-gray-500">Duyệt hồ sơ ứng viên đã nộp đơn</p>
              </button>

              <button
                onClick={() => setActiveTab('company')}
                className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-navy-200 hover:-translate-y-0.5 transition-all duration-200 text-left group"
              >
                <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-violet-100 transition-colors">
                  <Building2 className="w-5 h-5 text-violet-600" />
                </div>
                <h4 className="font-bold text-gray-800 mb-1">Hồ sơ công ty</h4>
                <p className="text-xs text-gray-500">Cập nhật thông tin và hình ảnh công ty</p>
              </button>
            </div>
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