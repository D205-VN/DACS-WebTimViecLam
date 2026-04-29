import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  Search,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import SeekerToolsNav from '@features/seeker-tools/SeekerToolsNav';
import { getBackLabelByRole, getDefaultRouteByRole, getJobDetailRoute } from '@shared/utils/roleRedirect';
import API_BASE_URL from '@shared/api/baseUrl';

const API = `${API_BASE_URL}/api/notifications/job-alerts`;

function formatDateTime(value) {
  if (!value) return 'Chưa gửi digest';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Chưa gửi digest';
  return parsed.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getSourceJob(alert) {
  const source = alert.source_job || {};

  return {
    id: source.id || alert.job_id,
    title: source.title || alert.source_job_title || 'Tin tuyển dụng đã theo dõi',
    companyName: source.company_name || 'Đang cập nhật',
    location: source.location || alert.source_location || alert.source_company_address || '',
    salary: source.salary || '',
    industry: source.industry || alert.source_industry || '',
  };
}

export default function JobAlertsPage() {
  const { token, user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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

  const handleDelete = async (alertId) => {
    if (!window.confirm('Bạn có chắc muốn hủy nhận thông báo việc tương tự này?')) return;
    setActionId(alertId);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`${API}/${alertId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể hủy job alert');

      setAlerts((prev) => prev.filter((item) => item.id !== alertId));
      setNotice(data.message || 'Đã hủy nhận thông báo việc tương tự');
    } catch (err) {
      setError(err.message || 'Không thể hủy job alert');
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
            <h1 className="text-2xl font-bold text-gray-800">Thông báo việc tương tự</h1>
            <p className="text-sm text-gray-500">Quản lý các tin bạn đã bấm “Gửi cho tôi việc tương tự”.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          <b>{activeCount}</b> tin đang theo dõi
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

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-navy-600" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <Bell className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <h3 className="mb-2 text-lg font-bold text-gray-800">Chưa theo dõi việc tương tự</h3>
          <p className="mx-auto max-w-xl text-sm text-gray-500">
            Mở một tin tuyển dụng phù hợp và bấm “Gửi cho tôi việc tương tự” để hệ thống gửi digest khi có tin liên quan.
          </p>
          <Link
            to={backRoute}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-navy-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-800"
          >
            <Search className="h-4 w-4" />
            Tìm việc phù hợp
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const sourceJob = getSourceJob(alert);
            const sourceJobRoute = getJobDetailRoute(user?.role_code, sourceJob.id);

            return (
              <div key={alert.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                      <Bell className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">Đang nhận việc tương tự</p>
                      <Link to={sourceJobRoute} className="line-clamp-2 text-lg font-bold text-gray-800 transition hover:text-navy-700">
                        {sourceJob.title}
                      </Link>
                      <p className="mt-1 line-clamp-1 text-sm text-gray-500">{sourceJob.companyName}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-600">
                        {sourceJob.location ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1">
                            <MapPin className="h-3.5 w-3.5 text-gray-400" />
                            {sourceJob.location}
                          </span>
                        ) : null}
                        {sourceJob.salary ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                            <DollarSign className="h-3.5 w-3.5" />
                            {sourceJob.salary}
                          </span>
                        ) : null}
                        {sourceJob.industry ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-3 py-1 text-navy-700">
                            <Briefcase className="h-3.5 w-3.5" />
                            {sourceJob.industry}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          Digest gần nhất: {formatDateTime(alert.last_digest_sent_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(alert.id)}
                    disabled={actionId === alert.id}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    {actionId === alert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Hủy nhận
                  </button>
                </div>

                <div className="mt-5 border-t border-gray-100 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-800">Việc tương tự đang có</h4>
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
                      Chưa có tin tương tự ngay lúc này.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
