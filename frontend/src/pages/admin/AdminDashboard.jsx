import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'users', label: 'Người dùng', icon: Users },
  { id: 'jobs', label: 'Việc làm', icon: Briefcase },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

const searchPlaceholderByTab = {
  overview: 'Tìm người dùng hoặc tin chờ duyệt...',
  users: 'Tìm theo tên, email hoặc vai trò...',
  jobs: 'Tìm theo vị trí hoặc công ty...',
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

  return date.toLocaleDateString('vi-VN');
}

export default function AdminDashboard() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ users: 0, jobs: 0, pendingJobs: 0, applied: 0 });
  const [users, setUsers] = useState([]);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobActionLoading, setJobActionLoading] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, usersRes, jobsRes] = await Promise.all([
          fetch('/api/admin/stats', { headers }),
          fetch('/api/admin/users', { headers }),
          fetch('/api/admin/jobs/pending', { headers }),
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleJobModeration = async (id, status) => {
    try {
      setJobActionLoading(id);
      const res = await fetch(`/api/admin/jobs/${id}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
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
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gray-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-3 rounded-2xl transition-transform duration-200 hover:scale-[1.01]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-lg font-bold text-transparent">
                AdminPanel
              </p>
              <p className="text-xs text-gray-500">Kiểm soát người dùng và nội dung</p>
            </div>
          </button>

          <div className="hidden flex-1 items-center justify-center lg:flex">
            <div className="flex w-full max-w-xl items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
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

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab(stats.pendingJobs > 0 ? 'jobs' : 'users')}
              className="relative hidden rounded-2xl border border-white/10 bg-white/5 p-3 text-gray-400 transition-colors hover:border-blue-500/20 hover:text-white md:flex"
              title={stats.pendingJobs > 0 ? 'Mở danh sách tin chờ duyệt' : 'Mở danh sách người dùng mới'}
            >
              <Bell className="h-5 w-5" />
              {stats.pendingJobs > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                  {Math.min(stats.pendingJobs, 9)}
                </span>
              )}
            </button>

            <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 sm:flex">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-600 ring-2 ring-white/10">
                  <span className="text-xs font-bold text-white">{getInitials(user?.full_name)}</span>
                </div>
              )}
              <div className="text-left">
                <p className="max-w-[160px] truncate text-sm font-semibold text-gray-100">
                  {user?.full_name || 'System Admin'}
                </p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-blue-300">
                  {user?.role_code || 'admin'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition-all hover:border-red-500/30 hover:bg-red-500/15 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-[1440px] px-4 pb-4 sm:px-6 lg:px-8 lg:hidden">
          <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
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
        <section className="relative overflow-hidden rounded-[28px] border border-blue-500/20 bg-gradient-to-br from-gray-900 via-slate-900 to-[#0c1527] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-52 w-52 rounded-full bg-indigo-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-200">
                Admin Workspace
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Đồng bộ kiểm duyệt và vận hành hệ thống
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
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
                    className={`rounded-2xl border px-4 py-3 text-sm ${item.tone}`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{item.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:min-w-[320px] sm:grid-cols-2">
              <button
                onClick={() => setActiveTab('jobs')}
                className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Hàng chờ</p>
                <p className="mt-2 text-3xl font-bold text-white">{stats.pendingJobs.toLocaleString()}</p>
                <p className="mt-1 text-sm text-amber-200/80">tin đang chờ phê duyệt</p>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-blue-300">Người dùng</p>
                <p className="mt-2 text-3xl font-bold text-white">{stats.users.toLocaleString()}</p>
                <p className="mt-1 text-sm text-blue-200/80">hồ sơ đang hoạt động</p>
              </button>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-72">
            <div className="sticky top-28 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-gray-900/90 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                <p className="mb-4 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                  Điều hướng
                </p>
                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-blue-500/10 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-100'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-blue-500/15 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-5">
                <p className="text-sm font-semibold text-white">Ưu tiên kiểm duyệt</p>
                <p className="mt-2 text-sm leading-6 text-blue-100/75">
                  Hệ thống đang có {stats.pendingJobs.toLocaleString()} tin cần rà soát. Giữ nhịp duyệt
                  đều để luồng tuyển dụng không bị nghẽn.
                </p>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className="mt-4 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
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
                  className={`group relative overflow-hidden rounded-3xl border ${stat.border} bg-gray-900/90 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.25)] transition-transform duration-300 hover:-translate-y-1`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-400">{stat.title}</p>
                      <h3 className="mt-2 text-3xl font-bold tracking-tight text-white">{stat.value}</h3>
                      <p className="mt-2 text-sm text-gray-500">{stat.helper}</p>
                    </div>
                    <div className={`rounded-2xl p-3 ${stat.bg} ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-500">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    Ổn định
                  </div>
                  <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full ${stat.bg} blur-2xl opacity-50 transition-opacity duration-300 group-hover:opacity-100`} />
                </div>
              ))}
            </section>

            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-gray-900/90 p-12 text-center text-gray-400 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                Đang tải dữ liệu quản trị...
              </div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <>
                    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr,1fr]">
                      <div className="rounded-3xl border border-white/10 bg-gray-900/90 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                        <div className="mb-6 flex items-center justify-between gap-4">
                          <div>
                            <h2 className="text-xl font-bold text-white">Người dùng đăng ký gần đây</h2>
                            <p className="mt-1 text-sm text-gray-500">
                              Danh sách cập nhật nhanh để rà soát luồng người dùng mới.
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveTab('users')}
                            className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition-colors hover:bg-blue-500/15"
                          >
                            Xem tất cả
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left">
                            <thead>
                              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-gray-500">
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
                        <div className="rounded-3xl border border-white/10 bg-gray-900/90 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                          <h2 className="text-lg font-bold text-white">Phân bổ vai trò</h2>
                          <p className="mt-1 text-sm text-gray-500">
                            Tỷ trọng hiện tại giữa quản trị, nhà tuyển dụng và ứng viên.
                          </p>

                          <div className="mt-5 space-y-3">
                            {[
                              { label: 'Quản trị', value: adminCount, tone: 'bg-blue-500' },
                              { label: 'Nhà tuyển dụng', value: employerCount, tone: 'bg-amber-500' },
                              { label: 'Ứng viên', value: seekerCount, tone: 'bg-emerald-500' },
                            ].map((item) => {
                              const total = Math.max(users.length, 1);
                              const width = `${Math.max((item.value / total) * 100, item.value > 0 ? 8 : 0)}%`;

                              return (
                                <div key={item.label}>
                                  <div className="mb-2 flex items-center justify-between text-sm">
                                    <span className="text-gray-300">{item.label}</span>
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

                        <div className="rounded-3xl border border-amber-500/15 bg-gradient-to-br from-amber-500/10 to-red-500/5 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                          <h2 className="text-lg font-bold text-white">Điểm nóng kiểm duyệt</h2>
                          <p className="mt-2 text-sm leading-6 text-amber-100/80">
                            {stats.pendingJobs > 0
                              ? `Có ${stats.pendingJobs.toLocaleString()} tin đang chờ xử lý. Ưu tiên duyệt sớm để không làm chậm luồng đăng tuyển.`
                              : 'Hiện không có tin nào trong hàng chờ. Hệ thống đang ở trạng thái ổn định.'}
                          </p>
                          <button
                            onClick={() => setActiveTab('jobs')}
                            className="mt-4 rounded-xl border border-amber-400/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-amber-200 transition-colors hover:bg-white/10"
                          >
                            Kiểm tra danh sách
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-gray-900/90 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                      <div className="mb-6 flex items-center justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-bold text-white">Hàng chờ phê duyệt nổi bật</h2>
                          <p className="mt-1 text-sm text-gray-500">
                            Truy cập nhanh các tin đang đợi xử lý gần nhất.
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab('jobs')}
                          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/15"
                        >
                          Mở tab việc làm
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {pendingPreview.map((job) => (
                          <div
                            key={job.id}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.05]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-lg font-semibold text-white">{job.job_title}</p>
                                <p className="mt-1 text-sm text-gray-400">{job.company_name || 'Chưa có công ty'}</p>
                              </div>
                              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">
                                Chờ duyệt
                              </span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500">
                              <span>{formatDate(job.created_at)}</span>
                              {job.job_address ? <span>{job.job_address}</span> : null}
                            </div>
                          </div>
                        ))}

                        {!pendingPreview.length && (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500 xl:col-span-2">
                            Không còn tin nào trong hàng chờ phù hợp với bộ lọc hiện tại.
                          </div>
                        )}
                      </div>
                    </section>
                  </>
                )}

                {activeTab === 'users' && (
                  <section className="rounded-3xl border border-white/10 bg-gray-900/90 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-white">Danh sách người dùng</h2>
                        <p className="mt-1 text-sm text-gray-500">
                          Theo dõi trạng thái xác thực và phân loại người dùng trong hệ thống.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Tất cả', value: filteredUsers.length, tone: 'border-white/10 bg-white/5 text-gray-200' },
                          { label: 'Admin', value: adminCount, tone: 'border-blue-500/20 bg-blue-500/10 text-blue-300' },
                          { label: 'NTD', value: employerCount, tone: 'border-amber-500/20 bg-amber-500/10 text-amber-300' },
                          { label: 'Đã xác thực', value: verifiedCount, tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' },
                        ].map((item) => (
                          <div key={item.label} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${item.tone}`}>
                            {item.label}: {item.value.toLocaleString()}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse text-left">
                        <thead>
                          <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-gray-500">
                            <th className="pb-3 font-medium">Người dùng</th>
                            <th className="pb-3 font-medium">Vai trò</th>
                            <th className="pb-3 font-medium">Trạng thái</th>
                            <th className="pb-3 font-medium">Ngày tạo</th>
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
                            </tr>
                          ))}

                          {!filteredUsers.length && (
                            <tr>
                              <td colSpan="4" className="py-12 text-center text-sm text-gray-500">
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
                  <section className="rounded-3xl border border-white/10 bg-gray-900/90 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-white">Phê duyệt tin tuyển dụng</h2>
                        <p className="mt-1 text-sm text-gray-500">
                          Xử lý nhanh các tin đang chờ để giữ nhịp vận hành cho nhà tuyển dụng.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        Hàng chờ hiện tại: <span className="font-semibold text-white">{filteredPendingJobs.length.toLocaleString()}</span> tin
                      </div>
                    </div>

                    {filteredPendingJobs.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16 text-center text-gray-500">
                        <Briefcase className="mx-auto mb-4 h-12 w-12 opacity-20" />
                        Không có tin tuyển dụng nào đang chờ duyệt.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] border-collapse text-left">
                          <thead>
                            <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-gray-500">
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
                                    {job.job_address ? (
                                      <p className="mt-1 text-sm text-gray-500">{job.job_address}</p>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-4 text-sm text-gray-400">{job.company_name || 'Chưa có công ty'}</td>
                                <td className="py-4 text-sm text-gray-400">{formatDate(job.created_at)}</td>
                                <td className="py-4">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => handleJobModeration(job.id, 'approved')}
                                      disabled={jobActionLoading === job.id}
                                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-white disabled:opacity-60"
                                    >
                                      {jobActionLoading === job.id ? 'Đang xử lý...' : 'Chấp nhận'}
                                    </button>
                                    <button
                                      onClick={() => handleJobModeration(job.id, 'rejected')}
                                      disabled={jobActionLoading === job.id}
                                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-red-300 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-60"
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

                {activeTab === 'settings' && (
                  <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,1fr]">
                    <div className="rounded-3xl border border-white/10 bg-gray-900/90 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                      <h2 className="text-xl font-bold text-white">Thông tin quản trị</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Tóm tắt tài khoản hiện tại và trạng thái vận hành chung.
                      </p>

                      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                        {user?.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name}
                            className="h-16 w-16 rounded-full object-cover ring-2 ring-white/10"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-600 ring-2 ring-white/10">
                            <span className="text-lg font-bold text-white">{getInitials(user?.full_name)}</span>
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-white">{user?.full_name || 'System Admin'}</p>
                          <p className="truncate text-sm text-gray-400">{user?.email || 'Chưa có email'}</p>
                          <div className="mt-3 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                            {user?.role_code || 'admin'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {[
                          { label: 'Người dùng đã xác thực', value: verifiedCount, icon: UserCheck, tone: 'text-emerald-400 bg-emerald-500/10' },
                          { label: 'Tin chờ xử lý', value: stats.pendingJobs, icon: Clock3, tone: 'text-amber-400 bg-amber-500/10' },
                        ].map((item) => (
                          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center gap-3">
                              <div className={`rounded-2xl p-3 ${item.tone}`}>
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

                    <div className="rounded-3xl border border-white/10 bg-gray-900/90 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                      <h2 className="text-xl font-bold text-white">Nguyên tắc vận hành</h2>
                      <p className="mt-1 text-sm text-gray-500">
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
                            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-gray-300"
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
