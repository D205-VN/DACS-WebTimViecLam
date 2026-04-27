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
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Send,
  Shield,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import { useNotifications } from '@features/notifications/NotificationContext';
import { getRouteByRole } from '@shared/utils/roleRedirect';
import UserAvatar from '@shared/ui/UserAvatar';

function getNavLinks(roleCode) {
  return [
    {
      name: 'Tìm việc',
      to: getRouteByRole(roleCode, 'home'),
      icon: Briefcase,
      match: (pathname) =>
        pathname === '/' ||
        pathname === '/seeker/home' ||
        pathname.startsWith('/jobs') ||
        pathname.startsWith('/seeker/jobs') ||
        pathname.startsWith('/saved-jobs') ||
        pathname.startsWith('/applied-jobs') ||
        pathname.startsWith('/seeker/saved-jobs') ||
        pathname.startsWith('/seeker/applied-jobs'),
    },
    {
      name: 'Công ty',
      to: getRouteByRole(roleCode, 'companies'),
      icon: Building2,
      match: (pathname) => pathname.startsWith('/companies') || pathname.startsWith('/seeker/companies'),
    },
    {
      name: 'Blog',
      to: getRouteByRole(roleCode, 'blog'),
      icon: BookOpen,
      match: (pathname) => pathname.startsWith('/blog') || pathname.startsWith('/seeker/blog'),
    },
  ];
}

function getUserMenuLinks(roleCode) {
  if (roleCode === 'admin') {
    return [
      {
        to: '/admin/dashboard',
        label: 'Bảng điều khiển',
        description: 'Quản trị hệ thống',
        icon: LayoutDashboard,
        iconClass: 'bg-blue-50 text-blue-500',
        match: (pathname) => pathname.startsWith('/admin'),
      },
      {
        to: getRouteByRole(roleCode, 'changePassword'),
        label: 'Bảo mật',
        description: 'Đổi mật khẩu tài khoản',
        icon: Shield,
        iconClass: 'bg-amber-50 text-amber-500',
        match: (pathname) => pathname.startsWith('/change-password') || pathname.startsWith('/admin/change-password'),
      },
    ];
  }

  if (roleCode === 'employer') {
    return [
      {
        to: '/employer/dashboard',
        state: { activeTab: 'dashboard' },
        label: 'Bảng điều khiển',
        description: 'Quản lý tuyển dụng',
        icon: LayoutDashboard,
        iconClass: 'bg-blue-50 text-blue-500',
        match: (pathname) => pathname.startsWith('/employer/dashboard'),
      },
      {
        to: '/employer/post-job',
        label: 'Đăng tin tuyển dụng',
        description: 'Tạo tin tuyển dụng mới',
        icon: Plus,
        iconClass: 'bg-emerald-50 text-emerald-500',
        match: (pathname) => pathname.startsWith('/employer/post-job'),
      },
      {
        to: getRouteByRole(roleCode, 'changePassword'),
        label: 'Bảo mật',
        description: 'Đổi mật khẩu tài khoản',
        icon: Shield,
        iconClass: 'bg-amber-50 text-amber-500',
        match: (pathname) => pathname.startsWith('/change-password') || pathname.startsWith('/employer/change-password'),
      },
    ];
  }

  return [
    {
      to: getRouteByRole(roleCode, 'profile'),
      label: 'Cập nhật thông tin',
      description: 'Chỉnh sửa hồ sơ cá nhân',
      icon: User,
      iconClass: 'bg-blue-50 text-blue-500',
      match: (pathname) => pathname.startsWith('/profile') || pathname.startsWith('/seeker/profile'),
    },
    {
      to: getRouteByRole(roleCode, 'changePassword'),
      label: 'Bảo mật',
      description: 'Đổi mật khẩu tài khoản',
      icon: Shield,
      iconClass: 'bg-amber-50 text-amber-500',
      match: (pathname) => pathname.startsWith('/change-password') || pathname.startsWith('/seeker/change-password'),
    },
    {
      to: getRouteByRole(roleCode, 'savedJobs'),
      label: 'Việc đã lưu',
      description: 'Xem danh sách đã bookmark',
      icon: Bookmark,
      iconClass: 'bg-red-50 text-red-400',
      match: (pathname) => pathname.startsWith('/saved-jobs') || pathname.startsWith('/seeker/saved-jobs'),
    },
    {
      to: getRouteByRole(roleCode, 'appliedJobs'),
      label: 'Đã ứng tuyển',
      description: 'Theo dõi trạng thái',
      icon: Send,
      iconClass: 'bg-green-50 text-green-500',
      match: (pathname) => pathname.startsWith('/applied-jobs') || pathname.startsWith('/seeker/applied-jobs'),
    },
    {
      to: getRouteByRole(roleCode, 'cvBuilder'),
      label: 'Tạo CV AI',
      description: 'CV chuyên nghiệp tự động',
      icon: Sparkles,
      iconClass: 'bg-fuchsia-50 text-fuchsia-500',
      match: (pathname) => pathname.startsWith('/seeker/cv-builder'),
    },
    {
      to: getRouteByRole(roleCode, 'myCvs'),
      label: 'Quản lý hồ sơ CV',
      description: 'Xem, tải và import CV',
      icon: FileText,
      iconClass: 'bg-indigo-50 text-indigo-500',
      match: (pathname) => pathname.startsWith('/seeker/my-cvs') || pathname.startsWith('/seeker/cv-import'),
    },
  ];
}

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

