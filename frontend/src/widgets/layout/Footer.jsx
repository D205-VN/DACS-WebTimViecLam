import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import { getRouteByRole } from '@shared/utils/roleRedirect';

function FooterLink({ to, label }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white">
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
    <footer className="relative overflow-hidden bg-[#071421] text-slate-200">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-8 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 border-b border-white/10 pb-10 lg:grid-cols-[1.35fr_repeat(3,minmax(0,1fr))]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-500 to-cyan-500 shadow-lg shadow-cyan-900/20">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-extrabold tracking-tight text-white">
                  <span className="text-white">Aptertek</span>
                  <span className="text-emerald-400">Work</span>
                </p>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Career Platform</p>
              </div>
            </div>

            <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
              Nền tảng kết nối ứng viên và doanh nghiệp với luồng tìm việc, quản lý CV, công ty nổi bật và blog nghề nghiệp trong cùng một hệ thống.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                <p className="text-lg font-bold text-white">12,500+</p>
                <p className="text-xs text-slate-400">Việc làm mới mỗi ngày</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                <p className="text-lg font-bold text-white">8,200+</p>
                <p className="text-xs text-slate-400">Nhà tuyển dụng đang hoạt động</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Khám phá</h4>
            <div className="mt-5 space-y-3">
              {navigationLinks.map((item) => (
                <FooterLink key={item.label} {...item} />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Công cụ ứng viên</h4>
            <div className="mt-5 space-y-3">
              {candidateLinks.map((item) => (
                <FooterLink key={item.label} {...item} />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Hỗ trợ & liên hệ</h4>
            <div className="mt-5 space-y-3">
              {employerLinks.map((item) => (
                <FooterLink key={item.label} {...item} />
              ))}
              <a href="mailto:support@aptertekwork.vn" className="flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white">
                <Mail className="h-4 w-4 text-emerald-400" />
                support@aptertekwork.vn
              </a>
              <a href="tel:19006868" className="flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white">
                <Phone className="h-4 w-4 text-emerald-400" />
                1900 6868
              </a>
              <div className="flex items-start gap-2 text-sm text-slate-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>Tầng 12, Lagimark, Bình Thạnh, Thành phố Hồ Chí Minh</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            Hệ thống được tối ưu cho tìm việc, quản lý CV và theo dõi ứng tuyển theo thời gian thực.
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <Link to={getRouteByRole(user?.role_code, 'blog')} className="transition-colors hover:text-white">Blog</Link>
            <Link to={getRouteByRole(user?.role_code, 'companies')} className="transition-colors hover:text-white">Công ty</Link>
            <Link to={getRouteByRole(user?.role_code, 'home')} className="transition-colors hover:text-white">Tìm việc</Link>
            <span>© {new Date().getFullYear()} AptertekWork</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
