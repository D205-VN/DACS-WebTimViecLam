import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Briefcase, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = '/api/auth';

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
      navigate('/');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleGoogleLogin = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    } else { setError('Google Sign-In chưa sẵn sàng.'); }
  };

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
            navigate('/');
          } catch (err) { setError(err.message); }
        },
      });
      window.google.accounts.id.renderButton(
        document.getElementById('googleSignInDiv'),
        { theme: 'outline', size: 'large', text: 'signin_with', width: '100%' }
      );
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900 relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-navy-600/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl"></div>
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
            Chào mừng bạn<br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">trở lại!</span>
          </h2>
          <p className="text-lg text-navy-200 leading-relaxed max-w-md">Đăng nhập để tiếp tục hành trình tìm kiếm công việc mơ ước.</p>
          <div className="flex gap-8 mt-12">
            <div><p className="text-3xl font-bold text-white">12,500+</p><p className="text-sm text-navy-300 mt-1">Việc làm mới</p></div>
            <div><p className="text-3xl font-bold text-white">8,200+</p><p className="text-sm text-navy-300 mt-1">Nhà tuyển dụng</p></div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-gradient-to-br from-navy-600 to-navy-800 rounded-xl flex items-center justify-center shadow-lg shadow-navy-700/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold"><span className="text-navy-700">Viec</span><span className="text-emerald-500">Lam</span><span className="text-navy-400">.vn</span></span>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">Đăng nhập</h1>
            <p className="text-gray-500">Chưa có tài khoản? <Link to="/register" className="text-navy-700 font-semibold hover:text-navy-800 transition-colors">Đăng ký ngay</Link></p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all" required />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">Mật khẩu</label>
                <a href="#" className="text-xs text-navy-600 hover:text-navy-800 font-medium">Quên mật khẩu?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu" className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="w-4 h-4 rounded accent-navy-700" />
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">Ghi nhớ đăng nhập</label>
            </div>

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Đăng nhập</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-400 font-medium">HOẶC</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Google Sign-In Div */}
          <div className="space-y-3">
            <div id="googleSignInDiv" className="w-full flex justify-center"></div>
          </div>

          <p className="text-center mt-8"><Link to="/" className="text-sm text-gray-500 hover:text-navy-700 transition-colors">← Quay lại trang chủ</Link></p>
        </div>
      </div>
    </div>
  );
}
