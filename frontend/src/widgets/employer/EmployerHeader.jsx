import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, LayoutDashboard, FileText, Users, Building2, Plus, Bell, LogOut, ChevronDown, User, Shield, Menu, X } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import { useNotifications } from '@features/notifications/NotificationContext';
import { getRouteByRole } from '@shared/utils/roleRedirect';
import API_BASE_URL from '@shared/api/baseUrl';

export default function EmployerHeader() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, token, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);
  const timeoutRef = useRef(null);

  const navLinks = [
    { name: 'Bảng điều khiển', to: '/employer/dashboard', tab: 'dashboard', icon: LayoutDashboard },
    { name: 'Quản lý tin đăng', to: '/employer/dashboard', tab: 'jobs', icon: FileText },
    { name: 'Quản lý ứng viên', to: '/employer/dashboard', tab: 'candidates', icon: Users },
    { name: 'Hồ sơ công ty', to: '/employer/dashboard', tab: 'company', icon: Building2 },
  ];

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
    setNotificationCount(0);
    navigate('/');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/employer/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-navy-600 to-navy-800 rounded-xl flex items-center justify-center shadow-lg shadow-navy-700/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-navy-700">Aptertek</span>
              <span className="text-success-500">Work</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.to}
                state={{ activeTab: link.tab }}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive(link.to) && location.state?.activeTab === link.tab
                    ? 'text-navy-700 bg-navy-50 font-semibold'
                    : 'text-gray-600 hover:text-navy-700 hover:bg-navy-50'
                }`}
              >
                <link.icon className="w-4 h-4" />
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Right Section */}
          <div className="hidden md:flex items-center gap-3">
            {/* Post Job Button */}
            <button
              onClick={() => navigate('/employer/post-job')}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-navy-600 to-navy-800 rounded-lg hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              Đăng tin mới
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => navigate('/employer/dashboard', { state: { activeTab: 'notifications' } })}
              className="relative p-2 text-gray-500 hover:text-navy-700 hover:bg-navy-50 rounded-lg transition-colors"
              title="Mở thông báo tuyển dụng"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
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
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer"
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-9 h-9 rounded-full object-cover ring-2 ring-navy-100" />
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-navy-500 to-navy-700 rounded-full flex items-center justify-center ring-2 ring-navy-100">
                    <span className="text-white text-xs font-bold">{getInitials(user?.full_name)}</span>
                  </div>
                )}
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-semibold text-gray-800 leading-tight max-w-[120px] truncate">{user?.full_name || 'Employer'}</p>
                  <p className="text-[11px] text-gray-400 leading-tight">{user?.company_name || 'Nhà tuyển dụng'}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              <div className={`absolute right-0 top-full mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 overflow-hidden transition-all duration-200 origin-top-right ${dropdownOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
                <div className="px-4 py-4 bg-gradient-to-r from-navy-50 to-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-sm" />
                    ) : (
                      <div className="w-11 h-11 bg-gradient-to-br from-navy-500 to-navy-700 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm">
                        <span className="text-white text-sm font-bold">{getInitials(user?.full_name)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{user?.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>

                <div className="py-1.5">
                  <Link to="/employer/dashboard" state={{ activeTab: 'company' }} onClick={() => setDropdownOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-navy-50 hover:text-navy-700 transition-colors">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">Hồ sơ công ty</p>
                      <p className="text-[11px] text-gray-400">Chỉnh sửa thông tin</p>
                    </div>
                  </Link>

                  <Link to={getRouteByRole(user?.role_code, 'changePassword')} onClick={() => setDropdownOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-navy-50 hover:text-navy-700 transition-colors">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Shield className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium">Bảo mật</p>
                      <p className="text-[11px] text-gray-400">Đổi mật khẩu tài khoản</p>
                    </div>
                  </Link>

                </div>

                <div className="border-t border-gray-100 py-1.5">
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                      <LogOut className="w-4 h-4 text-red-500" />
                    </div>
                    <p className="font-medium">Đăng xuất</p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-navy-700 hover:bg-navy-50 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 pt-2 space-y-1 bg-white border-t border-gray-50">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.to}
              state={{ activeTab: link.tab }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive(link.to) && location.state?.activeTab === link.tab ? 'text-navy-700 bg-navy-50' : 'text-gray-600 hover:text-navy-700 hover:bg-navy-50'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <link.icon className="w-4 h-4" />
              {link.name}
            </Link>
          ))}
          <button
            onClick={() => { navigate('/employer/post-job'); setMobileMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-navy-600 to-navy-800 rounded-lg"
          >
            <Plus className="w-4 h-4" /> Đăng tin mới
          </button>
          <button
            onClick={() => { navigate('/employer/dashboard', { state: { activeTab: 'notifications' } }); setMobileMenuOpen(false); }}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-gray-600 rounded-lg hover:text-navy-700 hover:bg-navy-50"
          >
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Thông báo
            </span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {Math.min(unreadCount, 9)}
              </span>
            )}
          </button>
          <div className="pt-3 border-t border-gray-100">
            <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 rounded-lg hover:bg-red-50">
              <LogOut className="w-4 h-4" /> Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
