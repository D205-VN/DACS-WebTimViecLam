import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, Camera, CheckCircle2, Loader2, Mail, Phone, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import { getBackLabelByRole, getDefaultRouteByRole } from '@shared/utils/roleRedirect';
import API_BASE_URL from '@shared/api/baseUrl';
import UserAvatar from '@shared/ui/UserAvatar';

const API_BASE = `${API_BASE_URL}/api/auth`;
const MAX_AVATAR_SOURCE_SIZE = 8 * 1024 * 1024;

function buildInitialForm(user) {
  return {
    fullName: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    avatarUrl: user?.avatar_url || '',
    companyName: user?.company_name || '',
    companyEmail: user?.company_email || '',
    companyCity: user?.company_city || '',
    companyWard: user?.company_ward || '',
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được ảnh. Vui lòng chọn ảnh khác.'));
    reader.readAsDataURL(file);
  });
}

async function buildAvatarDataUrl(file) {
  if (!file.type?.startsWith('image/')) {
    throw new Error('Vui lòng chọn đúng định dạng ảnh.');
  }

  if (file.size > MAX_AVATAR_SOURCE_SIZE) {
    throw new Error('Ảnh quá lớn. Vui lòng chọn ảnh dưới 8MB.');
  }

  const sourceDataUrl = await readFileAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const outputSize = 512;
      const sourceSize = Math.min(image.width, image.height);
      const sourceX = Math.max(0, Math.round((image.width - sourceSize) / 2));
      const sourceY = Math.max(0, Math.round((image.height - sourceSize) / 2));
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('Không thể xử lý ảnh. Vui lòng chọn ảnh khác.'));
        return;
      }

      canvas.width = outputSize;
      canvas.height = outputSize;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, outputSize, outputSize);
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    image.onerror = () => reject(new Error('Ảnh không hợp lệ. Vui lòng chọn ảnh khác.'));
    image.src = sourceDataUrl;
  });
}

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth();
  const [form, setForm] = useState(() => buildInitialForm(user));
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setForm(buildInitialForm(user));
  }, [user]);

  const isEmployer = user?.role_code === 'employer';
  const canEditAvatar = user?.role_code === 'seeker';
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const backLabel = getBackLabelByRole(user?.role_code);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarLoading(true);
    setSuccess('');
    setError('');

    try {
      const avatarUrl = await buildAvatarDataUrl(file);
      handleChange('avatarUrl', avatarUrl);
    } catch (err) {
      setError(err.message || 'Không thể xử lý ảnh đại diện');
    } finally {
      setAvatarLoading(false);
    }
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

      if (canEditAvatar) {
        payload.avatarUrl = form.avatarUrl;
      }

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
      <Link to={backRoute} className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-gray-100 bg-gradient-to-br from-navy-700 via-navy-800 to-slate-900 p-6 text-white shadow-lg shadow-navy-900/10">
          <div className="relative h-24 w-24 overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-lg">
            <UserAvatar
              src={form.avatarUrl}
              alt={form.fullName || 'Ảnh đại diện'}
              className="h-full w-full object-cover"
              fallbackClassName="flex h-full w-full items-center justify-center"
              iconClassName="h-10 w-10 text-emerald-300"
            />
          </div>
          {canEditAvatar ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {avatarLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {avatarLoading ? 'Đang xử lý' : 'Đổi ảnh'}
              </button>
              {form.avatarUrl ? (
                <button
                  type="button"
                  onClick={() => handleChange('avatarUrl', '')}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Xóa ảnh
                </button>
              ) : null}
            </div>
          ) : null}
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
              disabled={loading || avatarLoading}
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
