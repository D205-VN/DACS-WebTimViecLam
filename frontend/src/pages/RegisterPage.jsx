import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Briefcase, ArrowRight, User, Phone } from 'lucide-react';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'seeker', // 'seeker' or 'employer'
    agreeTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement register logic
    console.log('Register:', formData);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-navy-600/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }}></div>

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-12">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-extrabold">
              <span className="text-white">Viec</span>
              <span className="text-emerald-400">Lam</span>
              <span className="text-navy-300">.vn</span>
            </span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-6">
            Bắt đầu hành trình
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              sự nghiệp mới
            </span>
          </h2>
          <p className="text-lg text-navy-200 leading-relaxed max-w-md">
            Tạo tài khoản miễn phí để tiếp cận hàng ngàn cơ hội việc làm và kết nối với các nhà tuyển dụng hàng đầu.
          </p>

          {/* Features */}
          <div className="mt-12 space-y-4">
            {[
              '✅ Tạo CV chuyên nghiệp miễn phí',
              '✅ Nhận thông báo việc làm phù hợp',
              '✅ Ứng tuyển nhanh chóng chỉ 1 click',
            ].map((feature) => (
              <p key={feature} className="text-navy-200 text-sm">{feature}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-9 h-9 bg-gradient-to-br from-navy-600 to-navy-800 rounded-xl flex items-center justify-center shadow-lg shadow-navy-700/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold">
              <span className="text-navy-700">Viec</span>
              <span className="text-emerald-500">Lam</span>
              <span className="text-navy-400">.vn</span>
            </span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">Đăng ký tài khoản</h1>
            <p className="text-gray-500">
              Đã có tài khoản?{' '}
              <Link to="/login" className="text-navy-700 font-semibold hover:text-navy-800 transition-colors">
                Đăng nhập
              </Link>
            </p>
          </div>

          {/* Role Selection */}
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => handleChange('role', 'seeker')}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${
                formData.role === 'seeker'
                  ? 'border-navy-600 bg-navy-50 text-navy-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              🔍 Tìm việc
            </button>
            <button
              type="button"
              onClick={() => handleChange('role', 'employer')}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${
                formData.role === 'employer'
                  ? 'border-navy-600 bg-navy-50 text-navy-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              🏢 Nhà tuyển dụng
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Họ và tên</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Số điện thoại</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="0912 345 678"
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                checked={formData.agreeTerms}
                onChange={(e) => handleChange('agreeTerms', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded accent-navy-700"
                required
              />
              <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer leading-snug">
                Tôi đồng ý với{' '}
                <a href="#" className="text-navy-700 font-medium hover:underline">Điều khoản dịch vụ</a>
                {' '}và{' '}
                <a href="#" className="text-navy-700 font-medium hover:underline">Chính sách bảo mật</a>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Tạo tài khoản
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-400 font-medium">HOẶC</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Social Register */}
          <button className="w-full flex items-center justify-center gap-3 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Đăng ký với Google
          </button>

          {/* Back to Home */}
          <p className="text-center mt-6">
            <Link to="/" className="text-sm text-gray-500 hover:text-navy-700 transition-colors">
              ← Quay lại trang chủ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
