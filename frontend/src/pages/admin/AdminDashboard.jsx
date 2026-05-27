import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getAdminDashboardPath,
  getAdminDashboardState,
  getAdminDashboardTab,
} from '@services/navigation/adminDashboardRoutes';
import {
  Activity,
  Ban,
  Bell,
  Briefcase,
  BriefcaseBusiness,
  Clock3,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@components/providers/AuthContext';
import { useNotifications } from '@components/providers/NotificationContext';
import API_BASE_URL from '@services/http/baseUrl';
import UserAvatar from '@components/ui/UserAvatar';

const navItems = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'users', label: 'Người dùng', icon: Users },
  { id: 'jobs', label: 'Việc làm', icon: Briefcase },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

const searchPlaceholderByTab = {
  overview: 'Tìm người dùng hoặc tin chờ duyệt...',
  users: 'Tìm theo tên, email hoặc vai trò...',
  jobs: 'Tìm theo vị trí hoặc công ty...',
  notifications: 'Tìm theo tiêu đề hoặc nội dung thông báo...',
  settings: 'Tìm trong bảng điều khiển...',
};

function getRoleLabel(row) {
  const roleCode = row?.role_code || row?.role;
  const roleName = row?.role_name;

  if (roleName) return roleName;
  if (roleCode === 'admin') return 'Quản trị';
  if (roleCode === 'seeker') return 'Ứng viên';
  if (roleCode === 'employer') return 'Nhà tuyển dụng';
  return roleCode || 'Chưa xác định';
}

function getRoleTone(roleCode) {
  if (roleCode === 'admin') {
    return 'border-blue-500/20 bg-blue-500/10 text-blue-300';
  }

  if (roleCode === 'employer') {
    return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  }

  return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
}

