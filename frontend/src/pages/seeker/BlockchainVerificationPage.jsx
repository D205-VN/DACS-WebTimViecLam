import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Copy,
  ExternalLink,
  FileCheck2,
  GraduationCap,
  Link2,
  Loader2,
  Plus,
  ShieldCheck,
  ShieldEllipsis,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import SeekerToolsNav from '@features/seeker-tools/SeekerToolsNav';
import { getBackLabelByRole, getDefaultRouteByRole } from '@shared/utils/roleRedirect';
import API_BASE_URL from '@shared/api/baseUrl';

const API = `${API_BASE_URL}/api/verification`;

const initialCertificateForm = {
  certificate_name: '',
  issuer_name: '',
  credential_id: '',
  issue_date: '',
  expiry_date: '',
  document_url: '',
  notes: '',
};

const initialWorkHistoryForm = {
  company_name: '',
  job_title: '',
  employment_type: '',
  start_date: '',
  end_date: '',
  currently_working: false,
  summary: '',
};

function getStatusTone(status) {
  if (status === 'revoked') {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
}

function formatDate(value) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function resolvePublicUrl(publicUrl, verificationCode) {
  const basePath = publicUrl || `/verify/${verificationCode}`;
  if (/^https?:\/\//i.test(basePath)) return basePath;
  if (typeof window === 'undefined') return basePath;
  return `${window.location.origin}${basePath.startsWith('/') ? basePath : `/${basePath}`}`;
}

export default function BlockchainVerificationPage() {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState({
    cvs: [],
    certificates: [],
    workHistories: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [certificateForm, setCertificateForm] = useState(initialCertificateForm);
  const [workHistoryForm, setWorkHistoryForm] = useState(initialWorkHistoryForm);
  const [submittingCertificate, setSubmittingCertificate] = useState(false);
  const [submittingWorkHistory, setSubmittingWorkHistory] = useState(false);
  const [notarizingCvId, setNotarizingCvId] = useState(null);
  const [revokingCertificateId, setRevokingCertificateId] = useState(null);
  const [revokingWorkHistoryId, setRevokingWorkHistoryId] = useState(null);
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const backLabel = getBackLabelByRole(user?.role_code);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API}/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể tải dữ liệu blockchain verification');
      setOverview({
        cvs: data.data?.cvs || [],
        certificates: data.data?.certificates || [],
        workHistories: data.data?.workHistories || [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const summary = useMemo(() => ({
    notarizedCvs: overview.cvs.filter((item) => item.verification_code).length,
    activeCertificates: overview.certificates.filter((item) => item.status !== 'revoked').length,
    activeWorkHistories: overview.workHistories.filter((item) => item.status !== 'revoked').length,
  }), [overview]);

  const handleCopy = async (text, successMessage) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(successMessage);
    } catch {
      setError('Không thể sao chép vào clipboard');
    }
  };

  const handleNotarizeCv = async (cvId) => {
    setNotarizingCvId(cvId);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`${API}/cvs/${cvId}/notarize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể notarize CV');
      setNotice(data.message || 'Đã xác thực CV lên blockchain ledger.');
      await fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setNotarizingCvId(null);
    }
  };

  const handleCreateCertificate = async (event) => {
    event.preventDefault();
    setSubmittingCertificate(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`${API}/certificates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(certificateForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể tạo chứng chỉ xác thực');
      setCertificateForm(initialCertificateForm);
      setNotice(data.message || 'Đã thêm chứng chỉ lên blockchain ledger.');
      await fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingCertificate(false);
    }
  };

  const handleCreateWorkHistory = async (event) => {
    event.preventDefault();
    setSubmittingWorkHistory(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`${API}/work-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(workHistoryForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể tạo lịch sử làm việc xác thực');
      setWorkHistoryForm(initialWorkHistoryForm);
      setNotice(data.message || 'Đã thêm lịch sử làm việc lên blockchain ledger.');
      await fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingWorkHistory(false);
    }
  };

  const handleRevokeCertificate = async (id) => {
    setRevokingCertificateId(id);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`${API}/certificates/${id}/revoke`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể thu hồi chứng chỉ');
      setNotice(data.message || 'Đã thu hồi chứng chỉ xác thực.');
      await fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setRevokingCertificateId(null);
    }
  };

  const handleRevokeWorkHistory = async (id) => {
    setRevokingWorkHistoryId(id);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`${API}/work-history/${id}/revoke`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể thu hồi lịch sử làm việc');
      setNotice(data.message || 'Đã thu hồi lịch sử làm việc xác thực.');
      await fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setRevokingWorkHistoryId(null);
    }
  };

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-all focus:border-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-200';
  const textareaClass = `${inputClass} min-h-[110px] resize-y`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link to={backRoute} className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 via-cyan-100 to-indigo-100">
            <ShieldCheck className="h-7 w-7 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Blockchain Verification</h1>
            <p className="mt-1 text-sm text-gray-500">
              Neo hash cho CV, chứng chỉ và lịch sử làm việc để chia sẻ mã xác thực minh bạch.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">CV đã neo</p>
            <p className="mt-2 text-2xl font-bold text-gray-800">{summary.notarizedCvs}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Chứng chỉ active</p>
            <p className="mt-2 text-2xl font-bold text-gray-800">{summary.activeCertificates}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Kinh nghiệm active</p>
            <p className="mt-2 text-2xl font-bold text-gray-800">{summary.activeWorkHistories}</p>
          </div>
        </div>
      </div>

      <SeekerToolsNav />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-navy-600" />
        </div>
      ) : (
        <div className="space-y-8">
          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-50 text-navy-700">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Xác thực CV</h2>
                <p className="text-sm text-gray-500">Mỗi lần neo sẽ tạo một mã tra cứu công khai cho phiên bản CV hiện tại.</p>
              </div>
            </div>

            {overview.cvs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
                Bạn chưa có CV nào để xác thực. Hãy tạo hoặc import CV trước.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {overview.cvs.map((cv) => (
                  <div key={cv.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold text-gray-800">{cv.title}</h3>
                        <p className="mt-1 text-sm text-gray-500">{cv.target_role || 'Chưa rõ vị trí'}</p>
                        {cv.current_location ? (
                          <p className="mt-1 text-xs text-gray-400">Khu vực: {cv.current_location}</p>
                        ) : null}
                      </div>
                      {cv.is_primary ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          CV chính
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-gray-600">
                      <p>Ngày tạo: {formatDate(cv.created_at)}</p>
                      <p>
                        Trạng thái chuỗi khối:{' '}
                        <span className={cv.verification_code ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                          {cv.verification_code ? 'Đã xác thực' : 'Chưa xác thực'}
                        </span>
                      </p>
                      {cv.verification_code ? (
                        <p className="font-mono text-xs text-gray-500 break-all">{cv.verification_code}</p>
                      ) : null}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleNotarizeCv(cv.id)}
                        disabled={notarizingCvId === cv.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-70"
                      >
                        {notarizingCvId === cv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldEllipsis className="h-4 w-4" />}
                        {cv.verification_code ? 'Cập nhật blockchain' : 'Ghi lên blockchain'}
                      </button>
                      {cv.public_url ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopy(resolvePublicUrl(cv.public_url, cv.verification_code), 'Đã sao chép link xác thực CV.')}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <Copy className="h-4 w-4" /> Sao chép link
                          </button>
                          <a
                            href={resolvePublicUrl(cv.public_url, cv.verification_code)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <ExternalLink className="h-4 w-4" /> Xem public
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-8 xl:grid-cols-[0.95fr,1.05fr]">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Chứng chỉ</h2>
                  <p className="text-sm text-gray-500">Thêm claim chứng chỉ để tạo mã xác thực và link public.</p>
                </div>
              </div>

              <form onSubmit={handleCreateCertificate} className="space-y-4">
                <input
                  value={certificateForm.certificate_name}
                  onChange={(event) => setCertificateForm((prev) => ({ ...prev, certificate_name: event.target.value }))}
                  className={inputClass}
                  placeholder="Tên chứng chỉ"
                  required
                />
                <input
                  value={certificateForm.issuer_name}
                  onChange={(event) => setCertificateForm((prev) => ({ ...prev, issuer_name: event.target.value }))}
                  className={inputClass}
                  placeholder="Đơn vị cấp"
                  required
                />
                <input
                  value={certificateForm.credential_id}
                  onChange={(event) => setCertificateForm((prev) => ({ ...prev, credential_id: event.target.value }))}
                  className={inputClass}
                  placeholder="Mã credential / certificate ID"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="date"
                    value={certificateForm.issue_date}
                    onChange={(event) => setCertificateForm((prev) => ({ ...prev, issue_date: event.target.value }))}
                    className={inputClass}
                  />
                  <input
                    type="date"
                    value={certificateForm.expiry_date}
                    onChange={(event) => setCertificateForm((prev) => ({ ...prev, expiry_date: event.target.value }))}
                    className={inputClass}
                  />
                </div>
                <input
                  value={certificateForm.document_url}
                  onChange={(event) => setCertificateForm((prev) => ({ ...prev, document_url: event.target.value }))}
                  className={inputClass}
                  placeholder="Link file hoặc link chứng chỉ"
                />
                <textarea
                  value={certificateForm.notes}
                  onChange={(event) => setCertificateForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className={textareaClass}
                  placeholder="Ghi chú thêm về chứng chỉ"
                />
                <button
                  type="submit"
                  disabled={submittingCertificate}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-70"
                >
                  {submittingCertificate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Ghi chứng chỉ
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Danh sách chứng chỉ đã xác thực</h2>
                  <p className="text-sm text-gray-500">Claim bị thu hồi vẫn giữ lại dấu vết chuỗi để phục vụ kiểm tra.</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {overview.certificates.length} mục
                </span>
              </div>

              <div className="space-y-4">
                {overview.certificates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
                    Chưa có chứng chỉ nào được ghi lên blockchain ledger.
                  </div>
                ) : (
                  overview.certificates.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-bold text-gray-800">{item.certificate_name}</h3>
                          <p className="mt-1 text-sm text-gray-500">{item.issuer_name}</p>
                          {item.credential_id ? (
                            <p className="mt-1 font-mono text-xs text-gray-400">{item.credential_id}</p>
                          ) : null}
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(item.status)}`}>
                          {item.status === 'revoked' ? 'Thu hồi' : 'Active'}
                        </span>
                      </div>

                      <div className="mt-4 space-y-1 text-sm text-gray-600">
                        <p>Ngày cấp: {formatDate(item.issue_date)}</p>
                        <p>Hết hạn: {item.expiry_date ? formatDate(item.expiry_date) : 'Không có'}</p>
                        <p className="font-mono text-xs text-gray-500 break-all">{item.verification_code}</p>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {item.public_url ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopy(resolvePublicUrl(item.public_url, item.verification_code), 'Đã sao chép link xác thực chứng chỉ.')}
                              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <Copy className="h-4 w-4" /> Sao chép link
                            </button>
                            <a
                              href={resolvePublicUrl(item.public_url, item.verification_code)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <Link2 className="h-4 w-4" /> Xem public
                            </a>
                          </>
                        ) : null}
                        {item.status !== 'revoked' ? (
                          <button
                            type="button"
                            onClick={() => handleRevokeCertificate(item.id)}
                            disabled={revokingCertificateId === item.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-70"
                          >
                            {revokingCertificateId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Thu hồi
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-8 xl:grid-cols-[0.95fr,1.05fr]">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Lịch sử làm việc</h2>
                  <p className="text-sm text-gray-500">Ghi nhận từng chặng kinh nghiệm để tạo proof công khai cho hồ sơ.</p>
                </div>
              </div>

              <form onSubmit={handleCreateWorkHistory} className="space-y-4">
                <input
                  value={workHistoryForm.company_name}
                  onChange={(event) => setWorkHistoryForm((prev) => ({ ...prev, company_name: event.target.value }))}
                  className={inputClass}
                  placeholder="Tên công ty"
                  required
                />
                <input
                  value={workHistoryForm.job_title}
                  onChange={(event) => setWorkHistoryForm((prev) => ({ ...prev, job_title: event.target.value }))}
                  className={inputClass}
                  placeholder="Chức danh"
                  required
                />
                <input
                  value={workHistoryForm.employment_type}
                  onChange={(event) => setWorkHistoryForm((prev) => ({ ...prev, employment_type: event.target.value }))}
                  className={inputClass}
                  placeholder="Hình thức làm việc"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="date"
                    value={workHistoryForm.start_date}
                    onChange={(event) => setWorkHistoryForm((prev) => ({ ...prev, start_date: event.target.value }))}
                    className={inputClass}
                  />
                  <input
                    type="date"
                    value={workHistoryForm.end_date}
                    onChange={(event) => setWorkHistoryForm((prev) => ({ ...prev, end_date: event.target.value }))}
                    className={inputClass}
                    disabled={workHistoryForm.currently_working}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <input
                    type="checkbox"
                    checked={workHistoryForm.currently_working}
                    onChange={(event) =>
                      setWorkHistoryForm((prev) => ({
                        ...prev,
                        currently_working: event.target.checked,
                        end_date: event.target.checked ? '' : prev.end_date,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-navy-600 focus:ring-navy-200"
                  />
                  Tôi vẫn đang làm ở vị trí này
                </label>
                <textarea
                  value={workHistoryForm.summary}
                  onChange={(event) => setWorkHistoryForm((prev) => ({ ...prev, summary: event.target.value }))}
                  className={textareaClass}
                  placeholder="Tóm tắt trách nhiệm, dự án hoặc kết quả chính"
                />
                <button
                  type="submit"
                  disabled={submittingWorkHistory}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-70"
                >
                  {submittingWorkHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Ghi lịch sử làm việc
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Lịch sử làm việc đã xác thực</h2>
                  <p className="text-sm text-gray-500">Mỗi record là một block có thể mở công khai theo verification code.</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {overview.workHistories.length} mục
                </span>
              </div>

              <div className="space-y-4">
                {overview.workHistories.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
                    Chưa có lịch sử làm việc nào được ghi lên blockchain ledger.
                  </div>
                ) : (
                  overview.workHistories.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-bold text-gray-800">{item.job_title}</h3>
                          <p className="mt-1 text-sm text-gray-500">{item.company_name}</p>
                          {item.employment_type ? (
                            <p className="mt-1 text-xs text-gray-400">{item.employment_type}</p>
                          ) : null}
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(item.status)}`}>
                          {item.status === 'revoked' ? 'Thu hồi' : 'Active'}
                        </span>
                      </div>

                      <div className="mt-4 space-y-1 text-sm text-gray-600">
                        <p>
                          Thời gian: {formatDate(item.start_date)} - {item.currently_working ? 'Hiện tại' : formatDate(item.end_date)}
                        </p>
                        <p className="font-mono text-xs text-gray-500 break-all">{item.verification_code}</p>
                      </div>

                      {item.summary ? (
                        <p className="mt-3 text-sm leading-6 text-gray-600">{item.summary}</p>
                      ) : null}

                      <div className="mt-5 flex flex-wrap gap-2">
                        {item.public_url ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopy(resolvePublicUrl(item.public_url, item.verification_code), 'Đã sao chép link xác thực lịch sử làm việc.')}
                              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <Copy className="h-4 w-4" /> Sao chép link
                            </button>
                            <a
                              href={resolvePublicUrl(item.public_url, item.verification_code)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <ExternalLink className="h-4 w-4" /> Xem public
                            </a>
                          </>
                        ) : null}
                        {item.status !== 'revoked' ? (
                          <button
                            type="button"
                            onClick={() => handleRevokeWorkHistory(item.id)}
                            disabled={revokingWorkHistoryId === item.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-70"
                          >
                            {revokingWorkHistoryId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Thu hồi
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
