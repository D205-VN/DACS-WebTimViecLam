import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Bell, Briefcase, Building2, BookOpen, User, LogOut, Settings, Shield, ChevronDown, Hash, Bookmark, Send, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const timeoutRef = useRef(null);

  const navLinks = [
    { name: 'Tìm việc', to: '/', icon: Briefcase },
    { name: 'Công ty', to: '#', icon: Building2 },
    { name: 'Blog', to: '#', icon: BookOpen },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    navigate('/');
  };

  // Get initials for avatar fallback
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
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
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:text-navy-700 hover:bg-navy-50 transition-all duration-200"
              >
                <link.icon className="w-4 h-4" />
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Right Section */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Notification Bell */}
                <button className="relative p-2 text-gray-500 hover:text-navy-700 hover:bg-navy-50 rounded-lg transition-colors">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
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
                    {/* Avatar */}
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        className="w-9 h-9 rounded-full object-cover ring-2 ring-navy-100"
                      />
                    ) : (
                      <div className="w-9 h-9 bg-gradient-to-br from-navy-500 to-navy-700 rounded-full flex items-center justify-center ring-2 ring-navy-100">
                        <span className="text-white text-xs font-bold">{getInitials(user?.full_name)}</span>
                      </div>
                    )}
                    <div className="text-left hidden lg:block">
                      <p className="text-sm font-semibold text-gray-800 leading-tight max-w-[120px] truncate">{user?.full_name}</p>
                      <p className="text-[11px] text-gray-400 leading-tight">{user?.role_name}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  <div className={`absolute right-0 top-full mt-2 w-72 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 overflow-hidden transition-all duration-200 origin-top-right ${dropdownOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
                    {/* User Info Header */}
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
                      {/* ID Badge */}
                      <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 bg-white/80 rounded-lg w-fit">
                        <Hash className="w-3 h-3 text-navy-400" />
                        <span className="text-[11px] font-mono text-navy-600">ID: {user?.id}</span>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1.5">
                      <Link
                        to="/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-navy-50 hover:text-navy-700 transition-colors"
                      >
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium">Cập nhật thông tin</p>
                          <p className="text-[11px] text-gray-400">Chỉnh sửa hồ sơ cá nhân</p>
                        </div>
                      </Link>

                      <Link
                        to="/change-password"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-navy-50 hover:text-navy-700 transition-colors"
                      >
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                          <Shield className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-medium">Bảo mật</p>
                          <p className="text-[11px] text-gray-400">Đổi mật khẩu tài khoản</p>
                        </div>
                      </Link>

                      <Link
                        to="/saved-jobs"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-navy-50 hover:text-navy-700 transition-colors"
                      >
                        <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                          <Bookmark className="w-4 h-4 text-red-400" />
                        </div>
                        <div>
                          <p className="font-medium">Việc đã lưu</p>
                          <p className="text-[11px] text-gray-400">Xem danh sách đã bookmark</p>
                        </div>
                      </Link>

                      <Link
                        to="/applied-jobs"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-navy-50 hover:text-navy-700 transition-colors"
                      >
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                          <Send className="w-4 h-4 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium">Đã ứng tuyển</p>
                          <p className="text-[11px] text-gray-400">Theo dõi trạng thái</p>
                        </div>
                      </Link>

                      <Link
                        to="/cv-builder"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-navy-50 hover:text-navy-700 transition-colors"
                      >
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium">Tạo CV AI</p>
                          <p className="text-[11px] text-gray-400">CV chuyên nghiệp tự động</p>
                        </div>
                      </Link>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-gray-100 py-1.5">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                          <LogOut className="w-4 h-4 text-red-500" />
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
                  className="px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-800 hover:bg-navy-50 rounded-lg transition-all duration-200"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-navy-600 to-navy-800 rounded-lg hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Đăng ký
                </Link>
              </>
            )}
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
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-600 rounded-lg hover:text-navy-700 hover:bg-navy-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <link.icon className="w-4 h-4" />
              {link.name}
            </Link>
          ))}

          {isAuthenticated ? (
            <div className="pt-3 border-t border-gray-100 space-y-1">
              {/* Mobile User Info */}
              <div className="flex items-center gap-3 px-4 py-3">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-navy-100" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-navy-500 to-navy-700 rounded-full flex items-center justify-center ring-2 ring-navy-100">
                    <span className="text-white text-xs font-bold">{getInitials(user?.full_name)}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-800">{user?.full_name}</p>
                  <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
              </div>
              <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 rounded-lg hover:bg-navy-50">
                <User className="w-4 h-4" /> Cập nhật thông tin
              </Link>
              <Link to="/change-password" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 rounded-lg hover:bg-navy-50">
                <Shield className="w-4 h-4" /> Bảo mật
              </Link>
              <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 rounded-lg hover:bg-red-50">
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-gray-100 flex gap-2">
              <Link to="/login" className="flex-1 text-center px-4 py-2.5 text-sm font-semibold text-navy-700 border border-navy-200 rounded-lg hover:bg-navy-50 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Đăng nhập
              </Link>
              <Link to="/register" className="flex-1 text-center px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-navy-600 to-navy-800 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
