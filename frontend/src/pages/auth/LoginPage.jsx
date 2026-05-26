import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Briefcase, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import GoogleSignInButton from '@features/auth/GoogleSignInButton';
import { getDefaultRouteByRole } from '@shared/utils/roleRedirect';
import API_BASE_URL from '@shared/api/baseUrl';

const API_BASE = `${API_BASE_URL}/api/auth`;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needVerify) {
          navigate('/register', { state: { pendingEmail: data.email } });
          return;
        }
        throw new Error(data.error);
      }
      login(data.token, data.user);
      navigate(getDefaultRouteByRole(data.user.role_code));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleGoogleCredential = useCallback(async (response) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/google`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(data.token, data.user);
      navigate(getDefaultRouteByRole(data.user.role_code));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [login, navigate]);

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Vibrant Gradient */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700" style={{ backgroundSize: '200% 200%', animation: 'aw-gradient-shift 8s ease infinite' }}></div>

        {/* Decorative shapes */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl"></div>
          <div className="absolute bottom-20 right-10 h-60 w-60 rounded-full bg-pink-400/10 blur-3xl"></div>
          <div className="absolute left-1/3 top-1/3 h-40 w-40 rounded-full bg-indigo-300/10 blur-2xl"></div>
          <div className="absolute right-1/4 top-10 h-32 w-32 rounded-full border border-white/10"></div>
          <div className="absolute bottom-1/3 left-10 h-20 w-20 rounded-full border border-white/5"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="flex items-center gap-2 mb-12">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-extrabold">
              <span className="text-white">Aptertek</span><span className="text-emerald-300">Work</span><span className="text-indigo-200">.vn</span>
            </span>
          </div>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-6">
            Chào mừng bạn<br />
            <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">trở lại!</span>
          </h2>
          <p className="text-lg text-indigo-100 leading-relaxed max-w-md">Đăng nhập để tiếp tục hành trình tìm kiếm công việc mơ ước.</p>
          <div className="flex gap-8 mt-12">
            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-5 py-3">
              <p className="text-3xl font-bold text-white">12,500+</p>
              <p className="text-sm text-indigo-200 mt-1">Việc làm mới</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-5 py-3">
              <p className="text-3xl font-bold text-white">8,200+</p>
              <p className="text-sm text-indigo-200 mt-1">Nhà tuyển dụng</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex w-full items-center justify-center bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/30 px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md shadow-indigo-200">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold">
              <span className="bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">Aptertek</span>
              <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">Work</span>
              <span className="text-indigo-400">.vn</span>
            </span>
          </div>

          {error && <div className="mb-4 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 p-3 text-sm text-rose-600">{error}</div>}

          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">Đăng nhập</h1>
            <p className="text-gray-500">Chưa có tài khoản? <Link to="/register" className="text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">Đăng ký ngay</Link></p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className="w-full rounded-xl border border-indigo-100 bg-white py-3 pl-12 pr-4 text-sm text-gray-700 placeholder:text-gray-400 transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 shadow-sm" required />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">Mật khẩu</label>
                <Link to="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Quên mật khẩu?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu" className="w-full rounded-xl border border-indigo-100 bg-white py-3 pl-12 pr-12 text-sm text-gray-700 placeholder:text-gray-400 transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 shadow-sm" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="w-4 h-4 rounded accent-indigo-600" />
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">Ghi nhớ đăng nhập</label>
            </div>

            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 font-semibold text-white shadow-lg shadow-indigo-200/50 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-300/50 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Đăng nhập</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent"></div>
            <span className="text-xs text-gray-400 font-medium">HOẶC</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent"></div>
          </div>

          <GoogleSignInButton
            label="Đăng nhập với Google"
            mode="signin"
            onCredential={handleGoogleCredential}
            onError={setError}
          />

          <p className="text-center mt-8"><Link to="/" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">← Quay lại trang chủ</Link></p>
        </div>
      </div>
    </div>
  );
}
