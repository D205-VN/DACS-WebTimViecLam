import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Edit,
  Power,
  Trash2,
  Loader2,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  Briefcase,
  Clock,
  DollarSign,
  FileText,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';
import { useNavigate } from 'react-router-dom';
import { analyzeJobQuality, getTodayDateInputValue } from '@shared/utils/jobQuality';

function parseJobDeadline(deadline) {
  if (!deadline) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return new Date(`${deadline}T00:00:00`);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(deadline)) {
    const [day, month, year] = deadline.split('/');
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  const parsed = new Date(deadline);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeModerationStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return ['pending', 'approved', 'rejected'].includes(normalized) ? normalized : 'approved';
}

function isRecruitmentClosed(job) {
  const parsedDeadline = parseJobDeadline(job.deadline);
  return Boolean(parsedDeadline && parsedDeadline < new Date());
}

function getModerationMeta(job) {
  const status = normalizeModerationStatus(job.status);
  switch (status) {
    case 'pending':
      return {
        label: 'Chờ duyệt',
        className: 'bg-amber-100 text-amber-700',
        helper: 'Admin sẽ chấp nhận hoặc từ chối trước khi hiển thị công khai.',
      };
    case 'rejected':
      return {
        label: 'Từ chối',
        className: 'bg-red-100 text-red-700',
        helper: job.rejection_reason || 'Cần chỉnh sửa rồi gửi lại để admin xem xét.',
      };
    default:
      return {
        label: 'Đã duyệt',
        className: 'bg-emerald-100 text-emerald-700',
        helper: 'Tin đủ điều kiện hiển thị nếu chưa ngừng tuyển.',
      };
  }
}

function getRecruitmentMeta(job) {
  if (normalizeModerationStatus(job.status) !== 'approved') return null;

  if (isRecruitmentClosed(job)) {
    return {
      label: 'Ngừng tuyển',
      className: 'bg-red-50 text-red-700 border border-red-100',
    };
  }

  return {
    label: 'Đang hiển thị',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  };
}

