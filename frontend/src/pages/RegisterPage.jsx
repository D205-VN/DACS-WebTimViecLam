import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Briefcase, ArrowRight, User, Phone, Building2, MapPin, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDefaultRouteByRole } from '../utils/roleRedirect';

const API_BASE = '/api/auth';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [step, setStep] = useState(location.state?.pendingEmail ? 2 : 1); // 1=form, 2=OTP
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', password: '', confirmPassword: '',
    role_code: 'seeker', agreeTerms: false,
    companyName: '', companyEmail: '', cityCode: '', wardCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP states
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpRefs = useRef([]);

  // Address
  const [cities, setCities] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    fetch('/data/vietnam_34_provinces.json').then(r => r.json()).then(setCities).catch(console.error);
  }, []);

  useEffect(() => {
    if (!formData.cityCode) { setWards([]); return; }
    setFormData(p => ({ ...p, wardCode: '' }));
    const city = cities.find(c => c.code === formData.cityCode);
    setWards(city?.wards || []);
  }, [formData.cityCode, cities]);

  // OTP countdown
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  const handleChange = (field, value) => setFormData(p => ({ ...p, [field]: value }));
  const isEmployer = formData.role_code === 'employer';
  
  // Use pendingEmail if navigating from login, otherwise use form data
  const pendingEmail = location.state?.pendingEmail;
  const emailForOTP = pendingEmail || (isEmployer ? formData.companyEmail : formData.email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) { setError('Mật khẩu xác nhận không khớp'); return; }

    if (isEmployer) {
      const free = ['gmail.com','yahoo.com','hotmail.com','outlook.com','mail.com','ymail.com','protonmail.com'];
      const domain = formData.companyEmail.split('@')[1]?.toLowerCase();
      if (free.includes(domain)) { setError('Nhà tuyển dụng vui lòng sử dụng email công ty'); return; }
    }

    const selectedCity = cities.find(c => c.code === formData.cityCode);
    const selectedWard = wards.find(w => w.code == formData.wardCode);

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName, email: emailForOTP, phone: formData.phone,
          password: formData.password, role_code: formData.role_code,
          companyName: formData.companyName || null, companyEmail: formData.companyEmail || null,
          companyCity: selectedCity?.name || null, companyWard: selectedWard?.name || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep(2);
      setOtpCountdown(60);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length !== 6) { setError('Vui lòng nhập đủ 6 số'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailForOTP, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(data.token, data.user);
      navigate(getDefaultRouteByRole(data.user.role_code));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    if (otpCountdown > 0) return;
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/resend-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailForOTP }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOtpCountdown(60); setOtp(['','','','','','']);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  // Init Google Sign-In
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: '4615580608-8d4ng3atlmmgb404tpce6lp2p4cjdedn.apps.googleusercontent.com',
        callback: async (response) => {
          try {
            const res = await fetch(`${API_BASE}/google`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            login(data.token, data.user);
            navigate(getDefaultRouteByRole(data.user.role_code));
          } catch (err) { setError(err.message); }
        },
      });
      window.google.accounts.id.renderButton(
        document.getElementById('googleSignInDiv'),
        { theme: 'outline', size: 'large', text: 'signup_with', width: '100%' }
      );
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputClass = 'w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all';
  const selectClass = 'w-full pl-12 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all appearance-none cursor-pointer';

  return (
    <div className="min-h-screen flex">
      {/* Left Side */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900 relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-navy-600/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-extrabold">
              <span className="text-white">Viec</span><span className="text-emerald-400">Lam</span><span className="text-navy-300">.vn</span>
            </span>
          </div>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-6">
            {step === 1 ? <>Bắt đầu hành trình<br /><span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">sự nghiệp mới</span></> : <>Xác thực<br /><span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">tài khoản</span></>}
          </h2>
          <p className="text-lg text-navy-200 leading-relaxed max-w-md">
            {step === 1 ? 'Tạo tài khoản miễn phí để tiếp cận hàng ngàn cơ hội việc làm.' : 'Nhập mã OTP 6 số đã gửi đến email của bạn.'}
          </p>
          {step === 1 && <div className="mt-12 space-y-4">{['✅ Tạo CV chuyên nghiệp miễn phí', '✅ Nhận thông báo việc làm phù hợp', '✅ Ứng tuyển nhanh chóng chỉ 1 click'].map(f => <p key={f} className="text-navy-200 text-sm">{f}</p>)}</div>}
        </div>
      </div>

      {/* Right Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-9 h-9 bg-gradient-to-br from-navy-600 to-navy-800 rounded-xl flex items-center justify-center shadow-lg shadow-navy-700/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold"><span className="text-navy-700">Viec</span><span className="text-emerald-500">Lam</span><span className="text-navy-400">.vn</span></span>
          </div>

          {/* Error display */}
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

          {step === 1 ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">Đăng ký tài khoản</h1>
                <p className="text-gray-500">Đã có tài khoản? <Link to="/login" className="text-navy-700 font-semibold hover:text-navy-800">Đăng nhập</Link></p>
              </div>

              {/* Role Selection */}
              <div className="flex gap-3 mb-6">
                {[['seeker', '🔍 Tìm việc'], ['employer', '🏢 Nhà tuyển dụng']].map(([r, label]) => (
                  <button key={r} type="button" onClick={() => handleChange('role_code', r)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${formData.role_code === r ? 'border-navy-600 bg-navy-50 text-navy-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Họ và tên</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" value={formData.fullName} onChange={e => handleChange('fullName', e.target.value)} placeholder="Nguyễn Văn A" className={inputClass} required />
                  </div>
                </div>

                {/* Email (Seeker) */}
                {!isEmployer && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} placeholder="name@example.com" className={inputClass} required />
                    </div>
                  </div>
                )}

                {/* Employer Fields */}
                {isEmployer && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email công ty <span className="text-xs text-gray-400 font-normal">(bắt buộc email doanh nghiệp)</span></label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="email" value={formData.companyEmail} onChange={e => handleChange('companyEmail', e.target.value)} placeholder="hr@congty.com.vn" className={inputClass} required />
                      </div>
                      <p className="text-xs text-amber-600 mt-1">⚠️ Không chấp nhận Gmail, Yahoo, Hotmail...</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tên công ty</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" value={formData.companyName} onChange={e => handleChange('companyName', e.target.value)} placeholder="Công ty TNHH ABC" className={inputClass} required />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">Địa chỉ làm việc</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <select value={formData.cityCode} onChange={e => handleChange('cityCode', e.target.value)} className={`${selectClass} ${!formData.cityCode ? 'text-gray-400' : ''}`} required>
                          <option value="">-- Chọn Tỉnh/Thành phố --</option>
                          {cities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <select value={formData.wardCode} onChange={e => handleChange('wardCode', e.target.value)} className={`${selectClass} ${!formData.wardCode ? 'text-gray-400' : ''}`} disabled={!formData.cityCode} required>
                          <option value="">-- Chọn Phường/Xã --</option>
                          {wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Số điện thoại</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="tel" value={formData.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="0912 345 678" className={inputClass} required />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => handleChange('password', e.target.value)} placeholder="Tối thiểu 8 ký tự" className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all" required minLength={8} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Xác nhận mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={e => handleChange('confirmPassword', e.target.value)} placeholder="Nhập lại mật khẩu" className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all" required minLength={8} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                  </div>
                </div>

                {/* Terms */}
                <div className="flex items-start gap-2">
                  <input type="checkbox" id="terms" checked={formData.agreeTerms} onChange={e => handleChange('agreeTerms', e.target.checked)} className="w-4 h-4 mt-0.5 rounded accent-navy-700" required />
                  <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer leading-snug">
                    Tôi đồng ý với <a href="#" className="text-navy-700 font-medium hover:underline">Điều khoản dịch vụ</a> và <a href="#" className="text-navy-700 font-medium hover:underline">Chính sách bảo mật</a>
                  </label>
                </div>

                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Tạo tài khoản</span><ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-400 font-medium">HOẶC</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Google Sign-In Div */}
              <div id="googleSignInDiv" className="w-full flex justify-center"></div>

              <p className="text-center mt-6"><Link to="/" className="text-sm text-gray-500 hover:text-navy-700 transition-colors">← Quay lại trang chủ</Link></p>
            </>
          ) : (
            /* STEP 2: OTP Verification */
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-extrabold text-gray-800 mb-2">Xác thực email</h1>
              <p className="text-gray-500 mb-8">Mã OTP 6 số đã gửi đến <br/><strong className="text-navy-700">{emailForOTP}</strong></p>

              <div className="flex justify-center gap-3 mb-6">
                {otp.map((digit, i) => (
                  <input key={i} ref={el => otpRefs.current[i] = el} type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold bg-white border-2 border-gray-200 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200 outline-none transition-all" />
                ))}
              </div>

              <button onClick={handleVerifyOTP} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-60 mb-4">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /><span>Xác thực</span></>}
              </button>

              <p className="text-sm text-gray-500">
                Không nhận được mã?{' '}
                {otpCountdown > 0 ? <span className="text-gray-400">Gửi lại sau {otpCountdown}s</span> : <button onClick={handleResendOTP} className="text-navy-700 font-semibold hover:underline">Gửi lại</button>}
              </p>

              <button onClick={() => setStep(1)} className="mt-4 text-sm text-gray-400 hover:text-gray-600">← Quay lại đăng ký</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
