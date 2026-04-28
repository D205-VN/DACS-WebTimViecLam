import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Mail,
  Phone,
  Eye,
  CheckCircle,
  Loader2,
  Briefcase,
  XCircle,
  Clock,
  CalendarClock,
  Video,
  MapPin,
  X,
  ExternalLink,
  FileText,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import ConversationModal from '@features/messages/ConversationModal';
import API_BASE_URL from '@shared/api/baseUrl';
import UserAvatar from '@shared/ui/UserAvatar';

function getStatusMeta(status) {
  switch (status) {
    case 'interview':
      return { label: 'Phỏng vấn', className: 'bg-blue-100 text-blue-700' };
    case 'hired':
      return { label: 'Duyệt hồ sơ', className: 'bg-emerald-100 text-emerald-700' };
    case 'rejected':
      return { label: 'Từ chối', className: 'bg-red-100 text-red-700' };
    default:
      return { label: 'Chờ xử lý', className: 'bg-amber-100 text-amber-700' };
  }
}

function formatInterviewMode(mode) {
  return mode === 'offline' ? 'Offline tại công ty' : 'Online';
}

function formatDateTime(value) {
  if (!value) return 'Chưa có lịch';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Chưa có lịch';

  return parsed.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDate(value) {
  if (!value) return 'Chưa cập nhật';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getVerificationStatusMeta(status) {
  if (status === 'revoked') {
    return { label: 'Thu hồi', className: 'bg-red-100 text-red-700' };
  }

  return { label: 'Active', className: 'bg-emerald-100 text-emerald-700' };
}

function buildVerificationUrl(publicUrl, verificationCode) {
  if (publicUrl) return publicUrl;
  return verificationCode ? `/verify/${verificationCode}` : null;
}

function toDateTimeLocal(value) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const tzOffset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function ManageCandidatesTab() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStage, setActiveStage] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [candidateDetail, setCandidateDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [modalSection, setModalSection] = useState('profile');
  const [chatCandidate, setChatCandidate] = useState(null);
  const [interviewForm, setInterviewForm] = useState({
    interview_at: '',
    interview_mode: 'online',
    interview_link: '',
  });

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/candidates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCandidates(data.data || []);
        setError('');
      } else {
        setError(data.error || 'Lỗi khi tải danh sách ứng viên');
      }
    } catch (err) {
      console.error('Fetch candidates error:', err);
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchCandidates();
  }, [token, fetchCandidates]);

  const loadCandidateDetail = useCallback(async (applicationId) => {
    setDetailLoading(true);
    setDetailError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/candidates/${applicationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải hồ sơ ứng viên');
      }

      const detail = data.data || null;
      setCandidateDetail(detail);
      setInterviewForm({
        interview_at: toDateTimeLocal(detail?.interview_at),
        interview_mode: detail?.candidate_interview_mode || detail?.interview_mode || 'online',
        interview_link: detail?.interview_link || '',
      });
    } catch (err) {
      console.error('Load candidate detail error:', err);
      setCandidateDetail(null);
      setDetailError(err.message || 'Không thể tải hồ sơ ứng viên');
    } finally {
      setDetailLoading(false);
    }
  }, [token]);

  const openCandidateModal = async (applicationId, section = 'profile') => {
    setSelectedCandidateId(applicationId);
    setModalSection(section);
    await loadCandidateDetail(applicationId);
  };

  const closeCandidateModal = () => {
    setSelectedCandidateId(null);
    setCandidateDetail(null);
    setDetailError('');
    setModalSection('profile');
    setInterviewForm({
      interview_at: '',
      interview_mode: 'online',
      interview_link: '',
    });
  };

  const handleStatusUpdate = async (applicationId, newStatus) => {
    setActionLoading(applicationId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi cập nhật trạng thái');
      }

      await fetchCandidates();

      if (selectedCandidateId === applicationId) {
        setCandidateDetail((prev) => (prev ? { ...prev, status: data.data?.status || newStatus } : prev));
      }
    } catch (err) {
      alert(err.message || 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleScheduleInterview = async () => {
    if (!candidateDetail) return;

    const lockedMode = candidateDetail.candidate_interview_mode || candidateDetail.interview_mode || '';
    const resolvedMode = lockedMode || interviewForm.interview_mode;

    setScheduleLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/candidates/${candidateDetail.id}/interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          interview_at: interviewForm.interview_at,
          interview_mode: resolvedMode,
          interview_link: resolvedMode === 'online' ? interviewForm.interview_link : null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu lịch phỏng vấn');
      }

      const updated = data.data || {};
      setCandidateDetail((prev) => (
        prev
          ? {
              ...prev,
              status: updated.status || 'interview',
              interview_at: updated.interview_at || prev.interview_at,
              interview_mode: updated.interview_mode || prev.interview_mode,
              interview_link: updated.interview_link || null,
              company_address: updated.company_address || prev.company_address,
            }
          : prev
      ));
      setInterviewForm((prev) => ({
        ...prev,
        interview_at: toDateTimeLocal(updated.interview_at || prev.interview_at),
        interview_mode: updated.interview_mode || prev.interview_mode,
        interview_link: updated.interview_link || '',
      }));
      await fetchCandidates();
      setModalSection('interview');
    } catch (err) {
      alert(err.message || 'Lỗi kết nối');
    } finally {
      setScheduleLoading(false);
    }
  };

  const stages = [
    { id: 'all', label: 'Tất cả', count: candidates.length },
    { id: 'pending', label: 'Chờ xử lý', count: candidates.filter((c) => c.status === 'pending' || !c.status).length },
    { id: 'interview', label: 'Phỏng vấn', count: candidates.filter((c) => c.status === 'interview').length },
    { id: 'hired', label: 'Duyệt hồ sơ', count: candidates.filter((c) => c.status === 'hired').length },
    { id: 'rejected', label: 'Từ chối', count: candidates.filter((c) => c.status === 'rejected').length },
  ];

  const visibleCandidates = candidates.filter(
    (candidate) => activeStage === 'all' || (candidate.status || 'pending') === activeStage
  );
  const lockedInterviewMode = candidateDetail?.candidate_interview_mode || candidateDetail?.interview_mode || '';
  const resolvedInterviewMode = lockedInterviewMode || interviewForm.interview_mode;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-navy-700 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Đang tải danh sách ứng viên...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                activeStage === stage.id
                  ? 'bg-navy-700 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {stage.label}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  activeStage === stage.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {stage.count}
              </span>
            </button>
          ))}
        </div>

        {error ? (
          <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{error}</div>
        ) : null}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {visibleCandidates.length > 0 ? (
            visibleCandidates.map((candidate) => {
              const statusMeta = getStatusMeta(candidate.status);
              const preferredMode = candidate.candidate_interview_mode || candidate.interview_mode || '';

              return (
                <div
                  key={candidate.id}
                  className="p-6 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex gap-4 items-center">
                    <UserAvatar
                      src={candidate.avatar_url}
                      alt={candidate.candidate_name}
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100"
                      fallbackClassName="flex w-14 h-14 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 ring-2 ring-gray-100"
                      iconClassName="h-6 w-6 text-white"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-bold text-gray-800 text-lg">{candidate.candidate_name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                        {preferredMode ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600">
                            {formatInterviewMode(preferredMode)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-navy-600 font-semibold mb-2">
                        <Briefcase className="w-4 h-4" /> {candidate.job_title}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" /> {candidate.candidate_email}
                        </span>
                        {candidate.candidate_phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" /> {candidate.candidate_phone}
                          </span>
                        ) : null}
                        {candidate.interview_at ? (
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5" /> {formatDateTime(candidate.interview_at)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4 w-full lg:w-auto">
                    <div className="text-xs text-gray-400 font-medium">
                      Ứng tuyển: {new Date(candidate.created_at).toLocaleDateString('vi-VN')}
                    </div>

                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {actionLoading === candidate.id ? (
                        <div className="px-8 py-2">
                          <Loader2 className="w-5 h-5 animate-spin text-navy-600" />
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openCandidateModal(candidate.id, 'profile')}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
                          >
                            <Eye className="w-4 h-4" /> Xem hồ sơ
                          </button>
                          <button
                            type="button"
                            onClick={() => setChatCandidate(candidate)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-cyan-50 text-cyan-700 rounded-lg text-sm font-semibold hover:bg-cyan-100 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" /> Nhắn tin
                          </button>

                          {candidate.status === 'pending' || !candidate.status ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(candidate.id, 'hired')}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" /> Duyệt hồ sơ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(candidate.id, 'rejected')}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
                              >
                                <XCircle className="w-4 h-4" /> Từ chối
                              </button>
                            </>
                          ) : candidate.status === 'hired' ? (
                            <button
                              type="button"
                              onClick={() => openCandidateModal(candidate.id, 'interview')}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                            >
                              <Video className="w-4 h-4" /> Phỏng vấn
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">Không có ứng viên nào trong danh sách.</p>
            </div>
          )}
        </div>
      </div>

      {selectedCandidateId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/30">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Hồ sơ ứng viên</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  {candidateDetail?.candidate_name || 'Đang tải hồ sơ'}
                </h3>
                {candidateDetail?.job_title ? (
                  <p className="mt-2 text-sm text-slate-500">Ứng tuyển vào vị trí {candidateDetail.job_title}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeCandidateModal}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {candidateDetail && (candidateDetail.status === 'hired' || candidateDetail.status === 'rejected') ? (
              <div className="border-b border-slate-200 px-6">
                <div className="flex gap-1 overflow-x-auto">
                  {candidateDetail.status === 'hired' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setModalSection('profile')}
                        className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition ${
                          modalSection === 'profile'
                            ? 'border-navy-700 text-navy-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Eye className="w-4 h-4 inline mr-1.5" /> Hồ sơ
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalSection('interview')}
                        className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition ${
                          modalSection === 'interview'
                            ? 'border-navy-700 text-navy-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Video className="w-4 h-4 inline mr-1.5" /> Phỏng vấn
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalSection('approved')}
                        className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition ${
                          modalSection === 'approved'
                            ? 'border-navy-700 text-navy-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4 inline mr-1.5" /> Đã duyệt hồ sơ
                      </button>
                    </>
                  ) : candidateDetail.status === 'rejected' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setModalSection('profile')}
                        className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition ${
                          modalSection === 'profile'
                            ? 'border-navy-700 text-navy-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Eye className="w-4 h-4 inline mr-1.5" /> Hồ sơ
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalSection('rejected')}
                        className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition ${
                          modalSection === 'rejected'
                            ? 'border-navy-700 text-navy-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <XCircle className="w-4 h-4 inline mr-1.5" /> Từ chối
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-6">
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                  <Loader2 className="w-9 h-9 animate-spin text-navy-600" />
                  <p className="mt-4 text-sm font-medium">Đang tải hồ sơ ứng viên...</p>
                </div>
              ) : detailError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
                  {detailError}
                </div>
              ) : candidateDetail ? (
                <>
                  {(modalSection === 'profile' || (candidateDetail.status !== 'hired' && candidateDetail.status !== 'rejected')) && (
                    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                      <div className="space-y-6">
                    <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={candidateDetail.avatar_url}
                          alt={candidateDetail.candidate_name}
                          className="h-16 w-16 rounded-full object-cover ring-2 ring-white shadow-sm"
                          fallbackClassName="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700"
                          iconClassName="h-6 w-6 text-white"
                        />
                        <div>
                          <p className="text-lg font-bold text-slate-900">{candidateDetail.candidate_name}</p>
                          <p className="text-sm text-slate-500">{candidateDetail.candidate_email}</p>
                          {candidateDetail.candidate_phone ? (
                            <p className="text-sm text-slate-500">{candidateDetail.candidate_phone}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            getStatusMeta(candidateDetail.status).className
                          }`}
                        >
                          {getStatusMeta(candidateDetail.status).label}
                        </span>
                        {candidateDetail.candidate_interview_mode ? (
                          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                            Ứng viên chọn: {formatInterviewMode(candidateDetail.candidate_interview_mode)}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-5 space-y-3 text-sm text-slate-600">
                        <div className="flex items-start gap-2">
                          <Briefcase className="mt-0.5 h-4 w-4 text-slate-400" />
                          <span>{candidateDetail.job_title}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />
                          <span>Ứng tuyển lúc {formatDateTime(candidateDetail.created_at)}</span>
                        </div>
                        {candidateDetail.company_address ? (
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                            <span>{candidateDetail.company_address}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">CV ứng viên</p>
                            <h4 className="mt-1 text-lg font-bold text-slate-900">
                              {candidateDetail.cv_title || 'Hồ sơ CV đính kèm'}
                            </h4>
                            {candidateDetail.cv_target_role ? (
                              <p className="mt-1 text-sm text-slate-500">{candidateDetail.cv_target_role}</p>
                            ) : null}
                            {candidateDetail.cv_verification_code ? (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                  Blockchain verified
                                </span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {candidateDetail.cv_verification_code}
                                </span>
                                <a
                                  href={`/verify/${candidateDetail.cv_verification_code}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700 hover:text-navy-800"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Tra cứu
                                </a>
                              </div>
                            ) : null}
                        </div>
                        <div className="rounded-full bg-slate-100 p-2 text-slate-500">
                          <FileText className="h-5 w-5" />
                        </div>
                      </div>

                      {candidateDetail.cv_html_content ? (
                        <div className="max-h-[68vh] overflow-auto bg-slate-50 p-5">
                          <div
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                            dangerouslySetInnerHTML={{ __html: candidateDetail.cv_html_content }}
                          />
                        </div>
                      ) : candidateDetail.experience_summary ? (
                        <div className="p-5">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700 whitespace-pre-line">
                            {candidateDetail.experience_summary}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-slate-500">
                          <FileText className="h-10 w-10 text-slate-300" />
                          <p className="mt-4 text-sm font-medium">Ứng viên chưa có CV đính kèm để xem trực tiếp.</p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Blockchain Verification</p>
                          <h4 className="mt-1 text-lg font-bold text-slate-900">Lịch sử làm việc đã xác thực</h4>
                          <p className="mt-1 text-sm text-slate-500">Những công việc ứng viên đã ghi nhận qua blockchain verification.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {candidateDetail.work_histories?.length || 0} mục
                        </span>
                      </div>

                      {candidateDetail.work_histories?.length ? (
                        <div className="divide-y divide-slate-100">
                          {candidateDetail.work_histories.map((item) => {
                            const statusMeta = getVerificationStatusMeta(item.status);
                            const detailUrl = buildVerificationUrl(item.public_url, item.verification_code);

                            return (
                              <div key={item.id} className="p-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h5 className="text-base font-bold text-slate-900">{item.job_title}</h5>
                                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.className}`}>
                                        {statusMeta.label}
                                      </span>
                                      {item.verification_code ? (
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                          Blockchain verified
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-sm font-medium text-slate-600">{item.company_name}</p>
                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                                      <span>
                                        Thời gian: {formatDate(item.start_date)} - {item.currently_working ? 'Hiện tại' : formatDate(item.end_date)}
                                      </span>
                                      {item.employment_type ? <span>Hình thức: {item.employment_type}</span> : null}
                                    </div>
                                  </div>

                                  {detailUrl ? (
                                    <a
                                      href={detailUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-navy-800"
                                    >
                                      <ExternalLink className="h-4 w-4" /> Tra cứu
                                    </a>
                                  ) : null}
                                </div>

                                {item.summary ? (
                                  <p className="mt-4 text-sm leading-7 text-slate-600 whitespace-pre-line">{item.summary}</p>
                                ) : null}

                                {item.verification_code ? (
                                  <p className="mt-4 break-all font-mono text-xs text-slate-500">{item.verification_code}</p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="px-6 py-12 text-center text-sm text-slate-500">
                          Ứng viên chưa có lịch sử làm việc nào được ghi nhận để nhà tuyển dụng tra cứu.
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                )}

                  {modalSection === 'interview' && candidateDetail.status === 'hired' && (
                    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm max-h-[60vh] overflow-y-auto">
                      <div className="mb-6">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lịch phỏng vấn</p>
                        <h4 className="mt-2 text-lg font-bold text-slate-900">Thông tin phỏng vấn</h4>
                      </div>

                      <div className="space-y-4">
                          {lockedInterviewMode ? (
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Hình thức đã chọn
                              </p>
                              <p className="mt-2 text-sm font-semibold text-slate-800">
                                {formatInterviewMode(lockedInterviewMode)}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Chọn hình thức phỏng vấn
                              </p>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                {['online', 'offline'].map((mode) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setInterviewForm((prev) => ({ ...prev, interview_mode: mode }))}
                                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                                      interviewForm.interview_mode === mode
                                        ? 'border-navy-700 bg-navy-50 text-navy-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    {formatInterviewMode(mode)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Thời gian phỏng vấn
                            </label>
                            <input
                              type="datetime-local"
                              value={interviewForm.interview_at}
                              onChange={(event) =>
                                setInterviewForm((prev) => ({ ...prev, interview_at: event.target.value }))
                              }
                              className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
                            />
                          </div>

                          {resolvedInterviewMode === 'online' ? (
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Link video call
                              </label>
                              <input
                                type="url"
                                value={interviewForm.interview_link}
                                onChange={(event) =>
                                  setInterviewForm((prev) => ({ ...prev, interview_link: event.target.value }))
                                }
                                placeholder="https://meet.google.com/..."
                                className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
                              />
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Địa chỉ phỏng vấn offline
                              </p>
                              <p className="mt-2 font-medium text-slate-800">
                                {candidateDetail.company_address || 'Chưa cập nhật địa chỉ công ty'}
                              </p>
                            </div>
                          )}

                          {candidateDetail.interview_at ? (
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                              <p className="font-semibold">Lịch hiện tại</p>
                              <p className="mt-2">Thời gian: {formatDateTime(candidateDetail.interview_at)}</p>
                              <p className="mt-1">
                                Hình thức: {formatInterviewMode(candidateDetail.interview_mode || resolvedInterviewMode)}
                              </p>
                              {candidateDetail.interview_mode === 'online' && candidateDetail.interview_link ? (
                                <a
                                  href={candidateDetail.interview_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 inline-flex items-center gap-1.5 font-semibold text-emerald-800 hover:underline"
                                >
                                  Mở link video call <ExternalLink className="h-4 w-4" />
                                </a>
                              ) : null}
                            </div>
                          ) : null}

                          <button
                            type="button"
                            onClick={handleScheduleInterview}
                            disabled={scheduleLoading}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-navy-600 to-navy-800 px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-navy-700/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {scheduleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                            {candidateDetail.interview_at ? 'Cập nhật lịch phỏng vấn' : 'Lưu lịch phỏng vấn'}
                          </button>
                        </div>
                    </div>
                  )}

                  {modalSection === 'approved' && candidateDetail.status === 'hired' && (
                    <div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50 p-8 shadow-sm max-h-[60vh] overflow-y-auto">
                      <div className="flex items-center justify-center mb-6">
                        <CheckCircle className="w-16 h-16 text-emerald-600" />
                      </div>
                        <h3 className="text-center text-2xl font-bold text-emerald-900 mb-2">Hồ sơ đã được duyệt</h3>
                        <p className="text-center text-emerald-700 mb-6">
                          Ứng viên {candidateDetail.candidate_name} đã được duyệt vào ngày{' '}
                          {formatDateTime(candidateDetail.updated_at || candidateDetail.created_at)}
                        </p>
                        <div className="flex flex-col gap-3">
                          <div className="bg-white rounded-2xl p-4 border border-emerald-200">
                            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600 font-semibold">Tên ứng viên</p>
                            <p className="mt-2 text-lg font-bold text-emerald-900">{candidateDetail.candidate_name}</p>
                          </div>
                          <div className="bg-white rounded-2xl p-4 border border-emerald-200">
                            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600 font-semibold">Email</p>
                            <p className="mt-2 text-lg font-bold text-emerald-900">{candidateDetail.candidate_email}</p>
                          </div>
                          {candidateDetail.candidate_phone && (
                            <div className="bg-white rounded-2xl p-4 border border-emerald-200">
                              <p className="text-xs uppercase tracking-[0.18em] text-emerald-600 font-semibold">Số điện thoại</p>
                              <p className="mt-2 text-lg font-bold text-emerald-900">{candidateDetail.candidate_phone}</p>
                            </div>
                          )}
                          <div className="bg-white rounded-2xl p-4 border border-emerald-200">
                            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600 font-semibold">Vị trí ứng tuyển</p>
                            <p className="mt-2 text-lg font-bold text-emerald-900">{candidateDetail.job_title}</p>
                          </div>
                        </div>
                    </div>
                  )}

                  {modalSection === 'rejected' && candidateDetail.status === 'rejected' && (
                    <div className="rounded-[1.75rem] border border-red-100 bg-red-50 p-8 shadow-sm max-h-[60vh] overflow-y-auto">
                      <div className="flex items-center justify-center mb-6">
                        <XCircle className="w-16 h-16 text-red-600" />
                      </div>
                        <h3 className="text-center text-2xl font-bold text-red-900 mb-2">Hồ sơ đã bị từ chối</h3>
                        <p className="text-center text-red-700 mb-6">
                          Hồ sơ của {candidateDetail.candidate_name} đã bị từ chối vào ngày{' '}
                          {formatDateTime(candidateDetail.updated_at || candidateDetail.created_at)}
                        </p>
                        <div className="flex flex-col gap-3">
                          <div className="bg-white rounded-2xl p-4 border border-red-200">
                            <p className="text-xs uppercase tracking-[0.18em] text-red-600 font-semibold">Tên ứng viên</p>
                            <p className="mt-2 text-lg font-bold text-red-900">{candidateDetail.candidate_name}</p>
                          </div>
                          <div className="bg-white rounded-2xl p-4 border border-red-200">
                            <p className="text-xs uppercase tracking-[0.18em] text-red-600 font-semibold">Email</p>
                            <p className="mt-2 text-lg font-bold text-red-900">{candidateDetail.candidate_email}</p>
                          </div>
                          {candidateDetail.candidate_phone && (
                            <div className="bg-white rounded-2xl p-4 border border-red-200">
                              <p className="text-xs uppercase tracking-[0.18em] text-red-600 font-semibold">Số điện thoại</p>
                              <p className="mt-2 text-lg font-bold text-red-900">{candidateDetail.candidate_phone}</p>
                            </div>
                          )}
                          <div className="bg-white rounded-2xl p-4 border border-red-200">
                            <p className="text-xs uppercase tracking-[0.18em] text-red-600 font-semibold">Vị trí ứng tuyển</p>
                            <p className="mt-2 text-lg font-bold text-red-900">{candidateDetail.job_title}</p>
                          </div>
                        </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ConversationModal
        open={Boolean(chatCandidate)}
        applicationId={chatCandidate?.id}
        initialTitle={chatCandidate?.candidate_name}
        onClose={() => setChatCandidate(null)}
      />
    </>
  );
}
