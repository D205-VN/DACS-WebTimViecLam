import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Bookmark,
  Briefcase,
  Building2,
  ChevronDown,
  FileText,
  Hash,
  Loader2,
  LogOut,
  Menu,
  Send,
  Shield,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  {
    name: 'Tìm việc',
    to: '/',
    icon: Briefcase,
    match: (pathname) =>
      pathname === '/' ||
      pathname.startsWith('/jobs') ||
      pathname.startsWith('/saved-jobs') ||
      pathname.startsWith('/applied-jobs'),
  },
  {
    name: 'Công ty',
    to: '/companies',
    icon: Building2,
    match: (pathname) => pathname.startsWith('/companies'),
  },
  {
    name: 'Blog',
    to: '/blog',
    icon: BookOpen,
    match: (pathname) => pathname.startsWith('/blog'),
  },
];

const userMenuLinks = [
  {
    to: '/profile',
    label: 'Cập nhật thông tin',
    description: 'Chỉnh sửa hồ sơ cá nhân',
    icon: User,
    iconClass: 'bg-blue-50 text-blue-500',
    match: (pathname) => pathname.startsWith('/profile'),
  },
  {
    to: '/change-password',
    label: 'Bảo mật',
    description: 'Đổi mật khẩu tài khoản',
    icon: Shield,
    iconClass: 'bg-amber-50 text-amber-500',
    match: (pathname) => pathname.startsWith('/change-password'),
  },
  {
    to: '/saved-jobs',
    label: 'Việc đã lưu',
    description: 'Xem danh sách đã bookmark',
    icon: Bookmark,
    iconClass: 'bg-red-50 text-red-400',
    match: (pathname) => pathname.startsWith('/saved-jobs'),
  },
  {
    to: '/applied-jobs',
    label: 'Đã ứng tuyển',
    description: 'Theo dõi trạng thái',
    icon: Send,
    iconClass: 'bg-green-50 text-green-500',
    match: (pathname) => pathname.startsWith('/applied-jobs'),
  },
  {
    to: '/seeker/cv-builder',
    label: 'Tạo CV AI',
    description: 'CV chuyên nghiệp tự động',
    icon: Sparkles,
    iconClass: 'bg-fuchsia-50 text-fuchsia-500',
    match: (pathname) => pathname.startsWith('/seeker/cv-builder'),
  },
  {
    to: '/seeker/my-cvs',
    label: 'Quản lý hồ sơ CV',
    description: 'Xem, tải và import CV',
    icon: FileText,
    iconClass: 'bg-indigo-50 text-indigo-500',
    match: (pathname) => pathname.startsWith('/seeker/my-cvs') || pathname.startsWith('/seeker/cv-import'),
  },
];

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((word) => word[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

const applicationStatusLabels = {
  pending: 'Đang chờ phản hồi',
  viewed: 'Nhà tuyển dụng đã xem',
  invited: 'Được mời phỏng vấn',
  rejected: 'Hồ sơ chưa phù hợp',
};

function formatNotificationTime(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function sortNotificationsByTime(items) {
  return [...items].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
}

function getTopNavClass(isActive) {
  return `flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-navy-50 text-navy-700 shadow-sm'
      : 'text-gray-600 hover:bg-navy-50 hover:text-navy-700'
  }`;
}

function getMenuItemClass(isActive) {
  return `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
    isActive
      ? 'bg-navy-50 text-navy-700'
      : 'text-gray-700 hover:bg-navy-50 hover:text-navy-700'
  }`;
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState(null);
  const { user, token, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
  const timeoutRef = useRef(null);
  const notificationItems = notifications || [];
  const actionableNotificationCount = notificationItems.filter((item) => !['empty-state', 'fallback'].includes(item.id)).length;
  const notificationsLoading = Boolean(token) && notifications === null;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }

      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    Promise.all([
      fetch('/api/jobs/applied', { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.ok ? res.json() : { data: [] }),
      fetch('/api/jobs/saved', { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.ok ? res.json() : { data: [] }),
      fetch('/api/cv/my-cvs', { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.ok ? res.json() : { cvs: [] }),
    ])
      .then(([appliedPayload, savedPayload, cvPayload]) => {
        if (cancelled) return;

        const appliedJobs = appliedPayload?.data || [];
        const savedJobs = savedPayload?.data || [];
        const savedCVs = cvPayload?.cvs || [];
        const nextNotifications = sortNotificationsByTime([
          ...appliedJobs.map((job) => ({
            id: `applied-${job.id}-${job.applied_at}`,
            title: `Đã ứng tuyển: ${job.title || 'Tin tuyển dụng'}`,
            description: [job.company_name, applicationStatusLabels[job.status] || 'Đã gửi hồ sơ']
              .filter(Boolean)
              .join(' • '),
            to: '/applied-jobs',
            icon: Send,
            iconClass: 'bg-green-50 text-green-500',
            timestamp: job.applied_at,
          })),
          ...savedJobs.map((job) => ({
            id: `saved-${job.id}-${job.saved_at}`,
            title: `Đã lưu: ${job.title || 'Việc làm quan tâm'}`,
            description: job.company_name || 'Bạn có thể quay lại ứng tuyển bất cứ lúc nào',
            to: '/saved-jobs',
            icon: Bookmark,
            iconClass: 'bg-red-50 text-red-500',
            timestamp: job.saved_at,
          })),
          ...savedCVs.map((cv) => ({
            id: `cv-${cv.id}-${cv.created_at}`,
            title: `Đã lưu CV: ${cv.title || 'Hồ sơ CV'}`,
            description: cv.target_role || 'CV của bạn đã được lưu vào thư viện hồ sơ',
            to: '/seeker/my-cvs',
            icon: FileText,
            iconClass: 'bg-indigo-50 text-indigo-500',
            timestamp: cv.created_at,
          })),
        ]).slice(0, 6);

        if (nextNotifications.length === 0) {
          nextNotifications.push({
            id: 'empty-state',
            title: 'Hoàn thiện CV để tăng tốc ứng tuyển',
            description: 'Tạo CV AI và lưu hồ sơ để ứng tuyển nhanh hơn.',
            to: '/seeker/cv-builder',
            icon: Sparkles,
            iconClass: 'bg-fuchsia-50 text-fuchsia-500',
            timestamp: null,
          });
        }

        setNotifications(nextNotifications);
      })
      .catch(() => {
        if (!cancelled) {
          setNotifications([
            {
              id: 'fallback',
              title: 'Không tải được thông báo',
              description: 'Bạn vẫn có thể xem Việc đã lưu, Đã ứng tuyển và hồ sơ CV trong menu.',
              to: '/saved-jobs',
              icon: Bell,
              iconClass: 'bg-amber-50 text-amber-500',
              timestamp: null,
            },
          ]);
        }
      })
      .finally(() => {
        if (cancelled) return;
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setDropdownOpen(false), 200);
  };

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    setNotificationOpen(false);
    setNotifications([]);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-navy-600 to-navy-800 shadow-lg shadow-navy-700/20">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-navy-700">Aptertek</span>
              <span className="text-success-500">Work</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const isActive = link.match(location.pathname);

              return (
                <Link key={link.name} to={link.to} className={getTopNavClass(isActive)}>
                  <link.icon className="h-4 w-4" />
                  {link.name}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <>
                <div ref={notificationRef} className="relative">
                  <button
                    onClick={() => {
                      setNotificationOpen((prev) => !prev);
                      setDropdownOpen(false);
                    }}
                    className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-navy-50 hover:text-navy-700"
                  >
                    <Bell className="h-5 w-5" />
                    {actionableNotificationCount > 0 ? (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {Math.min(actionableNotificationCount, 9)}
                      </span>
                    ) : null}
                  </button>

                  <div
                    className={`absolute right-0 top-full mt-2 w-80 origin-top-right overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/50 transition-all duration-200 ${
                      notificationOpen ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Thông báo</p>
                        <p className="text-xs text-gray-500">Cập nhật nhanh cho tài khoản của bạn</p>
                      </div>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto py-2">
                      {notificationsLoading ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Đang tải thông báo...
                        </div>
                      ) : (
                        notificationItems.map((item) => (
                          <Link
                            key={item.id}
                            to={item.to}
                            onClick={() => setNotificationOpen(false)}
                            className="flex gap-3 px-4 py-3 transition-colors hover:bg-navy-50"
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconClass}`}>
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                                <span className="shrink-0 text-[11px] text-gray-400">{formatNotificationTime(item.timestamp)}</span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-gray-500">{item.description}</p>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div
                  ref={dropdownRef}
                  className="relative"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    onClick={() => {
                      setDropdownOpen((prev) => !prev);
                      setNotificationOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-gray-50"
                  >
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        className="h-9 w-9 rounded-full object-cover ring-2 ring-navy-100"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 ring-2 ring-navy-100">
                        <span className="text-xs font-bold text-white">{getInitials(user?.full_name)}</span>
                      </div>
                    )}
                    <div className="hidden text-left lg:block">
                      <p className="max-w-[120px] truncate text-sm font-semibold leading-tight text-gray-800">
                        {user?.full_name}
                      </p>
                      <p className="text-[11px] leading-tight text-gray-400">{user?.role_name}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <div
                    className={`absolute right-0 top-full mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/50 transition-all duration-200 ${
                      dropdownOpen ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
                    }`}
                  >
                    <div className="border-b border-gray-100 bg-gradient-to-r from-navy-50 to-gray-50 px-4 py-4">
                      <div className="flex items-center gap-3">
                        {user?.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name}
                            className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-sm"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 ring-2 ring-white shadow-sm">
                            <span className="text-sm font-bold text-white">{getInitials(user?.full_name)}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-gray-800">{user?.full_name}</p>
                          <p className="truncate text-xs text-gray-500">{user?.email}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex w-fit items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1">
                        <Hash className="h-3 w-3 text-navy-400" />
                        <span className="font-mono text-[11px] text-navy-600">ID: {user?.id}</span>
                      </div>
                    </div>

                    <div className="py-1.5">
                      {userMenuLinks.map((link) => {
                        const isActive = link.match(location.pathname);

                        return (
                          <Link
                            key={link.to}
                            to={link.to}
                            onClick={() => setDropdownOpen(false)}
                            className={getMenuItemClass(isActive)}
                          >
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-navy-100 text-navy-700' : link.iconClass}`}>
                              <link.icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">{link.label}</p>
                              <p className="text-[11px] text-gray-400">{link.description}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>

                    <div className="border-t border-gray-100 py-1.5">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                          <LogOut className="h-4 w-4 text-red-500" />
                        </div>
                        <p className="font-medium">Đăng xuất</p>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-navy-700 transition-all duration-200 hover:bg-navy-50 hover:text-navy-800"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-gradient-to-r from-navy-600 to-navy-800 px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-navy-700/25"
                >
                  Đăng ký
                </Link>
              </>
            )}
          </div>

          <button
            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-navy-50 hover:text-navy-700 md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${mobileMenuOpen ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-1 border-t border-gray-50 bg-white px-4 pb-4 pt-2">
          {navLinks.map((link) => {
            const isActive = link.match(location.pathname);

            return (
              <Link
                key={link.name}
                to={link.to}
                className={getTopNavClass(isActive)}
                onClick={() => setMobileMenuOpen(false)}
              >
                <link.icon className="h-4 w-4" />
                {link.name}
              </Link>
            );
          })}

          {isAuthenticated ? (
            <div className="space-y-1 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-3 px-4 py-3">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-navy-100" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 ring-2 ring-navy-100">
                    <span className="text-xs font-bold text-white">{getInitials(user?.full_name)}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-800">{user?.full_name}</p>
                  <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Bell className="h-4 w-4 text-navy-600" />
                  Thông báo gần đây
                </div>
                <div className="mt-3 space-y-3">
                  {(notificationItems.slice(0, 2)).map((item) => (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-xl bg-white px-3 py-2.5"
                    >
                      <p className="text-sm font-medium text-gray-800">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">{item.description}</p>
                      {item.timestamp ? (
                        <p className="mt-1 text-[11px] text-gray-400">{formatNotificationTime(item.timestamp)}</p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>

              {userMenuLinks.map((link) => {
                const isActive = link.match(location.pathname);

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={getMenuItemClass(isActive)}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-navy-100 text-navy-700' : link.iconClass}`}>
                      <link.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{link.label}</p>
                      <p className="text-[11px] text-gray-400">{link.description}</p>
                    </div>
                  </Link>
                );
              })}

              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Đăng xuất
              </button>
            </div>
          ) : (
            <div className="flex gap-2 border-t border-gray-100 pt-3">
              <Link
                to="/login"
                className="flex-1 rounded-lg border border-navy-200 px-4 py-2.5 text-center text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="flex-1 rounded-lg bg-gradient-to-r from-navy-600 to-navy-800 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
