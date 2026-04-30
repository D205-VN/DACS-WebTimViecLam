import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Send,
  MapPin,
  DollarSign,
  Clock,
  Briefcase,
  ArrowLeft,
  Loader2,
  CalendarClock,
  Video,
  ExternalLink,
  Building2,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import ConversationModal from '@features/messages/ConversationModal';
import { getBackLabelByRole, getDefaultRouteByRole, getJobDetailRoute } from '@shared/utils/roleRedirect';
import API_BASE_URL from '@shared/api/baseUrl';

const API = `${API_BASE_URL}/api/jobs`;

const statusMap = {
  pending: { label: 'Đang chờ', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  interview: { label: 'Mời phỏng vấn', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  hired: { label: 'Đã được duyệt', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  rejected: { label: 'Từ chối', color: 'bg-red-50 text-red-600 border-red-200' },
};

function formatInterviewMode(mode) {
  return mode === 'offline' ? 'Phỏng vấn offline' : 'Phỏng vấn online';
}

function formatDateTime(value) {
  if (!value) return 'Nhà tuyển dụng chưa chốt thời gian';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Nhà tuyển dụng chưa chốt thời gian';

  return parsed.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AppliedJobsPage() {
  const { token, user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preferenceLoadingId, setPreferenceLoadingId] = useState(null);
  const [chatJob, setChatJob] = useState(null);
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const backLabel = getBackLabelByRole(user?.role_code);

  useEffect(() => {
    fetch(`${API}/applied`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload) => {
        setJobs(payload.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const handleSelectInterviewMode = async (applicationId, interviewMode) => {
    setPreferenceLoadingId(applicationId);
    try {
      const res = await fetch(`${API}/applications/${applicationId}/interview-preference`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ interview_mode: interviewMode }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu lựa chọn phỏng vấn');
      }

      setJobs((prev) =>
        prev.map((job) =>
          job.application_id === applicationId
            ? {
                ...job,
                candidate_interview_mode: data.data?.candidate_interview_mode || interviewMode,
                updated_at: data.data?.updated_at || job.updated_at,
              }
            : job
        )
      );
    } catch (err) {
      alert(err.message || 'Lỗi kết nối');
    } finally {
      setPreferenceLoadingId(null);
    }
  };

  return (
    <>
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to={backRoute} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
          <Send className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Việc làm đã ứng tuyển</h1>
          <p className="text-sm text-gray-500">{jobs.length} việc làm</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-navy-600" /></div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Send className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Bạn chưa ứng tuyển việc làm nào.</p>
          <Link to={backRoute} className="inline-block mt-4 text-sm font-semibold text-navy-700 hover:underline">Khám phá việc làm →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const status = statusMap[job.status] || statusMap.pending;
            const selectedMode = job.interview_mode || job.candidate_interview_mode || '';
            const hasInterviewFlow = Boolean(
              job.status === 'interview' ||
              job.interview_at ||
              job.interview_mode ||
              job.interview_link ||
              job.candidate_interview_mode
            );
            const canChooseMode = hasInterviewFlow && !job.interview_mode;
            const hasSchedule = Boolean(job.interview_at);

            return (
              <div key={job.application_id || job.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-navy-100 transition-all group">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-navy-500 to-cyan-500 rounded-xl flex items-center justify-center text-white shrink-0">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={getJobDetailRoute(user?.role_code, job.id)} className="block">
                        <h3 className="text-base font-bold text-gray-800 group-hover:text-navy-700 transition-colors uppercase">{job.title}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{job.company_name || 'Đang cập nhật'}</p>
                      </Link>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-lg border shrink-0 ${status.color}`}>{status.label}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      <span className="flex items-center gap-1 text-sm text-gray-500"><MapPin className="w-3.5 h-3.5" />{job.location || 'Chưa rõ'}</span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-success-600"><DollarSign className="w-3.5 h-3.5" />{job.salary || 'Thỏa thuận'}</span>
                      <span className="flex items-center gap-1 text-sm text-gray-500"><Clock className="w-3.5 h-3.5" />{new Date(job.applied_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                    </div>

                      <button
                        type="button"
                        onClick={() => setChatJob(job)}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Nhắn nhà tuyển dụng
                      </button>

                      {job.status === 'hired' && (
                        <Link
                          to={`/seeker/onboarding/${job.application_id}`}
                          className="mt-3 ml-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 shadow-md shadow-emerald-200"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Hoàn thiện hồ sơ nhận việc
                        </Link>
                      )}

                    {hasInterviewFlow ? (
                      <div className="mt-4 rounded-[1.5rem] border border-blue-100 bg-blue-50/70 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Vòng phỏng vấn</p>
                            <h4 className="mt-2 text-lg font-bold text-blue-900">Thông tin phỏng vấn</h4>
                            <p className="mt-1 text-sm text-blue-700">
                              Thời gian phỏng vấn chỉ để xem. Nhà tuyển dụng là bên điều chỉnh lịch.
                            </p>
                          </div>
                          {selectedMode ? (
                            <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                              {formatInterviewMode(selectedMode)}
                            </span>
                          ) : null}
                        </div>

                        {canChooseMode ? (
                          <div className="mt-4">
                            <p className="text-sm font-semibold text-blue-900">Chọn cách phỏng vấn</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {['online', 'offline'].map((mode) => (
                                <button
                                  key={mode}
                                  type="button"
                                  disabled={preferenceLoadingId === job.application_id}
                                  onClick={() => handleSelectInterviewMode(job.application_id, mode)}
                                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                                    selectedMode === mode
                                      ? 'border-navy-700 bg-navy-700 text-white'
                                      : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-100'
                                  } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                  {preferenceLoadingId === job.application_id && selectedMode !== mode ? (
                                    <span className="inline-flex items-center gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Đang lưu...
                                    </span>
                                  ) : (
                                    formatInterviewMode(mode)
                                  )}
                                </button>
                              ))}
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 border border-blue-100">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ngày phỏng vấn</p>
                                <p className="mt-2 font-semibold text-slate-900">{formatDateTime(job.interview_at)}</p>
                              </div>
                              <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 border border-blue-100">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cách phỏng vấn</p>
                                <p className="mt-2 font-semibold text-slate-900">
                                  {selectedMode ? formatInterviewMode(selectedMode) : 'Bạn chưa chọn hình thức'}
                                </p>
                              </div>
                            </div>
                            {selectedMode ? (
                              <p className="mt-3 text-sm text-blue-700">
                                Bạn đã chọn {formatInterviewMode(selectedMode).toLowerCase()}. Nhà tuyển dụng sẽ chốt thời gian và thông tin tương ứng.
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 border border-blue-100">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ngày phỏng vấn</p>
                                <p className="mt-2 font-semibold text-slate-900">{formatDateTime(job.interview_at)}</p>
                              </div>
                              <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 border border-blue-100">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cách phỏng vấn</p>
                                <p className="mt-2 font-semibold text-slate-900">
                                  {selectedMode ? formatInterviewMode(selectedMode) : 'Nhà tuyển dụng đang cập nhật'}
                                </p>
                              </div>
                            </div>

                            {selectedMode === 'online' ? (
                              <div className="rounded-2xl border border-white/70 bg-white px-4 py-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">Phỏng vấn online</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      {hasSchedule
                                        ? 'Thời gian phỏng vấn đã được nhà tuyển dụng xác nhận. Link video call chỉ để xem và tham gia.'
                                        : 'Nhà tuyển dụng đang cập nhật thời gian phỏng vấn online.'}
                                    </p>
                                  </div>
                                  <Video className="h-5 w-5 text-blue-500" />
                                </div>

                                {job.interview_link ? (
                                  <a
                                    href={job.interview_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
                                  >
                                    Video call <ExternalLink className="h-4 w-4" />
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    disabled
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed"
                                  >
                                    Video call
                                  </button>
                                )}
                              </div>
                            ) : selectedMode === 'offline' ? (
                              <div className="rounded-2xl border border-white/70 bg-white px-4 py-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">Phỏng vấn offline</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      Địa chỉ công ty chỉ để xem. Nhà tuyển dụng sẽ là bên điều chỉnh lịch phỏng vấn.
                                    </p>
                                  </div>
                                  <Building2 className="h-5 w-5 text-blue-500" />
                                </div>
                                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                                  {job.company_address || 'Chưa cập nhật địa chỉ công ty'}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-blue-700">
                                Chờ nhà tuyển dụng và bạn thống nhất hình thức phỏng vấn.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    <ConversationModal
      open={Boolean(chatJob)}
      applicationId={chatJob?.application_id}
      initialTitle={chatJob?.company_name}
      onClose={() => setChatJob(null)}
    />
    </>
  );
}