export default function ManageJobsTab() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const [editingJob, setEditingJob] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    benefits: '',
    location: '',
    salary: '',
    job_type: 'Toàn thời gian',
    experience: 'Không yêu cầu',
    deadline: '',
    positions: 1,
  });

  const [viewingJob, setViewingJob] = useState(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setJobs(data.data || []);
        return;
      }

      setError(data.error || 'Lỗi khi tải danh sách tin');
    } catch (err) {
      console.error('Fetch jobs error:', err);
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchJobs();
  }, [token, fetchJobs]);

  const handleStatusChange = async (job) => {
    const moderationStatus = normalizeModerationStatus(job.status);
    if (moderationStatus !== 'approved') return;

    const recruitmentMeta = getRecruitmentMeta(job);
    const nextStatus = recruitmentMeta?.label === 'Đang hiển thị' ? 'Ngừng tuyển' : 'Đang tuyển';

    if (!window.confirm(`Bạn có chắc muốn chuyển tin này sang trạng thái "${nextStatus}"?`)) return;

    setActionLoading(job.id);
    setNotice(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/jobs/${job.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Lỗi khi cập nhật trạng thái');
        return;
      }

      setNotice({ type: 'success', text: data.message || 'Đã cập nhật trạng thái tin.' });
      fetchJobs();
    } catch (err) {
      console.error('Update job status error:', err);
      alert('Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm('Bạn có chắc muốn xóa tin tuyển dụng này? Hành động này không thể hoàn tác.')) return;

    setActionLoading(jobId);
    setNotice(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Lỗi khi xóa tin');
        return;
      }

      setJobs((prev) => prev.filter((job) => job.id !== jobId));
      setNotice({ type: 'success', text: data.message || 'Đã xóa tin tuyển dụng.' });
    } catch (err) {
      console.error('Delete job error:', err);
      alert('Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (job) => {
    setEditingJob(job);
    setEditFormData({
      title: job.title,
      description: job.job_description || job.description || '',
      requirements: job.job_requirements || job.requirements || '',
      benefits: job.benefits || '',
      location: job.job_address || job.location || '',
      salary: job.salary || '',
      job_type: job.job_type || 'Toàn thời gian',
      experience: job.years_of_experience || job.experience || 'Không yêu cầu',
      deadline: parseJobDeadline(job.deadline)?.toISOString().split('T')[0] || '',
      positions: job.number_candidate || job.positions || 1,
    });
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingJob) return;

    setActionLoading(editingJob.id);
    setNotice(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Lỗi khi cập nhật');
        return;
      }

      setEditingJob(null);
      setNotice({ type: 'success', text: data.message || 'Đã cập nhật tin tuyển dụng.' });
      fetchJobs();
    } catch (err) {
      console.error('Edit job error:', err);
      alert('Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = jobs.filter((job) => normalizeModerationStatus(job.status) === 'pending').length;
  const approvedCount = jobs.filter((job) => normalizeModerationStatus(job.status) === 'approved').length;
  const rejectedCount = jobs.filter((job) => normalizeModerationStatus(job.status) === 'rejected').length;
  const visibleCount = jobs.filter((job) => normalizeModerationStatus(job.status) === 'approved' && !isRecruitmentClosed(job)).length;
  const editJobQuality = analyzeJobQuality(editFormData);
  const todayInputValue = getTodayDateInputValue();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-navy-700 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Đang tải danh sách tin đăng...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Tổng tin', value: jobs.length, tone: 'bg-slate-50 text-slate-700 border-slate-200' },
          { label: 'Chờ duyệt', value: pendingCount, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Đã duyệt', value: approvedCount, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Đang hiển thị', value: visibleCount, tone: 'bg-blue-50 text-blue-700 border-blue-200' },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl border p-4 ${item.tone}`}>
            <p className="text-xs uppercase tracking-[0.16em]">{item.label}</p>
            <p className="mt-2 text-2xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Quản lý tin đăng</h3>
            <p className="text-xs text-gray-500">
              Tin mới của bạn sẽ ở trạng thái chờ duyệt cho đến khi admin chấp nhận hoặc từ chối.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {rejectedCount > 0 && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {rejectedCount} tin bị từ chối cần chỉnh sửa
              </div>
            )}
            <button
              onClick={() => navigate('/employer/post-job')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-navy-600 to-navy-800 text-white rounded-lg text-sm font-semibold hover:shadow-md transition-all"
            >
              <Plus className="w-4 h-4" /> Đăng tin mới
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`px-5 py-3 text-sm border-b ${
              notice.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-100'
            }`}
          >
            {notice.text}
          </div>
        )}

        {error && <div className="p-4 bg-red-50 text-red-600 text-sm border-b border-red-100">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1080px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-widest">
                <th className="p-4 rounded-tl-xl">Vị trí tuyển dụng</th>
                <th className="p-4">Kiểm duyệt</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-center">Ứng viên</th>
                <th className="p-4 text-center">7 ngày gần nhất</th>
                <th className="p-4">Hạn nộp</th>
                <th className="p-4 text-right rounded-tr-xl">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.length > 0 ? jobs.map((job) => {
                const moderationMeta = getModerationMeta(job);
                const recruitmentMeta = getRecruitmentMeta(job);
                const isApproved = normalizeModerationStatus(job.status) === 'approved';
                const isActionLoading = actionLoading === job.id;

                return (
                  <tr 
                    key={job.id} 
                    className={`hover:bg-slate-50/80 transition-all duration-300 ${isActionLoading ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => setViewingJob(job)}
                        className="font-bold text-slate-800 text-left hover:text-navy-600 transition-colors line-clamp-1"
                        title={job.title}
                      >
                        {job.title}
                      </button>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {job.location || 'Chưa cập nhật'}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className={`w-fit inline-flex px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full ${moderationMeta.className}`}>
                          {moderationMeta.label}
                        </span>
                        {normalizeModerationStatus(job.status) === 'rejected' && (
                           <span className="text-[10px] text-red-500 font-medium truncate max-w-[150px]" title={job.rejection_reason}>
                             {job.rejection_reason || 'Bị từ chối'}
                           </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      {recruitmentMeta ? (
                        <span className={`inline-flex px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full ${recruitmentMeta.className} shadow-sm`}>
                          {recruitmentMeta.label}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400 italic">
                          {normalizeModerationStatus(job.status) === 'pending'
                            ? 'Đang chờ'
                            : 'Đã ẩn'}
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-navy-50 text-navy-700 font-bold text-xs rounded-lg">
                        {job.applicant_count || 0}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 font-bold text-xs rounded-lg ${
                        parseInt(job.recent_applicant_count) > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-50 text-gray-400'
                      }`}>
                        {job.recent_applicant_count || 0}
                      </span>
                    </td>

                    <td className="p-4 text-sm font-medium text-slate-600">
                      {parseJobDeadline(job.deadline)?.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) || 'Không thời hạn'}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingJob(job)}
                          disabled={isActionLoading}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(job)}
                          disabled={isActionLoading}
                          className="p-2 text-slate-400 hover:text-navy-600 hover:bg-navy-50 rounded-lg transition-all"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {isApproved && (
                          <button
                            onClick={() => handleStatusChange(job)}
                            disabled={isActionLoading}
                            className={`p-2 rounded-lg transition-all ${
                              recruitmentMeta?.label === 'Đang hiển thị' 
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' 
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={recruitmentMeta?.label === 'Đang hiển thị' ? 'Ngừng tuyển' : 'Bật tuyển'}
                          >
                            {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(job.id)}
                          disabled={isActionLoading}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Xóa tin"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="7" className="p-20 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Briefcase className="w-12 h-12 text-slate-300 mb-3" />
                      <p className="font-medium">Bạn chưa đăng tin tuyển dụng nào.</p>
                      <button onClick={() => navigate('/employer/post-job')} className="mt-4 text-sm font-semibold text-navy-600 hover:text-navy-700">
                        + Tạo tin mới ngay
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingJob && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center text-navy-600">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Chi tiết tin tuyển dụng</h3>
                  <p className="text-sm text-gray-500">Theo dõi tình trạng kiểm duyệt trước khi tin hiển thị công khai.</p>
                </div>
              </div>
              <button onClick={() => setViewingJob(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8 border-b border-gray-100">
                <div className="md:col-span-2">
                  <h2 className="text-2xl font-extrabold text-navy-800 mb-4">{viewingJob.title}</h2>
                  <div className="flex flex-wrap gap-3 text-sm font-medium">
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-navy-50 text-navy-600 rounded-lg">
                      <MapPin className="w-4 h-4" /> {viewingJob.location || 'Chưa cập nhật'}
                    </span>
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <DollarSign className="w-4 h-4" /> {viewingJob.salary || 'Thỏa thuận'}
                    </span>
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg">
                      <Clock className="w-4 h-4" /> {viewingJob.job_type || 'Toàn thời gian'}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center gap-3 text-sm">
                    <span className="text-gray-500">Kiểm duyệt:</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getModerationMeta(viewingJob).className}`}>
                      {getModerationMeta(viewingJob).label}
                    </span>
                  </div>
                  {normalizeModerationStatus(viewingJob.status) === 'rejected' && viewingJob.rejection_reason && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                      <p className="font-bold mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Lý do từ chối:</p>
                      {viewingJob.rejection_reason}
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Hiển thị:</span>
                    <span className="font-bold text-gray-800">{getRecruitmentMeta(viewingJob)?.label || 'Chưa hiển thị'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Hạn nộp:</span>
                    <span className="font-bold text-gray-800">
                      {parseJobDeadline(viewingJob.deadline)?.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) || 'Không thời hạn'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Số lượng:</span>
                    <span className="font-bold text-gray-800">{viewingJob.positions || 1} người</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Kinh nghiệm:</span>
                    <span className="font-bold text-gray-800">{viewingJob.experience || 'Không yêu cầu'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {getModerationMeta(viewingJob).helper}
              </div>

              <div className="space-y-6">
                <section>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
                    <FileText className="w-5 h-5 text-navy-600" /> Mô tả công việc
                  </h4>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{viewingJob.job_description || viewingJob.description}</p>
                </section>

                <section>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
                    <AlertCircle className="w-5 h-5 text-navy-600" /> Yêu cầu ứng viên
                  </h4>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {viewingJob.job_requirements || viewingJob.requirements || 'Chưa có thông tin'}
                  </p>
                </section>

                <section>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-navy-600" /> Quyền lợi
                  </h4>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{viewingJob.benefits || 'Chưa có thông tin'}</p>
                </section>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button
                onClick={() => setViewingJob(null)}
                className="px-8 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setViewingJob(null);
                  openEditModal(viewingJob);
                }}
                className="px-8 py-2.5 bg-navy-700 text-white font-bold rounded-xl hover:bg-navy-800 transition-colors flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                {normalizeModerationStatus(viewingJob.status) === 'rejected' ? 'Chỉnh sửa và gửi lại' : 'Chỉnh sửa tin này'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingJob && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Chỉnh sửa tin tuyển dụng</h3>
                {normalizeModerationStatus(editingJob.status) !== 'approved' && (
                  <p className="text-sm text-amber-600 mt-1">Sau khi lưu, tin sẽ tiếp tục ở trạng thái chờ admin phê duyệt.</p>
                )}
              </div>
              <button onClick={() => setEditingJob(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Chất lượng tin</p>
                    <h4 className="mt-1 text-lg font-extrabold text-gray-800">{editJobQuality.score}/100 - {editJobQuality.label}</h4>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white sm:w-56">
                    <div
                      className={`h-full rounded-full ${
                        editJobQuality.tone === 'emerald' ? 'bg-emerald-500' : editJobQuality.tone === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${editJobQuality.score}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {editJobQuality.suggestions.slice(0, 4).map((item) => (
                    <p key={item.text} className="rounded-xl bg-white px-3 py-2 text-xs text-gray-600">{item.text}</p>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tiêu đề công việc</label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(event) => setEditFormData({ ...editFormData, title: event.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-100 outline-none"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mô tả công việc</label>
                  <textarea
                    value={editFormData.description}
                    onChange={(event) => setEditFormData({ ...editFormData, description: event.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-100 outline-none min-h-[120px]"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Yêu cầu</label>
                  <textarea
                    value={editFormData.requirements}
                    onChange={(event) => setEditFormData({ ...editFormData, requirements: event.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-100 outline-none min-h-[100px]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quyền lợi</label>
                  <textarea
                    value={editFormData.benefits}
                    onChange={(event) => setEditFormData({ ...editFormData, benefits: event.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-100 outline-none min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Địa điểm</label>
                  <input
                    type="text"
                    value={editFormData.location}
                    onChange={(event) => setEditFormData({ ...editFormData, location: event.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-100 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mức lương</label>
                  <input
                    type="text"
                    value={editFormData.salary}
                    onChange={(event) => setEditFormData({ ...editFormData, salary: event.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-100 outline-none"
                    placeholder="VD: 15-20 triệu"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Hạn nộp</label>
                  <input
                    type="date"
                    value={editFormData.deadline}
                    min={todayInputValue}
                    onChange={(event) => setEditFormData({ ...editFormData, deadline: event.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-100 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Số lượng tuyển</label>
                  <input
                    type="number"
                    value={editFormData.positions}
                    onChange={(event) => setEditFormData({ ...editFormData, positions: event.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-100 outline-none"
                    min="1"
                  />
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={actionLoading === editingJob.id}
                className="px-8 py-2.5 bg-gradient-to-r from-navy-600 to-navy-800 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
              >
                {actionLoading === editingJob.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : normalizeModerationStatus(editingJob.status) === 'approved' ? (
                  'Lưu thay đổi'
                ) : (
                  'Lưu và chờ duyệt'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
