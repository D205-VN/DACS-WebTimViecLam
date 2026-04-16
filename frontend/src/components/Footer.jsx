import { Briefcase, Globe, Tv, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-navy-900 text-navy-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-navy-500 to-navy-700 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold">
                <span className="text-white">Viec</span>
                <span className="text-emerald-400">Lam</span>
                <span className="text-navy-400">.vn</span>
              </span>
            </div>
            <p className="text-sm text-navy-300 leading-relaxed mb-4">
              Nền tảng tìm kiếm việc làm hàng đầu Việt Nam. Kết nối ứng viên tài năng với các nhà tuyển dụng uy tín.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
                <Globe className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
                <Tv className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* For Job Seekers */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Ứng viên</h4>
            <ul className="space-y-2.5">
              {['Tìm việc làm', 'Tạo CV', 'Công ty hàng đầu', 'Mức lương', 'Blog nghề nghiệp'].map(item => (
                <li key={item}>
                  <a href="#" className="text-sm text-navy-300 hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* For Employers */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Nhà tuyển dụng</h4>
            <ul className="space-y-2.5">
              {['Đăng tin tuyển dụng', 'Tìm ứng viên', 'Dịch vụ HR', 'Bảng giá', 'Liên hệ hỗ trợ'].map(item => (
                <li key={item}>
                  <a href="#" className="text-sm text-navy-300 hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Liên hệ</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-navy-400" />
                <span className="text-sm text-navy-300">Tầng 12, Toà nhà Landmark 81, TP.HCM</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0 text-navy-400" />
                <span className="text-sm text-navy-300">1900 6868</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0 text-navy-400" />
                <span className="text-sm text-navy-300">support@vieclam.vn</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-navy-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-navy-400">© 2026 ViecLam.vn — Bản quyền thuộc về D205-VN</p>
          <div className="flex gap-4">
            <a href="#" className="text-xs text-navy-400 hover:text-navy-200 transition-colors">Điều khoản</a>
            <a href="#" className="text-xs text-navy-400 hover:text-navy-200 transition-colors">Chính sách</a>
            <a href="#" className="text-xs text-navy-400 hover:text-navy-200 transition-colors">Trợ giúp</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