function getNotificationPanelMeta(roleCode) {
  switch (roleCode) {
    case 'admin':
      return {
        title: 'Thông báo quản trị',
        subtitle: 'Tin chờ duyệt và hoạt động người dùng gần đây',
      };
    case 'employer':
      return {
        title: 'Thông báo tuyển dụng',
        subtitle: 'Tin chờ duyệt, bị từ chối và ứng viên mới',
      };
    default:
      return {
        title: 'Thông báo',
        subtitle: 'Cập nhật nhanh cho tài khoản của bạn',
      };
  }
}

function getEmptyNotification(roleCode) {
  switch (roleCode) {
    case 'admin':
      return {
        id: 'empty-state',
        title: 'Hệ thống đang ổn định',
        description: 'Hiện chưa có tin chờ duyệt hoặc biến động mới cần xử lý ngay.',
        to: '/admin/dashboard',
        state: { activeTab: 'overview' },
        icon: Shield,
        iconClass: 'bg-blue-50 text-blue-500',
        timestamp: null,
      };
    case 'employer':
      return {
        id: 'empty-state',
        title: 'Chưa có thông báo tuyển dụng mới',
        description: 'Khi có ứng viên mới hoặc tin cần admin xử lý, bạn sẽ thấy tại đây.',
        to: '/employer/dashboard',
        state: { activeTab: 'notifications' },
        icon: Bell,
        iconClass: 'bg-amber-50 text-amber-500',
        timestamp: null,
      };
    default:
      return {
        id: 'empty-state',
        title: 'Hoàn thiện CV để tăng tốc ứng tuyển',
        description: 'Tạo CV AI và lưu hồ sơ để ứng tuyển nhanh hơn.',
        to: getRouteByRole(roleCode, 'cvBuilder'),
        icon: Sparkles,
        iconClass: 'bg-fuchsia-50 text-fuchsia-500',
        timestamp: null,
      };
  }
}

function getNotificationTypeMeta(type) {
  switch (type) {
    case 'admin_job_pending':
      return { icon: Briefcase, iconClass: 'bg-amber-50 text-amber-500' };
    case 'employer_new_candidate':
      return { icon: Send, iconClass: 'bg-emerald-50 text-emerald-500' };
    case 'employer_job_approved':
      return { icon: Briefcase, iconClass: 'bg-emerald-50 text-emerald-500' };
    case 'employer_job_rejected':
      return { icon: Bell, iconClass: 'bg-red-50 text-red-500' };
    case 'seeker_application_interview':
      return { icon: Bell, iconClass: 'bg-blue-50 text-blue-500' };
    case 'seeker_application_hired':
      return { icon: Send, iconClass: 'bg-emerald-50 text-emerald-500' };
    case 'seeker_application_rejected':
      return { icon: Bell, iconClass: 'bg-red-50 text-red-500' };
    default:
      return { icon: Bell, iconClass: 'bg-blue-50 text-blue-500' };
  }
}

function getDefaultNotificationDestination(roleCode) {
  if (roleCode === 'admin') return '/admin/dashboard';
  if (roleCode === 'employer') return '/employer/dashboard';
  return getRouteByRole(roleCode, 'appliedJobs');
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
  const { user, isAuthenticated, logout } = useAuth();
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
  const timeoutRef = useRef(null);

  // Format notifications for the UI
  const notificationItems = notifications.length > 0 
    ? notifications.map(item => {
        const typeMeta = getNotificationTypeMeta(item.type);
        return {
          id: item.id,
          title: item.title,
          description: item.message,
          to: item.to || getDefaultNotificationDestination(user?.role_code),
          state: item.tab ? { activeTab: item.tab } : undefined,
          icon: typeMeta.icon,
          iconClass: typeMeta.iconClass,
          timestamp: item.created_at,
          read: item.read,
        };
      }).slice(0, 10)
    : [getEmptyNotification(user?.role_code)];

  const notificationsLoading = false; // Handled by context
  const notificationPanelMeta = getNotificationPanelMeta(user?.role_code);
  const navLinks = getNavLinks(user?.role_code);
  const userMenuLinks = getUserMenuLinks(user?.role_code);
  const homeRoute = getRouteByRole(user?.role_code, 'home');

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

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

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
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to={homeRoute} className="flex shrink-0 items-center gap-2">
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
                      const nextOpen = !notificationOpen;
                      setNotificationOpen(nextOpen);
                      setDropdownOpen(false);
                      if (nextOpen) {
                        handleMarkAllRead();
                      }
                    }}
                    className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-navy-50 hover:text-navy-700"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 ? (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {Math.min(unreadCount, 99)}
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
                        <p className="text-sm font-bold text-gray-800">{notificationPanelMeta.title}</p>
                        <p className="text-xs text-gray-500">{notificationPanelMeta.subtitle}</p>
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
                            state={item.state}
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
                    <UserAvatar
                      src={user?.avatar_url}
                      alt={user?.full_name}
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-navy-100"
                      fallbackClassName="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 ring-2 ring-navy-100"
                      iconClassName="h-4 w-4 text-white"
                    />
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
                        <UserAvatar
                          src={user?.avatar_url}
                          alt={user?.full_name}
                          className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-sm"
                          fallbackClassName="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 ring-2 ring-white shadow-sm"
                          iconClassName="h-5 w-5 text-white"
                        />
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
                            state={link.state}
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
                <UserAvatar
                  src={user?.avatar_url}
                  alt={user?.full_name}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-navy-100"
                  fallbackClassName="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 ring-2 ring-navy-100"
                  iconClassName="h-4 w-4 text-white"
                />
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
                      state={item.state}
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
                    state={link.state}
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
