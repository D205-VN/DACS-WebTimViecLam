import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Shield, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@components/providers/AuthContext';
import { authApi } from '@services/auth/auth.api';
import { getBackLabelByRole, getDefaultRouteByRole } from '@services/navigation/roleRedirect';

export default function ChangePasswordPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const backLabel = getBackLabelByRole(user?.role_code);

  const handleChange = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const handleBackHome = () => {
    navigate(backRoute);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu mới không khớp');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('Mật khẩu mới tối thiểu 8 ký tự');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(token, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setSuccess('Đổi mật khẩu thành công!');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const inputClass = 'w-full pl-12 pr-12 py-3 bg-white border border-indigo-100/60 rounded-md text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-indigo-400 transition-all';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/30 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Back link */}
        <button 
          onClick={handleBackHome}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </button>

        {/* Card */}
        <div className="overflow-hidden rounded-lg border border-indigo-100/60 bg-white">
          {/* Header */}
          <div className="border-b border-indigo-50 bg-indigo-50/50 px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-amber-50">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Bảo mật tài khoản</h1>
                <p className="text-sm text-gray-500">Đổi mật khẩu đăng nhập</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && <div className="rounded-md rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 p-3 text-sm text-red-600">{error}</div>}
            {success && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-600">
                <CheckCircle2 className="w-4 h-4" /> {success}
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mật khẩu hiện tại</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type={showCurrent ? 'text' : 'password'} value={form.currentPassword} onChange={e => handleChange('currentPassword', e.target.value)} placeholder="Nhập mật khẩu hiện tại" className={inputClass} required />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mật khẩu mới</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type={showNew ? 'text' : 'password'} value={form.newPassword} onChange={e => handleChange('newPassword', e.target.value)} placeholder="Tối thiểu 8 ký tự" className={inputClass} required minLength={8} />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Xác nhận mật khẩu mới</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type={showConfirm ? 'text' : 'password'} value={form.confirmPassword} onChange={e => handleChange('confirmPassword', e.target.value)} placeholder="Nhập lại mật khẩu mới" className={inputClass} required minLength={8} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 font-semibold text-white transition-colors hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
