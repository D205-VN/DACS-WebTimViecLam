import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Search, Bell, ChevronDown, Briefcase, Building2, BookOpen, User } from 'lucide-react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn] = useState(false);

  const navLinks = [
    { name: 'Tìm việc', to: '/', icon: Briefcase },
    { name: 'Công ty', to: '#', icon: Building2 },
    { name: 'Blog', to: '#', icon: BookOpen },
  ];

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
            {isLoggedIn ? (
              <>
                <button className="relative p-2 text-gray-500 hover:text-navy-700 hover:bg-navy-50 rounded-lg transition-colors">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <div className="w-8 h-8 bg-gradient-to-br from-navy-500 to-navy-700 rounded-full flex items-center justify-center cursor-pointer ring-2 ring-navy-100">
                  <User className="w-4 h-4 text-white" />
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
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
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
          <div className="pt-3 border-t border-gray-100 flex gap-2">
            <Link
              to="/login"
              className="flex-1 text-center px-4 py-2.5 text-sm font-semibold text-navy-700 border border-navy-200 rounded-lg hover:bg-navy-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Đăng nhập
            </Link>
            <Link
              to="/register"
              className="flex-1 text-center px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-navy-600 to-navy-800 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Đăng ký
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
