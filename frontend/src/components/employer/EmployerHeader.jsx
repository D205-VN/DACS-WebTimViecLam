import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, Building2, Plus, Bell, LogOut, ChevronDown, Shield, Menu, X } from 'lucide-react';
import { useAuth } from '@components/providers/AuthContext';
import { useNotifications } from '@components/providers/NotificationContext';
import { getRouteByRole } from '@services/navigation/roleRedirect';
import {
  getEmployerDashboardPath,
  getEmployerDashboardState,
  getEmployerDashboardTab,
} from '@services/employer/dashboardRoutes';
import UserAvatar from '@components/ui/UserAvatar';
import { employerNavItems } from '@components/employer/employerNavigation';

export default function EmployerHeader() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);
  const timeoutRef = useRef(null);

  const navLinks = employerNavItems.map((item) => ({
    name: item.label,
    tab: item.key,
    icon: item.icon,
  }));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = () => { clearTimeout(timeoutRef.current); setDropdownOpen(true); };
  const handleMouseLeave = () => { timeoutRef.current = setTimeout(() => setDropdownOpen(false), 200); };

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/');
  };

  const isHeaderLinkActive = (link) => {
    if (link.tab === 'messages') {
      return location.pathname.startsWith('/employer/messages');
    }

    if (link.tab === 'ai-tests' && location.pathname.startsWith('/employer/ai-tests/')) {
      return true;
    }

    return location.pathname === '/employer/dashboard' && getEmployerDashboardTab(location) === link.tab;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-indigo-100/50 bg-white/80 backdrop-blur-xl shadow-sm shadow-indigo-50">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/employer/dashboard" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-200/60 transition-transform duration-300 group-hover:scale-105">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">Aptertek</span>
              <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">Work</span>
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.filter(l => ['dashboard', 'jobs', 'candidates', 'messages'].includes(l.tab)).map((link) => (
              <button
                key={link.tab}
                onClick={() => navigate(getEmployerDashboardPath(link.tab), { state: getEmployerDashboardState(link.tab) })}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isHeaderLinkActive(link)
                    ? 'text-indigo-700 bg-indigo-50/70 font-semibold'
                    : 'text-gray-500 hover:text-indigo-700 hover:bg-indigo-50/40'
                }`}
              >
                {link.name}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => navigate('/employer/post-job')}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-200/60 transition-all duration-300 hover:shadow-xl hover:from-indigo-700 hover:to-violet-700 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              Đăng tin
            </button>
            {/* Notification Bell */}
            <button
              onClick={() => navigate(getEmployerDashboardPath('notifications'), { state: getEmployerDashboardState('notifications') })}
              className="relative rounded-xl p-2.5 text-gray-400 transition-all duration-200 hover:bg-indigo-50/80 hover:text-indigo-600"
              title="Mở thông báo tuyển dụng"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[10px] font-bold text-white animate-pulse shadow-sm shadow-rose-200">
                  {Math.min(unreadCount, 9)}
                </span>
              )}
            </button>

            {/* User Avatar + Dropdown */}
            <div
              ref={dropdownRef}
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-200 hover:bg-indigo-50/60"
              >
                <UserAvatar
                  src={user?.avatar_url}
                  alt={user?.full_name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-violet-200 shadow-sm"
                  fallbackClassName="flex w-9 h-9 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 ring-2 ring-violet-200 shadow-sm"
                  iconClassName="h-4 w-4 text-white"
                />
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-semibold text-gray-800 leading-tight max-w-[120px] truncate">{user?.full_name || 'Employer'}</p>
                  <p className="text-[11px] text-gray-400 leading-tight">{user?.company_name || 'Nhà tuyển dụng'}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`absolute right-0 top-full mt-2.5 w-72 origin-top-right overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/95 backdrop-blur-xl shadow-2xl shadow-indigo-100/40 transition-all duration-300 ${dropdownOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
                {/* Gradient top accent */}
                <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"></div>

                <div className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={user?.avatar_url}
                      alt={user?.full_name}
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-md"
                      fallbackClassName="flex w-12 h-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 ring-2 ring-white shadow-md"
                      iconClassName="h-5 w-5 text-white"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{user?.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      <p className="text-[10px] text-indigo-500 font-semibold mt-0.5">{user?.company_name || 'Nhà tuyển dụng'}</p>
                    </div>
                  </div>
                </div>

                <div className="py-2 px-2">
                  <Link to={getEmployerDashboardPath('company')} state={getEmployerDashboardState('company')} onClick={() => setDropdownOpen(false)} className="flex items-center gap-3 px-3 py-3 text-sm text-gray-700 hover:bg-indigo-50/60 hover:text-indigo-700 transition-all duration-200 rounded-xl">
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shadow-sm">
                      <Building2 className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-semibold">Hồ sơ công ty</p>
                      <p className="text-[11px] text-gray-400">Chỉnh sửa thông tin</p>
                    </div>
                  </Link>

                  <Link to={getRouteByRole(user?.role_code, 'changePassword')} onClick={() => setDropdownOpen(false)} className="flex items-center gap-3 px-3 py-3 text-sm text-gray-700 hover:bg-indigo-50/60 hover:text-indigo-700 transition-all duration-200 rounded-xl">
                    <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center shadow-sm">
                      <Shield className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-semibold">Bảo mật</p>
                      <p className="text-[11px] text-gray-400">Đổi mật khẩu tài khoản</p>
                    </div>
                  </Link>

                </div>

                <div className="border-t border-gray-100 py-2 px-2">
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-3 text-sm text-red-600 hover:bg-red-50/80 transition-colors rounded-xl">
                    <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center shadow-sm">
                      <LogOut className="w-4 h-4 text-red-500" />
                    </div>
                    <p className="font-semibold">Đăng xuất</p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            className="rounded-xl p-2 text-gray-600 transition-colors hover:bg-indigo-50/50 hover:text-indigo-700 md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 pt-2 space-y-1 bg-white border-t border-indigo-50">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={getEmployerDashboardPath(link.tab)}
              state={getEmployerDashboardState(link.tab)}
              className={`flex items-center gap-2.5 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                isHeaderLinkActive(link) ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 shadow-sm shadow-indigo-100/50' : 'text-gray-600 hover:bg-indigo-50/50 hover:text-indigo-700'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="flex items-center gap-2.5">
                <link.icon className="w-4 h-4" />
                {link.name}
              </span>
              {link.tab === 'notifications' && unreadCount > 0 ? (
                <span className="ml-auto rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {Math.min(unreadCount, 9)}
                </span>
              ) : null}
            </Link>
          ))}
          <button
            onClick={() => { navigate('/employer/post-job'); setMobileMenuOpen(false); }}
            className="flex w-full items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200"
          >
            <Plus className="w-4 h-4" /> Đăng tin mới
          </button>
          <div className="pt-3 border-t border-gray-100">
            <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 rounded-xl hover:bg-red-50">
              <LogOut className="w-4 h-4" /> Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