function getInitials(name) {
  if (!name) return 'AD';

  return name
    .split(' ')
    .map((part) => part[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export default function AdminDashboard() {
  const { user, logout, token } = useAuth();
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => getAdminDashboardTab(location));
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ users: 0, jobs: 0, pendingJobs: 0, applied: 0 });
  const [users, setUsers] = useState([]);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobActionLoading, setJobActionLoading] = useState(null);

  const [suspendLoading, setSuspendLoading] = useState(null);

  // Sync tab from URL
  useEffect(() => {
    setActiveTab(getAdminDashboardTab(location));
  }, [location]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(getAdminDashboardPath(tab), { state: getAdminDashboardState(tab) });
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, usersRes, jobsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/admin/stats`, { headers }),
          fetch(`${API_BASE_URL}/api/admin/users`, { headers }),
          fetch(`${API_BASE_URL}/api/admin/jobs/pending`, { headers }),
        ]);

        const [statsData, usersData, jobsData] = await Promise.all([
          statsRes.json(),
          usersRes.json(),
          jobsRes.json(),
        ]);

        if (!statsData.error) setStats(statsData);
        if (!usersData.error) setUsers(usersData.data || []);
        if (!jobsData.error) setPendingJobs(jobsData.data || []);
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // If notifications change, maybe we want to refresh stats too?
    // Especially if it's a new job pending notification
    const lastNote = notifications[0];
    if (lastNote && lastNote.type === 'admin_job_pending') {
      // Re-fetch dashboard data to update stats and pending list
      const headers = { Authorization: `Bearer ${token}` };
      fetch(`${API_BASE_URL}/api/admin/stats`, { headers })
        .then(res => res.json())
        .then(data => { if (!data.error) setStats(data); });
      
      fetch(`${API_BASE_URL}/api/admin/jobs/pending`, { headers })
        .then(res => res.json())
        .then(data => { if (!data.error) setPendingJobs(data.data || []); });
    }
  }, [notifications, token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMarkNotificationsAsRead = async () => {
    await markAllAsRead();
  };

  const handleOpenNotifications = async () => {
    handleTabChange('notifications');
    await handleMarkNotificationsAsRead();
  };

  const handleJobModeration = async (id, status) => {
    let reason = null;
    if (status === 'rejected') {
      const job = pendingJobs.find(j => j.id === id);
      const defaultReason = job?.ai_suggestion || '';
      reason = window.prompt('Nhập lý do từ chối (Nhà tuyển dụng sẽ nhận được thông báo này):', defaultReason);
      if (reason === null) return; // Cancelled
    }

    try {
      setJobActionLoading(id);
      const res = await fetch(`${API_BASE_URL}/api/admin/jobs/${id}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, reason }),
      });

      if (res.ok) {
        setPendingJobs((prev) => prev.filter((job) => job.id !== id));
        setStats((prev) => ({
          ...prev,
          jobs: status === 'approved' ? prev.jobs + 1 : prev.jobs,
          pendingJobs: Math.max(prev.pendingJobs - 1, 0),
        }));
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật trạng thái tin:', err);
    } finally {
      setJobActionLoading(null);
    }
  };

  const handleToggleSuspend = async (userId, currentSuspended) => {
    const action = currentSuspended ? 'kích hoạt lại' : 'tạm dừng';
    if (!window.confirm(`Bạn có chắc muốn ${action} tài khoản này?`)) return;

    try {
      setSuspendLoading(userId);
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ suspended: !currentSuspended }),
      });

      if (res.ok) {
        const data = await res.json();
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, is_suspended: data.data.is_suspended } : u
          )
        );
      } else {
        const errData = await res.json();
        alert(errData.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      console.error('Toggle suspend error:', err);
    } finally {
      setSuspendLoading(null);
    }
  };

  const normalizedQuery = searchTerm.trim().toLowerCase();

  const filteredUsers = users.filter((row) => {
    if (!normalizedQuery) return true;

    const haystack = [
      row.full_name,
      row.email,
      row.role_code,
      row.role_name,
      getRoleLabel(row),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const filteredPendingJobs = pendingJobs.filter((job) => {
    if (!normalizedQuery) return true;

    const haystack = [job.job_title, job.company_name, job.job_address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const filteredNotifications = notifications.filter((note) => {
    if (!normalizedQuery) return true;

    const haystack = [note.title, note.message, note.type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const recentUsers = filteredUsers.slice(0, 5);
  const pendingPreview = filteredPendingJobs.slice(0, 4);

  const adminCount = users.filter((row) => (row.role_code || row.role) === 'admin').length;
  const employerCount = users.filter((row) => (row.role_code || row.role) === 'employer').length;
  const seekerCount = users.filter((row) => (row.role_code || row.role) === 'seeker').length;
  const verifiedCount = users.filter((row) => row.is_verified).length;

  const statCards = [
    {
      title: 'Tổng người dùng',
      value: stats.users.toLocaleString(),
      helper: `${verifiedCount.toLocaleString()} đã xác thực`,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      title: 'Việc làm đã duyệt',
      value: stats.jobs.toLocaleString(),
      helper: 'Đang hiển thị ngoài trang công khai',
      icon: BriefcaseBusiness,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      title: 'Tin chờ phê duyệt',
      value: stats.pendingJobs.toLocaleString(),
      helper: 'Cần xử lý trong hàng chờ',
      icon: Clock3,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      title: 'Lượt ứng tuyển',
      value: stats.applied.toLocaleString(),
      helper: 'Toàn hệ thống',
      icon: Activity,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0d1225] to-[#080c18] text-white">
      <div className="fixed inset-0 pointer-events-none z-0"><div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[150px]" /><div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/[0.03] rounded-full blur-[120px]" /></div>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0e1a]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className="flex items-center gap-3 rounded-lg transition-transform duration-200 "
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-lg font-bold text-transparent">
                AdminPanel
              </p>
              <p className="text-xs text-slate-500">Kiểm soát người dùng và nội dung</p>
            </div>
          </button>

          <div className="hidden flex-1 items-center justify-center lg:flex">
            <div className="flex w-full max-w-xl items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
              <Search className="mr-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={searchPlaceholderByTab[activeTab]}
                className="w-full border-none bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenNotifications}
              className="relative hidden rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5 text-slate-400 transition-all hover:border-indigo-500/20 hover:text-white md:flex"
              title="Mở thông báo quản trị"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                  {Math.min(unreadCount, 9)}
                </span>
              )}
            </button>

            <div className="hidden items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 sm:flex">
              <UserAvatar
                src={user?.avatar_url}
                alt={user?.full_name}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                fallbackClassName="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-600 ring-2 ring-white/10"
                iconClassName="h-4 w-4 text-white"
              />
              <div className="text-left">
                <p className="max-w-[160px] truncate text-sm font-semibold text-white/90">
                  {user?.full_name || 'System Admin'}
                </p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-300">
                  {user?.role_code || 'admin'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 transition-all hover:bg-rose-500/20 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-[1440px] px-4 pb-4 sm:px-6 lg:px-8 lg:hidden">
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
            <Search className="mr-3 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholderByTab[activeTab]}
              className="w-full border-none bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 sm:p-8">
          <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-52 w-52 rounded-full bg-purple-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-200">
                Admin Workspace
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Đồng bộ kiểm duyệt và vận hành hệ thống
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Theo dõi đăng ký mới, rà soát tin tuyển dụng chờ duyệt và giữ chất lượng dữ liệu
                toàn hệ thống trong một luồng làm việc thống nhất.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {[
                  { label: 'Đã xác thực', value: verifiedCount, tone: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10' },
                  { label: 'Nhà tuyển dụng', value: employerCount, tone: 'text-amber-300 border-amber-500/20 bg-amber-500/10' },
                  { label: 'Ứng viên', value: seekerCount, tone: 'text-blue-300 border-blue-500/20 bg-blue-500/10' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-xl border px-4 py-3 text-sm ${item.tone}`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{item.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:min-w-[320px] sm:grid-cols-2">
              <button
                onClick={() => handleTabChange('jobs')}
                className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-left transition-all hover:bg-amber-500/15"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Hàng chờ</p>
                <p className="mt-2 text-3xl font-bold text-white">{stats.pendingJobs.toLocaleString()}</p>
                <p className="mt-1 text-sm text-amber-200/80">tin đang chờ phê duyệt</p>
              </button>

              <button
                onClick={() => handleTabChange('users')}
                className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-left transition-all hover:bg-indigo-500/15"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Người dùng</p>
                <p className="mt-2 text-3xl font-bold text-white">{stats.users.toLocaleString()}</p>
                <p className="mt-1 text-sm text-indigo-200/80">hồ sơ đang hoạt động</p>
              </button>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-72">
            <div className="sticky top-28 space-y-4">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4">
                <p className="mb-4 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Điều hướng
                </p>
                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.id === 'notifications') {
                            handleOpenNotifications();
                            return;
                          }
                          handleTabChange(item.id);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/15'
                            : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-blue-500/15 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-5">
                <p className="text-sm font-semibold text-white">Ưu tiên kiểm duyệt</p>
                <p className="mt-2 text-sm leading-6 text-blue-100/75">
                  Hệ thống đang có {stats.pendingJobs.toLocaleString()} tin cần rà soát. Giữ nhịp duyệt
                  đều để luồng tuyển dụng không bị nghẽn.
                </p>
                <button
                  onClick={() => handleTabChange('jobs')}
                  className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                >
                  Mở hàng chờ
                </button>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 space-y-6">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((stat) => (
                <div
                  key={stat.title}
                  className={`group relative overflow-hidden rounded-2xl border ${stat.border} bg-white/[0.02] backdrop-blur-sm p-5 transition-all duration-300 hover:bg-white/[0.04]`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-400">{stat.title}</p>
                      <h3 className="mt-2 text-3xl font-bold tracking-tight text-white">{stat.value}</h3>
                      <p className="mt-2 text-sm text-slate-500">{stat.helper}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${stat.bg} ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    Ổn định
                  </div>
                  <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full ${stat.bg} blur-2xl opacity-50 transition-opacity duration-300 group-hover:opacity-100`} />
                </div>
              ))}
            </section>

            {loading ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center text-slate-400">
                Đang tải dữ liệu quản trị...
              </div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <>
                    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr,1fr]">
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                        <div className="mb-6 flex items-center justify-between gap-4">
                          <div>
                            <h2 className="text-xl font-bold text-white">Người dùng đăng ký gần đây</h2>
                            <p className="mt-1 text-sm text-slate-500">
                              Danh sách cập nhật nhanh để rà soát luồng người dùng mới.
                            </p>
                          </div>
                          <button
                            onClick={() => handleTabChange('users')}
                            className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-300 transition-all hover:bg-indigo-500/15"
                          >
                            Xem tất cả
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left">
                            <thead>
                              <tr className="border-b border-white/[0.06] text-xs uppercase tracking-[0.18em] text-slate-500">
                                <th className="pb-3 font-medium">Người dùng</th>
                                <th className="pb-3 font-medium">Vai trò</th>
                                <th className="pb-3 font-medium">Ngày tạo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recentUsers.map((row) => (
                                <tr
                                  key={row.id}
                                  className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                                >
                                  <td className="py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-white">
                                        {getInitials(row.full_name)}
                                      </div>
                                      <div>
                                        <p className="font-medium text-white">{row.full_name}</p>
                                        <p className="text-sm text-gray-500">{row.email}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-4">
                                    <span
                                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRoleTone(row.role_code || row.role)}`}
                                    >
                                      {getRoleLabel(row)}
                                    </span>
                                  </td>
                                  <td className="py-4 text-sm text-gray-400">{formatDate(row.created_at)}</td>
                                </tr>
                              ))}
                              {!recentUsers.length && (
                                <tr>
                                  <td colSpan="3" className="py-10 text-center text-sm text-gray-500">
                                    Không có bản ghi phù hợp với bộ lọc hiện tại.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                          <h2 className="text-lg font-bold text-white">Phân bổ vai trò</h2>
                          <p className="mt-1 text-sm text-slate-500">
                            Tỷ trọng hiện tại giữa quản trị, nhà tuyển dụng và ứng viên.
                          </p>

                          <div className="mt-5 space-y-3">
                            {[
                              { label: 'Quản trị', value: adminCount, tone: 'bg-indigo-500' },
                              { label: 'Nhà tuyển dụng', value: employerCount, tone: 'bg-amber-500' },
                              { label: 'Ứng viên', value: seekerCount, tone: 'bg-emerald-500' },
                            ].map((item) => {
                              const total = Math.max(users.length, 1);
                              const width = `${Math.max((item.value / total) * 100, item.value > 0 ? 8 : 0)}%`;

                              return (
                                <div key={item.label}>
                                  <div className="mb-2 flex items-center justify-between text-sm">
                                    <span className="text-slate-300">{item.label}</span>
                                    <span className="font-semibold text-white">{item.value.toLocaleString()}</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-white/5">
                                    <div className={`h-2 rounded-full ${item.tone}`} style={{ width }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6">
                          <h2 className="text-lg font-bold text-white">Điểm nóng kiểm duyệt</h2>
                          <p className="mt-2 text-sm leading-6 text-amber-100/80">
                            {stats.pendingJobs > 0
                              ? `Có ${stats.pendingJobs.toLocaleString()} tin đang chờ xử lý. Ưu tiên duyệt sớm để không làm chậm luồng đăng tuyển.`
                              : 'Hiện không có tin nào trong hàng chờ. Hệ thống đang ở trạng thái ổn định.'}
                          </p>
                          <button
                            onClick={() => handleTabChange('jobs')}
                            className="mt-4 rounded-xl border border-amber-400/20 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-amber-200 transition-all hover:bg-white/[0.1]"
                          >
                            Kiểm tra danh sách
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                      <div className="mb-6 flex items-center justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-bold text-white">Hàng chờ phê duyệt nổi bật</h2>
                          <p className="mt-1 text-sm text-slate-500">
                            Truy cập nhanh các tin đang đợi xử lý gần nhất.
                          </p>
                        </div>
                        <button
                          onClick={() => handleTabChange('jobs')}
                          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition-all hover:bg-amber-500/15"
                        >
                          Mở tab việc làm
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {pendingPreview.map((job) => (
                          <div
                            key={job.id}
                            className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 transition-all hover:bg-white/[0.05]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-lg font-semibold text-white">{job.job_title}</p>
                                <p className="mt-1 text-sm text-slate-400">{job.company_name || 'Chưa có công ty'}</p>
                              </div>
                              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">
                                Chờ duyệt
                              </span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                              <span>{formatDate(job.created_at)}</span>
                              {job.job_address ? <span>{job.job_address}</span> : null}
                            </div>
                          </div>
                        ))}

                        {!pendingPreview.length && (
                          <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-slate-500 xl:col-span-2">
                            Không còn tin nào trong hàng chờ phù hợp với bộ lọc hiện tại.
                          </div>
                        )}
                      </div>
                    </section>
                  </>
                )}

                {activeTab === 'users' && (
                  <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-white">Danh sách người dùng</h2>
                        <p className="mt-1 text-sm text-gray-500">
                          Theo dõi trạng thái xác thực và phân loại người dùng trong hệ thống.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Tất cả', value: filteredUsers.length, tone: 'border-white/[0.08] bg-white/[0.04] text-slate-200' },
                          { label: 'Admin', value: adminCount, tone: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300' },
                          { label: 'NTD', value: employerCount, tone: 'border-amber-500/20 bg-amber-500/10 text-amber-300' },
                          { label: 'Đã xác thực', value: verifiedCount, tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' },
                        ].map((item) => (
                          <div key={item.label} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${item.tone}`}>
                            {item.label}: {item.value.toLocaleString()}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse text-left">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-xs uppercase tracking-[0.18em] text-slate-500">
                            <th className="pb-3 font-medium">Người dùng</th>
                            <th className="pb-3 font-medium">Vai trò</th>
                            <th className="pb-3 font-medium">Trạng thái</th>
                            <th className="pb-3 font-medium">Ngày tạo</th>
                            <th className="pb-3 font-medium">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                            >
                              <td className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-white">
                                    {getInitials(row.full_name)}
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">{row.full_name}</p>
                                    <p className="text-sm text-gray-500">{row.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4">
                                <span
                                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRoleTone(row.role_code || row.role)}`}
                                >
                                  {getRoleLabel(row)}
                                </span>
                              </td>
                              <td className="py-4">
                                <span
                                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                                    row.is_verified
                                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                      : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                  }`}
                                >
                                  {row.is_verified ? 'Đã xác thực' : 'Chưa xác thực'}
                                </span>
                              </td>
                              <td className="py-4 text-sm text-gray-400">{formatDate(row.created_at)}</td>
                              <td className="py-4">
                                {(row.role_code || row.role) !== 'admin' && (
                                  <button
                                    onClick={() => handleToggleSuspend(row.id, row.is_suspended)}
                                    disabled={suspendLoading === row.id}
                                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-60 ${
                                      row.is_suspended
                                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                        : 'border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                                    }`}
                                  >
                                    {row.is_suspended ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                                    {suspendLoading === row.id ? 'Đang xử lý...' : row.is_suspended ? 'Kích hoạt' : 'Tạm dừng'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}

                          {!filteredUsers.length && (
                            <tr>
                              <td colSpan="5" className="py-12 text-center text-sm text-gray-500">
                                Không tìm thấy người dùng phù hợp.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {activeTab === 'jobs' && (
                  <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-white">Phê duyệt tin tuyển dụng</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Xử lý nhanh các tin đang chờ để giữ nhịp vận hành cho nhà tuyển dụng.
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        Hàng chờ hiện tại: <span className="font-semibold text-white">{filteredPendingJobs.length.toLocaleString()}</span> tin
                      </div>
                    </div>

                    {filteredPendingJobs.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.02] py-16 text-center text-slate-500">
                        <Briefcase className="mx-auto mb-4 h-12 w-12 opacity-20" />
                        Không có tin tuyển dụng nào đang chờ duyệt.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] border-collapse text-left">
                          <thead>
                            <tr className="border-b border-white/[0.06] text-xs uppercase tracking-[0.18em] text-slate-500">
                              <th className="pb-3 font-medium">Vị trí</th>
                              <th className="pb-3 font-medium">Công ty</th>
                              <th className="pb-3 font-medium">Ngày đăng</th>
                              <th className="pb-3 font-medium">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPendingJobs.map((job) => (
                              <tr
                                key={job.id}
                                className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                              >
                                <td className="py-4">
                                  <div>
                                    <p className="font-medium text-white">{job.job_title}</p>
                                    <div className="mt-1 flex flex-col gap-1">
                                      {job.job_address && (
                                        <p className="text-sm text-gray-500">{job.job_address}</p>
                                      )}
                                      {job.ai_suggestion && (
                                        <p className="text-[11px] font-medium text-amber-400 bg-amber-400/5 px-2 py-0.5 rounded-md border border-amber-400/10 italic">
                                          {job.ai_suggestion}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 text-sm text-gray-400">{job.company_name || 'Chưa có công ty'}</td>
                                <td className="py-4 text-sm text-gray-400">{formatDate(job.created_at)}</td>
                                <td className="py-4">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => handleJobModeration(job.id, 'approved')}
                                      disabled={jobActionLoading === job.id}
                                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300 transition-all hover:bg-emerald-500 hover:text-white disabled:opacity-60"
                                    >
                                      {jobActionLoading === job.id ? 'Đang xử lý...' : 'Chấp nhận'}
                                    </button>
                                    <button
                                      onClick={() => handleJobModeration(job.id, 'rejected')}
                                      disabled={jobActionLoading === job.id}
                                      className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-rose-300 transition-all hover:bg-rose-500 hover:text-white disabled:opacity-60"
                                    >
                                      Từ chối
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {activeTab === 'notifications' && (
                  <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-white">Thông báo quản trị</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Mọi tin mới nhà tuyển dụng gửi lên chờ duyệt sẽ xuất hiện tại đây.
                        </p>
                      </div>

                      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
                        Tổng số: <span className="font-semibold text-white">{filteredNotifications.length.toLocaleString()}</span> thông báo
                      </div>
                    </div>

                    <div className="space-y-3">
                      {filteredNotifications.length > 0 ? (
                        filteredNotifications.map((note) => (
                          <button
                            key={note.id}
                            type="button"
                            onClick={() => handleTabChange(note.tab || 'jobs')}
                            className={`w-full rounded-xl border p-4 text-left transition-all ${
                              note.read
                                ? 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                                : 'border-indigo-500/20 bg-indigo-500/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className={`text-sm font-semibold ${note.read ? 'text-white' : 'text-blue-100'}`}>
                                  {note.title}
                                </p>
                                <p className={`mt-2 text-sm leading-6 ${note.read ? 'text-gray-400' : 'text-gray-200'}`}>
                                  {note.message}
                                </p>
                              </div>
                              <span className="shrink-0 text-[11px] text-gray-500">
                                {formatDate(note.created_at)}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.02] py-16 text-center text-slate-500">
                          <Bell className="mx-auto mb-4 h-12 w-12 opacity-20" />
                          Chưa có thông báo quản trị nào.
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === 'settings' && (
                  <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,1fr]">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                      <h2 className="text-xl font-bold text-white">Thông tin quản trị</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Tóm tắt tài khoản hiện tại và trạng thái vận hành chung.
                      </p>

                      <div className="mt-6 flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
                        <UserAvatar
                          src={user?.avatar_url}
                          alt={user?.full_name}
                          className="h-16 w-16 rounded-full object-cover ring-2 ring-white/10"
                          fallbackClassName="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-600 ring-2 ring-white/10"
                          iconClassName="h-6 w-6 text-white"
                        />

                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-white">{user?.full_name || 'System Admin'}</p>
                          <p className="truncate text-sm text-slate-400">{user?.email || 'Chưa có email'}</p>
                          <div className="mt-3 inline-flex rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                            {user?.role_code || 'admin'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {[
                          { label: 'Người dùng đã xác thực', value: verifiedCount, icon: UserCheck, tone: 'text-emerald-400 bg-emerald-500/10' },
                          { label: 'Tin chờ xử lý', value: stats.pendingJobs, icon: Clock3, tone: 'text-amber-400 bg-amber-500/10' },
                        ].map((item) => (
                          <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center gap-3">
                              <div className={`rounded-lg p-3 ${item.tone}`}>
                                <item.icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm text-gray-400">{item.label}</p>
                                <p className="text-2xl font-bold text-white">{item.value.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                      <h2 className="text-xl font-bold text-white">Nguyên tắc vận hành</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Các điểm cần giữ đồng bộ khi kiểm duyệt nội dung hệ thống.
                      </p>

                      <div className="mt-6 space-y-4">
                        {[
                          'Tin nhà tuyển dụng mới được lưu ở trạng thái chờ duyệt trước khi hiển thị công khai.',
                          'Người dùng đã xác thực nên được ưu tiên khi rà soát các vấn đề quyền truy cập.',
                          'Hàng chờ càng nhỏ thì trải nghiệm đăng tuyển và ứng tuyển càng mượt hơn.',
                        ].map((item) => (
                          <div
                            key={item}
                            className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-sm leading-6 text-slate-300"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
