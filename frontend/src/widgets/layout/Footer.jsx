import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Mail, MapPin, Phone } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import { getRouteByRole } from '@shared/utils/roleRedirect';

function FooterLink({ to, label }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">
      <span>{label}</span>
      <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
  );
}

export default function Footer() {
  const { user } = useAuth();
  const employerLinks = [
    { label: 'Bảng điều khiển NTD', to: '/employer/dashboard' },
    { label: 'Đăng tin tuyển dụng', to: '/employer/post-job' },
    { label: 'Danh sách công ty', to: getRouteByRole(user?.role_code, 'companies') },
  ];
  const navigationLinks = [
    { label: 'Tìm việc', to: getRouteByRole(user?.role_code, 'home') },
    { label: 'Công ty', to: getRouteByRole(user?.role_code, 'companies') },
    { label: 'Blog nghề nghiệp', to: getRouteByRole(user?.role_code, 'blog') },
    { label: 'Việc đã lưu', to: getRouteByRole(user?.role_code, 'savedJobs') },
  ];
  const candidateLinks = [
    { label: 'Tạo CV bằng AI', to: getRouteByRole(user?.role_code, 'cvBuilder') },
    { label: 'Quản lý hồ sơ CV', to: getRouteByRole(user?.role_code, 'myCvs') },
    { label: 'Cập nhật thông tin', to: getRouteByRole(user?.role_code, 'profile') },
    { label: 'Đổi mật khẩu', to: getRouteByRole(user?.role_code, 'changePassword') },
  ];

  return (
    <footer className="bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300">
      {/* Gradient separator line */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500"></div>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 border-b border-slate-800/60 pb-8 lg:grid-cols-[1.35fr_repeat(3,minmax(0,1fr))]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-lg font-extrabold tracking-tight">
                  <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">Aptertek</span>
                  <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Work</span>
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Career Platform</p>
              </div>
            </div>

            <p className="mt-4 max-w-md text-sm leading-7 text-slate-400">
              Nền tảng kết nối ứng viên và doanh nghiệp với luồng tìm việc, quản lý CV, công ty nổi bật và blog nghề nghiệp trong cùng một hệ thống.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-950/40 px-3 py-2">
                <p className="text-base font-bold text-white">12,500+</p>
                <p className="text-xs text-indigo-300">Việc mới mỗi ngày</p>
              </div>
              <div className="rounded-lg border border-violet-500/20 bg-violet-950/40 px-3 py-2">
                <p className="text-base font-bold text-white">8,200+</p>
                <p className="text-xs text-violet-300">Nhà tuyển dụng</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Khám phá</h4>
            <div className="mt-4 space-y-3">
              {navigationLinks.map((item) => (
                <FooterLink key={item.label} {...item} />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Công cụ ứng viên</h4>
            <div className="mt-4 space-y-3">
              {candidateLinks.map((item) => (
                <FooterLink key={item.label} {...item} />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Hỗ trợ & liên hệ</h4>
            <div className="mt-4 space-y-3">
              {employerLinks.map((item) => (
                <FooterLink key={item.label} {...item} />
              ))}
              <a href="mailto:support@aptertekwork.vn" className="flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">
                <Mail className="h-4 w-4 text-violet-400" />
                support@aptertekwork.vn
              </a>
              <a href="tel:19006868" className="flex items-center gap-2 text-sm text-slate-400 transition-all duration-200 hover:text-white">
                <Phone className="h-4 w-4 text-rose-400" />
                1900 6868
              </a>
              <div className="flex items-start gap-2 text-sm text-slate-400">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>Tầng 12, Lagimark, Bình Thạnh, Thành phố Hồ Chí Minh</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AptertekWork. Bản quyền thuộc về D205-VN.</p>
          <div className="flex items-center gap-4">
            <Link to={getRouteByRole(user?.role_code, 'blog')} className="transition-all duration-200 hover:text-white">Blog</Link>
            <Link to={getRouteByRole(user?.role_code, 'companies')} className="transition-all duration-200 hover:text-white">Công ty</Link>
            <Link to={getRouteByRole(user?.role_code, 'home')} className="transition-all duration-200 hover:text-white">Tìm việc</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
