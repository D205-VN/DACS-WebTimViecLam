import React, { useEffect, useMemo, useState } from 'react';
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
  CalendarDays,
  StickyNote,
  Link as LinkIcon,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const STATUS_META = {
  pending: { label: 'Chờ xử lý', className: 'bg-amber-100 text-amber-700' },
  interview: { label: 'Phỏng vấn', className: 'bg-blue-100 text-blue-700' },
  hired: { label: 'Đã tuyển', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Từ chối', className: 'bg-red-100 text-red-700' },
};

const DEFAULT_STATS = { total: 0, pending: 0, interview: 0, hired: 0, rejected: 0 };

function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.pending;
}

export default function ManageCandidatesTab() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStage, setActiveStage] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState({
    keyword: '',
    status: 'all',
    jobId: '',
    appliedFrom: '',
    appliedTo: '',
  });
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [interviewSaving, setInterviewSaving] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    interview_at: '',
    interview_mode: 'online',
    interview_link: '',
  });

  const fetchJobs = async () => {
    const res = await fetch('/api/employer/jobs', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setJobs(data.data || []);
    }
  };

  const fetchStats = async () => {
    const res = await fetch('/api/employer/candidates/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setStats(data.data || DEFAULT_STATS);
    }
  };

  const fetchCandidates = async () => {
    const params = new URLSearchParams();
    if (activeStage !== 'all') params.set('status', activeStage);
    if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim());
    if (filters.jobId) params.set('job_id', filters.jobId);
    if (filters.appliedFrom) params.set('applied_from', filters.appliedFrom);
    if (filters.appliedTo) params.set('applied_to', filters.appliedTo);

    const url = `/api/employer/candidates${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Lỗi khi tải danh sách ứng viên');
    }
    setCandidates(data.data || []);
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      await Promise.all([fetchCandidates(), fetchStats(), fetchJobs()]);
    } catch (err) {
      console.error('Fetch candidates error:', err);
      setError(err.message || 'Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadAll();
  }, [token, activeStage]);

  const filteredCandidates = useMemo(() => candidates, [candidates]);

  const stages = [
    { id: 'all', label: 'Tất cả', count: stats.total },
    { id: 'pending', label: 'Chờ xử lý', count: stats.pending },
    { id: 'interview', label: 'Phỏng vấn', count: stats.interview },
    { id: 'hired', label: 'Đã tuyển', count: stats.hired },
    { id: 'rejected', label: 'Từ chối', count: stats.rejected },
  ];

  const updateCandidateInState = (applicationId, updater) => {
    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.id === applicationId ? { ...candidate, ...updater(candidate) } : candidate
      )
    );
  };

  const handleStatusUpdate = async (applicationId, newStatus) => {
    const previous = candidates.find((candidate) => candidate.id === applicationId);
    if (!previous) return;

    updateCandidateInState(applicationId, () => ({ status: newStatus }));
    setActionLoading(applicationId);

    try {
      const res = await fetch(`/api/employer/candidates/${applicationId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi cập nhật trạng thái');

      const confirmedStatus = data.data?.status || newStatus;
      updateCandidateInState(applicationId, () => ({ status: confirmedStatus }));
      if (selectedCandidate?.id === applicationId) {
        setSelectedCandidate((prev) => ({ ...prev, status: confirmedStatus }));
      }
      fetchStats();
    } catch (err) {
      updateCandidateInState(applicationId, () => ({ status: previous.status }));
      alert(err.message || 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const openCandidateDetail = async (applicationId) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/employer/candidates/${applicationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi tải hồ sơ ứng viên');
      setSelectedCandidate(data.data);
      setNoteDraft(data.data.note || '');
      setInterviewForm({
        interview_at: data.data.interview_at ? new Date(data.data.interview_at).toISOString().slice(0, 16) : '',
        interview_mode: data.data.interview_mode || 'online',
        interview_link: data.data.interview_link || '',
      });
      setShowInterviewForm(false);
    } catch (err) {
      alert(err.message || 'Không thể tải hồ sơ ứng viên');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleNoteSave = async () => {
    if (!selectedCandidate) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/employer/candidates/${selectedCandidate.id}/note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: noteDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi lưu ghi chú');

      setSelectedCandidate((prev) => ({ ...prev, note: data.data?.note || noteDraft }));
      updateCandidateInState(selectedCandidate.id, () => ({ note: data.data?.note || noteDraft }));
    } catch (err) {
      alert(err.message || 'Không thể lưu ghi chú');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleScheduleInterview = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setInterviewSaving(true);
    try {
      const res = await fetch(`/api/employer/candidates/${selectedCandidate.id}/interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(interviewForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi lên lịch phỏng vấn');

      const updated = {
        status: data.data?.status || 'interview',
        interview_at: data.data?.interview_at || interviewForm.interview_at,
        interview_mode: data.data?.interview_mode || interviewForm.interview_mode,
        interview_link: data.data?.interview_link || interviewForm.interview_link,
      };

      setSelectedCandidate((prev) => ({ ...prev, ...updated }));
      updateCandidateInState(selectedCandidate.id, () => updated);
      setShowInterviewForm(false);
      fetchStats();
    } catch (err) {
      alert(err.message || 'Không thể lên lịch phỏng vấn');
    } finally {
      setInterviewSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-navy-700 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Đang tải danh sách ứng viên...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stages.map((stage) => (
          <button
            key={stage.id}
            onClick={() => setActiveStage(stage.id)}
            className={`p-4 rounded-xl text-left border transition-all ${
              activeStage === stage.id
                ? 'bg-navy-700 border-navy-700 text-white shadow-md'
                : 'bg-white border-gray-200 text-gray-700 hover:border-navy-200'
            }`}
          >
            <p className="text-sm font-semibold">{stage.label}</p>
            <p className="text-2xl font-bold mt-2">{stage.count}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={filters.keyword}
              onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
              placeholder="Tìm theo tên hoặc email"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-100"
            />
          </div>

          <select
            value={filters.jobId}
            onChange={(e) => setFilters((prev) => ({ ...prev, jobId: e.target.value }))}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-100"
          >
            <option value="">Tất cả vị trí</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>

          <button
            onClick={loadAll}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-navy-700 text-white rounded-xl text-sm font-semibold hover:bg-navy-800 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Áp dụng bộ lọc
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <input
            type="date"
            value={filters.appliedFrom}
            onChange={(e) => setFilters((prev) => ({ ...prev, appliedFrom: e.target.value }))}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-100"
          />
          <input
            type="date"
            value={filters.appliedTo}
            onChange={(e) => setFilters((prev) => ({ ...prev, appliedTo: e.target.value }))}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-100"
          />
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
        {filteredCandidates.length > 0 ? (
          filteredCandidates.map((candidate) => {
            const status = getStatusMeta(candidate.status);
            return (
              <div key={candidate.id} className="p-6 flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex gap-4 items-center min-w-0">
                  {candidate.avatar_url ? (
                    <img src={candidate.avatar_url} alt={candidate.candidate_name} className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-navy-500 to-navy-700 flex items-center justify-center text-white font-bold text-xl ring-2 ring-gray-100">
                      {candidate.candidate_name?.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-bold text-gray-800 text-lg">{candidate.candidate_name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-navy-600 font-semibold mb-2">
                      <Briefcase className="w-4 h-4" /> {candidate.job_title}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {candidate.candidate_email}</span>
                      {candidate.candidate_phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {candidate.candidate_phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start xl:items-end gap-4 w-full xl:w-auto">
                  <div className="text-xs text-gray-400 font-medium">
                    Ứng tuyển: {new Date(candidate.created_at).toLocaleDateString('vi-VN')}
                  </div>

                  <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    {actionLoading === candidate.id ? (
                      <div className="px-8 py-2"><Loader2 className="w-5 h-5 animate-spin text-navy-600" /></div>
                    ) : (
                      <>
                        <button
                          onClick={() => openCandidateDetail(candidate.id)}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" /> Hồ sơ
                        </button>

                        {candidate.status !== 'interview' && candidate.status !== 'hired' && (
                          <button
                            onClick={() => handleStatusUpdate(candidate.id, 'interview')}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                          >
                            <Clock className="w-4 h-4" /> Phỏng vấn
                          </button>
                        )}

                        {candidate.status !== 'hired' && (
                          <button
                            onClick={() => handleStatusUpdate(candidate.id, 'hired')}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" /> Tuyển
                          </button>
                        )}

                        {candidate.status !== 'rejected' && (
                          <button
                            onClick={() => handleStatusUpdate(candidate.id, 'rejected')}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
                          >
                            <XCircle className="w-4 h-4" /> Từ chối
                          </button>
                        )}
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

      {(selectedCandidate || detailLoading) && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Chi tiết ứng viên</h3>
                <p className="text-sm text-gray-500">Quản lý hồ sơ, ghi chú và lịch phỏng vấn</p>
              </div>
              <button onClick={() => setSelectedCandidate(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Đóng</button>
            </div>

            {detailLoading || !selectedCandidate ? (
              <div className="p-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-navy-700" />
              </div>
            ) : (
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-navy-700 text-white flex items-center justify-center font-bold text-lg">
                        {selectedCandidate.candidate_name?.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800">{selectedCandidate.candidate_name}</h4>
                        <p className="text-sm text-gray-500">{selectedCandidate.job_title}</p>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm text-gray-600">
                      <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> {selectedCandidate.candidate_email}</p>
                      <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> {selectedCandidate.candidate_phone || 'Chưa cập nhật'}</p>
                      <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Ứng tuyển: {new Date(selectedCandidate.created_at).toLocaleString('vi-VN')}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-gray-100">
                    <h4 className="font-bold text-gray-800 mb-3">Trạng thái & lịch phỏng vấn</h4>
                    <div className="space-y-3 text-sm">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${getStatusMeta(selectedCandidate.status).className}`}>
                        {getStatusMeta(selectedCandidate.status).label}
                      </span>
                      <p className="text-gray-600">Thời gian: {selectedCandidate.interview_at ? new Date(selectedCandidate.interview_at).toLocaleString('vi-VN') : 'Chưa có lịch'}</p>
                      <p className="text-gray-600">Hình thức: {selectedCandidate.interview_mode || 'Chưa thiết lập'}</p>
                      <p className="text-gray-600 break-all">Link: {selectedCandidate.interview_link || 'Chưa có link'}</p>
                      <button
                        onClick={() => setShowInterviewForm((prev) => !prev)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-100"
                      >
                        <CalendarDays className="w-4 h-4" />
                        {showInterviewForm ? 'Ẩn lịch phỏng vấn' : 'Lên lịch phỏng vấn'}
                      </button>
                    </div>
                  </div>
                </div>

                {showInterviewForm && (
                  <form onSubmit={handleScheduleInterview} className="bg-blue-50/60 border border-blue-100 rounded-xl p-5 space-y-4">
                    <h4 className="font-bold text-gray-800">Lên lịch phỏng vấn</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="datetime-local"
                        value={interviewForm.interview_at}
                        onChange={(e) => setInterviewForm((prev) => ({ ...prev, interview_at: e.target.value }))}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100"
                        required
                      />
                      <select
                        value={interviewForm.interview_mode}
                        onChange={(e) => setInterviewForm((prev) => ({ ...prev, interview_mode: e.target.value }))}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                      </select>
                      <input
                        type="text"
                        value={interviewForm.interview_link}
                        onChange={(e) => setInterviewForm((prev) => ({ ...prev, interview_link: e.target.value }))}
                        placeholder="Link meeting / địa điểm"
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={interviewSaving}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                    >
                      {interviewSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                      Lưu lịch phỏng vấn
                    </button>
                  </form>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <h4 className="font-bold text-gray-800 mb-3">CV & kinh nghiệm</h4>
                    <div className="space-y-3 text-sm text-gray-600">
                      <p className="flex items-center gap-2"><LinkIcon className="w-4 h-4" /> File CV: {selectedCandidate.cv_file_url ? selectedCandidate.cv_file_url : 'Chưa có file PDF'}</p>
                      <div>
                        <p className="font-semibold text-gray-700 mb-2">Tóm tắt kinh nghiệm</p>
                        <p className="whitespace-pre-wrap text-gray-600">{selectedCandidate.experience_summary || 'Chưa có dữ liệu CV text.'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <h4 className="font-bold text-gray-800 mb-3">Kỹ năng</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.skills?.length ? selectedCandidate.skills.map((skill) => (
                        <span key={skill} className="px-3 py-1 bg-navy-50 text-navy-700 rounded-full text-xs font-medium">{skill}</span>
                      )) : (
                        <p className="text-sm text-gray-500">Chưa trích xuất được kỹ năng từ CV.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <StickyNote className="w-4 h-4 text-navy-700" />
                    <h4 className="font-bold text-gray-800">Ghi chú nội bộ</h4>
                  </div>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Ví dụ: Ứng viên giao tiếp tốt, cần test thêm chuyên môn..."
                    className="w-full min-h-[120px] px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-100"
                  />
                  <button
                    onClick={handleNoteSave}
                    disabled={noteSaving}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-navy-700 text-white rounded-lg text-sm font-semibold hover:bg-navy-800 disabled:opacity-60"
                  >
                    {noteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
                    Lưu ghi chú
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
