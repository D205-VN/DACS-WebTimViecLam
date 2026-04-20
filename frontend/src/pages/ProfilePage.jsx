import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, Loader2, Mail, Phone, Save, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = '/api/auth';

function buildInitialForm(user) {
  return {
    fullName: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    companyName: user?.company_name || '',
    companyEmail: user?.company_email || '',
    companyCity: user?.company_city || '',
    companyWard: user?.company_ward || '',
  };
}

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth();
  const [form, setForm] = useState(() => buildInitialForm(user));
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(buildInitialForm(user));
  }, [user]);

  const isEmployer = user?.role_code === 'employer';

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
      };

      if (isEmployer) {
        payload.companyName = form.companyName;
        payload.companyEmail = form.companyEmail;
        payload.companyCity = form.companyCity;
        payload.companyWard = form.companyWard;
      }

      const response = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không thể cập nhật thông tin');
      }

      updateUser(data.user);
      setSuccess('Thông tin tài khoản đã được cập nhật.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 transition-all focus:border-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-200';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Quay lại trang chủ
      </Link>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-gray-100 bg-gradient-to-br from-navy-700 via-navy-800 to-slate-900 p-6 text-white shadow-lg shadow-navy-900/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <User className="h-7 w-7 text-emerald-300" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Cập nhật thông tin</h1>
          <p className="mt-2 text-sm leading-6 text-navy-100">
            Điều chỉnh hồ sơ cá nhân để phần ứng tuyển, CV và thông báo hiển thị đúng dữ liệu mới nhất.
          </p>

          <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-navy-200">Tài khoản</p>
              <p className="mt-1 text-base font-semibold">{user?.full_name}</p>
              <p className="text-sm text-navy-200">{user?.role_name}</p>
            </div>
            <div className="space-y-2 text-sm text-navy-100">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-300" />
                <span>{user?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-300" />
                <span>{user?.phone || 'Chưa cập nhật số điện thoại'}</span>
              </div>
              {isEmployer ? (
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness className="h-4 w-4 text-emerald-300" />
                  <span>{user?.company_name || 'Chưa cập nhật công ty'}</span>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Hồ sơ tài khoản</h2>
              <p className="mt-1 text-sm text-gray-500">
                Email đăng nhập được giữ cố định. Các trường còn lại có thể cập nhật ngay tại đây.
              </p>
            </div>
            <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-700">
              {isEmployer ? 'Nhà tuyển dụng' : 'Ứng viên'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            ) : null}
            {success ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {success}
              </div>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Họ và tên</label>
                <input
                  value={form.fullName}
                  onChange={(event) => handleChange('fullName', event.target.value)}
                  placeholder="Nhập họ và tên"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email đăng nhập</label>
                <input value={form.email} disabled className={`${inputClass} cursor-not-allowed bg-gray-50 text-gray-400`} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Số điện thoại</label>
                <input
                  value={form.phone}
                  onChange={(event) => handleChange('phone', event.target.value)}
                  placeholder="Nhập số điện thoại"
                  className={inputClass}
                />
              </div>
            </div>

            {isEmployer ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5">
                <h3 className="text-base font-bold text-gray-800">Thông tin công ty</h3>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">Tên công ty</label>
                    <input
                      value={form.companyName}
                      onChange={(event) => handleChange('companyName', event.target.value)}
                      placeholder="Nhập tên công ty"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email công ty</label>
                    <input
                      value={form.companyEmail}
                      onChange={(event) => handleChange('companyEmail', event.target.value)}
                      placeholder="contact@company.vn"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">Tỉnh / Thành phố</label>
                    <input
                      value={form.companyCity}
                      onChange={(event) => handleChange('companyCity', event.target.value)}
                      placeholder="Ví dụ: TP. Hồ Chí Minh"
                      className={inputClass}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">Phường / Xã / Quận</label>
                    <input
                      value={form.companyWard}
                      onChange={(event) => handleChange('companyWard', event.target.value)}
                      placeholder="Nhập địa chỉ chi tiết hơn"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-navy-600 to-navy-800 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-navy-700/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
