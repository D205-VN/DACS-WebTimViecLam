import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import SeekerToolsNav from '@features/seeker-tools/SeekerToolsNav';
import { getBackLabelByRole, getDefaultRouteByRole, getJobDetailRoute } from '@shared/utils/roleRedirect';
import API_BASE_URL from '@shared/api/baseUrl';

const API = `${API_BASE_URL}/api/notifications/job-alerts`;

const salaryRanges = [
  { value: '', label: 'Tất cả mức lương' },
  { value: '0-10', label: 'Dưới 10 triệu' },
  { value: '10-15', label: '10 - 15 triệu' },
  { value: '15-20', label: '15 - 20 triệu' },
  { value: '20-30', label: '20 - 30 triệu' },
  { value: '30+', label: 'Trên 30 triệu' },
];

function formatDateTime(value) {
  if (!value) return 'Chưa gửi digest';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Chưa gửi digest';
  return parsed.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getSalaryLabel(value) {
  return salaryRanges.find((item) => item.value === value)?.label || value || 'Tất cả mức lương';
}

export default function JobAlertsPage() {
  const { token, user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    keyword: '',
    location: '',
    salaryRange: '',
  });
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const backLabel = getBackLabelByRole(user?.role_code);

  const activeCount = useMemo(() => alerts.filter((alert) => alert.is_active).length, [alerts]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tải job alerts');
      setAlerts(data.data || []);
    } catch (err) {
      setError(err.message || 'Không thể tải job alerts');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchAlerts();
    else setLoading(false);
  }, [token, fetchAlerts]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tạo job alert');

      setAlerts((prev) => [data.data, ...prev]);
      setForm({ keyword: '', location: '', salaryRange: '' });
      setNotice(data.message || 'Đã tạo job alert');
    } catch (err) {
      setError(err.message || 'Không thể tạo job alert');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (alert) => {
    setActionId(alert.id);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`${API}/${alert.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          keyword: alert.keyword,
          location: alert.location,
          salaryRange: alert.salary_range,
          isActive: !alert.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể cập nhật job alert');

      setAlerts((prev) => prev.map((item) => (item.id === alert.id ? data.data : item)));
      setNotice(data.message || 'Đã cập nhật job alert');
    } catch (err) {
      setError(err.message || 'Không thể cập nhật job alert');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (alertId) => {
    if (!window.confirm('Bạn có chắc muốn xóa job alert này?')) return;
    setActionId(alertId);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`${API}/${alertId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể xóa job alert');

      setAlerts((prev) => prev.filter((item) => item.id !== alertId));
      setNotice(data.message || 'Đã xóa job alert');
    } catch (err) {
      setError(err.message || 'Không thể xóa job alert');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to={backRoute} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      <div className="flex flex-col gap-4 mb-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center">
            <Bell className="w-7 h-7 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Job alerts cá nhân hóa</h1>
            <p className="text-sm text-gray-500">Tạo alert theo từ khóa, vị trí và khoảng lương để nhận email digest hằng tuần.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          <b>{activeCount}</b> alert đang hoạt động
        </div>
      </div>

      <SeekerToolsNav />

      {notice ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Search className="h-4 w-4 text-gray-400" />
              Từ khóa
            </span>
            <input
              value={form.keyword}
              onChange={(event) => setForm((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder="Frontend, kế toán, marketing..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <MapPin className="h-4 w-4 text-gray-400" />
              Vị trí
            </span>
            <input
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              placeholder="Hồ Chí Minh, Hà Nội..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <DollarSign className="h-4 w-4 text-gray-400" />
              Lương
            </span>
            <select
              value={form.salaryRange}
              onChange={(event) => setForm((prev) => ({ ...prev, salaryRange: event.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
            >
              {salaryRanges.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Tạo alert
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-navy-600" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <Bell className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <h3 className="mb-2 text-lg font-bold text-gray-800">Chưa có job alert</h3>
          <p className="text-sm text-gray-500">Tạo alert đầu tiên để hệ thống tự tìm việc phù hợp và gửi digest hằng tuần.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {alert.keyword ? <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-700">{alert.keyword}</span> : null}
                    {alert.location ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{alert.location}</span> : null}
                    {alert.salary_range ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{getSalaryLabel(alert.salary_range)}</span> : null}
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${alert.is_active ? 'bg-cyan-50 text-cyan-700' : 'bg-gray-100 text-gray-500'}`}>
                      {alert.is_active ? 'Đang bật' : 'Đã tắt'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">Digest gần nhất: {formatDateTime(alert.last_digest_sent_at)}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(alert)}
                    disabled={actionId === alert.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                  >
                    {actionId === alert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                    {alert.is_active ? 'Tắt' : 'Bật'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(alert.id)}
                    disabled={actionId === alert.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa
                  </button>
                </div>
              </div>

              <div className="mt-5 border-t border-gray-100 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-800">Gợi ý phù hợp hiện tại</h4>
                  <span className="text-xs text-gray-400">{alert.preview_count || 0} tin</span>
                </div>

                {alert.preview_matches?.length ? (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {alert.preview_matches.map((job) => (
                      <Link
                        key={job.id}
                        to={getJobDetailRoute(user?.role_code, job.id)}
                        className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition hover:border-navy-200 hover:bg-white hover:shadow-sm"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <Briefcase className="h-5 w-5 text-navy-600" />
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{job.match_score}%</span>
                        </div>
                        <h5 className="line-clamp-2 text-sm font-bold text-gray-800">{job.title}</h5>
                        <p className="mt-1 line-clamp-1 text-xs text-gray-500">{job.company_name || 'Đang cập nhật'}</p>
                        <p className="mt-2 line-clamp-1 text-xs font-semibold text-success-600">{job.salary || 'Thỏa thuận'}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                    Chưa có tin phù hợp ngay lúc này.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
