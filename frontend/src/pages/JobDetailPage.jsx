import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, DollarSign, Clock, Bookmark, BookmarkCheck, Briefcase, Building2, Users, ArrowLeft, Send, CheckCircle2, Loader2, GraduationCap, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = '/api/jobs';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    fetch(`${API}/${id}`).then(r => r.json()).then(d => { setJob(d.data); setLoading(false); }).catch(() => setLoading(false));
    if (token) {
      fetch(`${API}/saved-ids`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if (d.ids?.includes(parseInt(id))) setSaved(true); });
      fetch(`${API}/applied`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if (d.data?.some(j => j.id === parseInt(id))) setApplied(true); });
    }
  }, [id, token]);

  const handleSave = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setActionLoading('save');
    const res = await fetch(`${API}/${id}/save`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setSaved(data.saved);
    setActionLoading('');
  };

  const handleApply = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (applied) return;
    setActionLoading('apply');
    const res = await fetch(`${API}/${id}/apply`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setApplied(true);
    setActionLoading('');
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-700"></div></div>;
  if (!job) return <div className="text-center py-20 text-gray-500">Không tìm thấy việc làm</div>;

  const tags = job.industry?.split(/[,/]/).map(t => t.trim()).filter(Boolean) || [];
  const jobTitle = job.title || job.job_title;
  const jobLocation = job.location || job.job_address;
  const jobDescription = job.description || job.job_description;
  const jobRequirements = job.requirements || job.job_requirements;
  const jobExperience = job.experience || job.years_of_experience;
  const jobDeadline = job.deadline || job.submission_deadline;

  const handleCompanyClick = () => {
    if (!job.company_name) return;
    navigate(`/companies?company=${encodeURIComponent(job.company_name)}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Header Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-navy-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md">
                <Briefcase className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-800 uppercase">{jobTitle}</h1>
                {job.company_name ? (
                  <button type="button" onClick={handleCompanyClick} className="text-base text-gray-600 font-medium mt-1 hover:text-navy-700 transition-colors">
                    {job.company_name}
                  </button>
                ) : (
                  <p className="text-base text-gray-600 font-medium mt-1">Đang cập nhật</p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                  <span className="flex items-center gap-1.5 text-sm text-gray-500"><MapPin className="w-4 h-4" />{jobLocation || 'Chưa rõ'}</span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-success-600"><DollarSign className="w-4 h-4" />{job.salary || 'Thỏa thuận'}</span>
                  <span className="flex items-center gap-1.5 text-sm text-gray-500"><Clock className="w-4 h-4" />{job.job_type || 'Chính thức'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {tags.slice(0, 5).map((tag, i) => <span key={i} className="px-2.5 py-1 text-xs font-medium text-navy-600 bg-navy-50 rounded-lg">{tag}</span>)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
              <button onClick={handleApply} disabled={applied || actionLoading === 'apply'} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${applied ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gradient-to-r from-navy-600 to-navy-800 text-white hover:shadow-lg hover:-translate-y-0.5'} disabled:opacity-70`}>
                {actionLoading === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : applied ? <><CheckCircle2 className="w-4 h-4" />Đã ứng tuyển</> : <><Send className="w-4 h-4" />Ứng tuyển ngay</>}
              </button>
              <button onClick={handleSave} disabled={actionLoading === 'save'} className={`px-5 py-3 rounded-xl font-semibold text-sm border-2 transition-all ${saved ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 text-gray-600 hover:border-navy-200 hover:bg-navy-50'}`}>
                {saved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Job Description */}
          {jobDescription && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Mô tả công việc</h2>
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{jobDescription}</div>
            </div>
          )}

          {/* Requirements */}
          {jobRequirements && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Yêu cầu ứng viên</h2>
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{jobRequirements}</div>
            </div>
          )}

          {/* Benefits */}
          {job.benefits && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Quyền lợi</h2>
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{job.benefits}</div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Company Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-4">Thông tin công ty</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3"><Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><div><p className="text-gray-500">Công ty</p>{job.company_name ? <button type="button" onClick={handleCompanyClick} className="font-medium text-gray-700 hover:text-navy-700 transition-colors">{job.company_name}</button> : <p className="font-medium text-gray-700">Đang cập nhật</p>}</div></div>
              <div className="flex items-start gap-3"><Users className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><div><p className="text-gray-500">Quy mô</p><p className="font-medium text-gray-700">{job.company_size || 'Đang cập nhật'}</p></div></div>
              <div className="flex items-start gap-3"><MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><div><p className="text-gray-500">Địa chỉ</p><p className="font-medium text-gray-700">{job.company_address || 'Đang cập nhật'}</p></div></div>
            </div>
          </div>

          {/* Job Overview */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-4">Thông tin chung</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3"><GraduationCap className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><div><p className="text-gray-500">Kinh nghiệm</p><p className="font-medium text-gray-700">{jobExperience || 'Không yêu cầu'}</p></div></div>
              <div className="flex items-start gap-3"><Users className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><div><p className="text-gray-500">Số lượng tuyển</p><p className="font-medium text-gray-700">{job.number_candidate || 'Không giới hạn'}</p></div></div>
              <div className="flex items-start gap-3"><Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><div><p className="text-gray-500">Hạn nộp</p><p className="font-medium text-gray-700">{jobDeadline || 'Đang cập nhật'}</p></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
