import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, Loader2, ShieldCheck, KeyRound, CheckCircle2, Briefcase } from 'lucide-react';
import API_BASE_URL from '@shared/api/baseUrl';

const API_BASE = `${API_BASE_URL}/api/auth`;

const STEPS = { EMAIL: 'email', OTP: 'otp', RESET: 'reset', SUCCESS: 'success' };

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((p) => p - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === STEPS.OTP) {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // ============== Step 1: Send OTP ==============
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep(STEPS.OTP);
      setCountdown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============== Step 2: Verify OTP ==============
  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otp];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setOtp(next);
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otpStr = otp.join('');
    if (otpStr.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpStr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetToken(data.resetToken);
      setStep(STEPS.RESET);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOtp(['', '', '', '', '', '']);
      setCountdown(60);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============== Step 3: Reset Password ==============
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu tối thiểu 8 ký tự');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep(STEPS.SUCCESS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all';

  const stepMeta = {
    [STEPS.EMAIL]: { icon: Mail, title: 'Quên mật khẩu', desc: 'Nhập email đã đăng ký để nhận mã xác thực' },
    [STEPS.OTP]: { icon: ShieldCheck, title: 'Nhập mã xác thực', desc: `Mã OTP 6 số đã được gửi đến ${email}` },
    [STEPS.RESET]: { icon: KeyRound, title: 'Đặt lại mật khẩu', desc: 'Tạo mật khẩu mới cho tài khoản của bạn' },
    [STEPS.SUCCESS]: { icon: CheckCircle2, title: 'Thành công!', desc: 'Mật khẩu đã được đặt lại thành công' },
  };

  const currentMeta = stepMeta[step];

  // Progress bar
  const stepNumber = step === STEPS.EMAIL ? 1 : step === STEPS.OTP ? 2 : step === STEPS.RESET ? 3 : 4;

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900 relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-navy-600/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-extrabold">
              <span className="text-white">Aptertek</span><span className="text-emerald-400">Work</span><span className="text-navy-300">.vn</span>
            </span>
          </div>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-6">
            Đặt lại<br />
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">mật khẩu</span>
          </h2>
          <p className="text-lg text-navy-200 leading-relaxed max-w-md">
            Chúng tôi sẽ gửi mã xác thực đến email của bạn để giúp bạn lấy lại quyền truy cập tài khoản.
          </p>

          {/* Steps indicator */}
          <div className="mt-12 space-y-4">
            {[
              { num: 1, text: 'Nhập email đã đăng ký' },
              { num: 2, text: 'Xác thực mã OTP' },
              { num: 3, text: 'Tạo mật khẩu mới' },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  stepNumber > s.num
                    ? 'bg-emerald-500 text-white'
                    : stepNumber === s.num
                      ? 'bg-white text-navy-800'
                      : 'bg-white/10 text-white/50'
                }`}>
                  {stepNumber > s.num ? '✓' : s.num}
                </div>
                <span className={`text-sm font-medium transition-colors ${
                  stepNumber >= s.num ? 'text-white' : 'text-white/40'
                }`}>
                  {s.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-gradient-to-br from-navy-600 to-navy-800 rounded-xl flex items-center justify-center shadow-lg shadow-navy-700/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold"><span className="text-navy-700">Aptertek</span><span className="text-emerald-500">Work</span><span className="text-navy-400">.vn</span></span>
          </div>

          {/* Progress bar (mobile) */}
          <div className="mb-8 lg:hidden">
            <div className="flex gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  stepNumber >= s ? 'bg-navy-600' : 'bg-gray-200'
                }`} />
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 animate-in fade-in duration-200">
              {error}
            </div>
          )}

          {/* Header */}
          <div className="mb-8">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
              step === STEPS.SUCCESS
                ? 'bg-gradient-to-br from-emerald-100 to-emerald-50'
                : 'bg-gradient-to-br from-navy-100 to-navy-50'
            }`}>
              <currentMeta.icon className={`w-7 h-7 ${
                step === STEPS.SUCCESS ? 'text-emerald-600' : 'text-navy-600'
              }`} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">{currentMeta.title}</h1>
            <p className="text-gray-500 text-sm">{currentMeta.desc}</p>
          </div>

          {/* =============== STEP 1: EMAIL =============== */}
          {step === STEPS.EMAIL && (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email đã đăng ký</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={inputClass}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Gửi mã xác thực</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {/* =============== STEP 2: OTP =============== */}
          {step === STEPS.OTP && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Nhập mã OTP 6 số</label>
                <div className="flex justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold text-navy-800 bg-white border-2 border-gray-200 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-100 outline-none transition-all"
                    />
                  ))}
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-500">
                  Chưa nhận được mã?{' '}
                  {countdown > 0 ? (
                    <span className="text-gray-400">Gửi lại sau {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={loading}
                      className="text-navy-600 font-semibold hover:text-navy-800 transition-colors"
                    >
                      Gửi lại mã
                    </button>
                  )}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Xác thực</span><ArrowRight className="w-4 h-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => { setStep(STEPS.EMAIL); setError(''); setOtp(['', '', '', '', '', '']); }}
                className="w-full text-center text-sm text-gray-500 hover:text-navy-700 transition-colors"
              >
                ← Quay lại nhập email
              </button>
            </form>
          )}

          {/* =============== STEP 3: RESET PASSWORD =============== */}
          {step === STEPS.RESET && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mật khẩu mới</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    className={inputClass}
                    required
                    minLength={8}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Xác nhận mật khẩu mới</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className={inputClass}
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Password strength hint */}
              <div className="p-3 bg-navy-50 rounded-xl">
                <p className="text-xs font-semibold text-navy-700 mb-2">Yêu cầu mật khẩu:</p>
                <div className="space-y-1">
                  <p className={`text-xs flex items-center gap-1.5 ${newPassword.length >= 8 ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${newPassword.length >= 8 ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    Tối thiểu 8 ký tự
                  </p>
                  <p className={`text-xs flex items-center gap-1.5 ${newPassword && newPassword === confirmPassword ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${newPassword && newPassword === confirmPassword ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    Mật khẩu xác nhận khớp
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Đặt lại mật khẩu'}
              </button>
            </form>
          )}

          {/* =============== STEP 4: SUCCESS =============== */}
          {step === STEPS.SUCCESS && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập ngay bằng mật khẩu mới.</span>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                <span>Đi đến đăng nhập</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Back to login */}
          {step !== STEPS.SUCCESS && (
            <p className="text-center mt-8">
              <Link to="/login" className="text-sm text-gray-500 hover:text-navy-700 transition-colors inline-flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                Quay lại đăng nhập
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
