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
  BrainCircuit,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@components/providers/AuthContext';
import { getBackLabelByRole, getDefaultRouteByRole, getJobDetailRoute, getRouteByRole } from '@services/navigation/roleRedirect';
import { getSeekerAiTestPath } from '@services/ai-tests/aiTestRoutes';
import API_BASE_URL from '@services/http/baseUrl';

const API = `${API_BASE_URL}/api/jobs`;

const statusMap = {
  pending: { label: 'Đang chờ', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  approved: { label: 'Đã duyệt hồ sơ', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  interview: { label: 'Mời phỏng vấn', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  hired: { label: 'Trúng tuyển', color: 'bg-violet-50 text-violet-600 border-violet-200' },
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

function formatAITestType(type) {
  if (type === 'video_ai') return 'Video AI + tự luận';
  if (type === 'avatar_live3d' || type === 'avatar_live2d') return 'Avatar Live3D + tự luận';
  return 'Trắc nghiệm';
}

function formatSubmissionScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? `${score.toFixed(1)} điểm` : 'Đã nộp';
}

export default function AppliedJobsPage() {
  const { token, user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preferenceLoadingId, setPreferenceLoadingId] = useState(null);
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
    <div className="aw-container max-w-5xl py-6">
      <Link to={backRoute} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      <div className="aw-surface mb-4 flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
          <Send className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Việc làm đã ứng tuyển</h1>
          <p className="text-sm text-gray-500">{jobs.length} việc làm</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : jobs.length === 0 ? (
        <div className="aw-surface p-12 text-center">
          <Send className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Bạn chưa ứng tuyển việc làm nào.</p>
          <Link to={backRoute} className="inline-block mt-4 text-sm font-semibold text-indigo-700 hover:underline">Khám phá việc làm →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const status = statusMap[job.status] || statusMap.pending;
            const selectedMode = job.interview_mode || job.candidate_interview_mode || '';
            const hasInterviewFlow = Boolean(
              job.status === 'approved' ||
              job.status === 'interview' ||
              job.interview_at ||
              job.interview_mode ||
              job.interview_link ||
              job.candidate_interview_mode
            );
            const canChooseMode = hasInterviewFlow && !job.interview_mode;
            const hasSchedule = Boolean(job.interview_at);
            const aiTest = job.ai_test;
            const testSubmission = aiTest?.submission;
            const testCompleted = Boolean(
              testSubmission?.completed_at ||
              testSubmission?.status === 'completed' ||
              testSubmission?.status === 'graded'
            );
            const testInProgress = testSubmission?.status === 'in_progress' && !testCompleted;

            return (
              <div key={job.application_id || job.id} className="aw-surface group p-5 transition-colors hover:border-gray-300 hover:bg-indigo-50/30">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center text-white shrink-0">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={getJobDetailRoute(user?.role_code, job.id)} className="block">
                        <h3 className="line-clamp-2 text-base font-bold text-gray-900 transition-colors group-hover:text-indigo-700">{job.title}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{job.company_name || 'Đang cập nhật'}</p>
                      </Link>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-lg border shrink-0 ${status.color}`}>{status.label}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      <span className="flex items-center gap-1 text-sm text-gray-500"><MapPin className="w-3.5 h-3.5" />{job.location || 'Chưa rõ'}</span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-success-600"><DollarSign className="w-3.5 h-3.5" />{job.salary || 'Thỏa thuận'}</span>
                      <span className="flex items-center gap-1 text-sm text-gray-500"><Clock className="w-3.5 h-3.5" />{new Date(job.applied_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                    </div>

                      <Link
                        to={`${getRouteByRole(user?.role_code, 'messages')}?applicationId=${job.application_id}`}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Nhắn nhà tuyển dụng
                      </Link>

                      {job.status === 'hired' && (
                        <Link
                          to={`/seeker/onboarding/${job.application_id}`}
                          className="mt-3 ml-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700  shadow-emerald-200"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Hoàn thiện hồ sơ nhận việc
                        </Link>
                      )}

                    {aiTest ? (
                      <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/80 p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-violet-700 shadow-sm">
                              <BrainCircuit className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500">Bài test AI</p>
                              <h4 className="mt-1 text-base font-bold text-violet-950">{aiTest.title}</h4>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-violet-700">
                                <span className="rounded-full bg-white px-2.5 py-1 border border-violet-100">
                                  {formatAITestType(aiTest.test_type)}
                                </span>
                                <span className="rounded-full bg-white px-2.5 py-1 border border-violet-100">
                                  {aiTest.duration || 60} phút
                                </span>
                                {testCompleted ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 border border-emerald-100">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {formatSubmissionScore(testSubmission?.total_score)}
                                  </span>
                                ) : testInProgress ? (
                                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 border border-amber-100">
                                    Đang làm
                                  </span>
                                ) : null}
                              </div>
                              {aiTest.description ? (
                                <p className="mt-2 line-clamp-2 text-sm text-violet-700">{aiTest.description}</p>
                              ) : null}
                            </div>
                          </div>

                          <Link
                            to={getSeekerAiTestPath(aiTest.id, aiTest.test_type)}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800"
                          >
                            <BrainCircuit className="h-4 w-4" />
                            {testCompleted ? 'Làm lại bài test' : 'Làm bài test'}
                          </Link>
                        </div>
                      </div>
                    ) : null}

                    {hasInterviewFlow ? (
                      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-4">
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
                                  className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                                    selectedMode === mode
                                      ? 'border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
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
                              <div className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700 border border-blue-100">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ngày phỏng vấn</p>
                                <p className="mt-2 font-semibold text-slate-900">{formatDateTime(job.interview_at)}</p>
                              </div>
                              <div className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700 border border-blue-100">
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
                              <div className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700 border border-blue-100">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ngày phỏng vấn</p>
                                <p className="mt-2 font-semibold text-slate-900">{formatDateTime(job.interview_at)}</p>
                              </div>
                              <div className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700 border border-blue-100">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cách phỏng vấn</p>
                                <p className="mt-2 font-semibold text-slate-900">
                                  {selectedMode ? formatInterviewMode(selectedMode) : 'Nhà tuyển dụng đang cập nhật'}
                                </p>
                              </div>
                            </div>

                            {selectedMode === 'online' ? (
                              <div className="rounded-lg border border-white/70 bg-white px-4 py-4">
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
                                  <Link
                                    to={`/interview-room/${job.interview_link.split('/interview-room/')[1] || ''}`}
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-indigo-700 hover:to-violet-700"
                                  >
                                    Xác nhận & vào phòng <ExternalLink className="h-4 w-4" />
                                  </Link>
                                ) : (
                                  <button
                                    type="button"
                                    disabled
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed"
                                  >
                                    Video call
                                  </button>
                                )}
                              </div>
                            ) : selectedMode === 'offline' ? (
                              <div className="rounded-lg border border-white/70 bg-white px-4 py-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">Phỏng vấn offline</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      Địa chỉ công ty chỉ để xem. Nhà tuyển dụng sẽ là bên điều chỉnh lịch phỏng vấn.
                                    </p>
                                  </div>
                                  <Building2 className="h-5 w-5 text-blue-500" />
                                </div>
                                <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
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
  );
}
