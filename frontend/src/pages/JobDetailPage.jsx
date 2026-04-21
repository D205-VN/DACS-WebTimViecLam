import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, DollarSign, Clock, Bookmark, BookmarkCheck, Briefcase, ArrowLeft, Send, CheckCircle2, Loader2, GraduationCap, Calendar, Bell, X, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { findProvinceByName, normalizeProvinceName, normalizeSearchText } from '../data/provinceCoordinates';
import { getCompanyFilterRoute, getDefaultRouteByRole, getJobDetailRoute } from '../utils/roleRedirect';

const API = '/api/jobs';

const getFirstFilledText = (...values) =>
  values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || '';

const getRegionFromAddress = (...values) => {
  for (const value of values) {
    const province = findProvinceByName(value);
    if (province?.name) {
      return normalizeProvinceName(province.name);
    }
  }

  return '';
};

const getLocationLookupText = (...values) => getRegionFromAddress(...values) || getFirstFilledText(...values);

const getTags = (text) => text?.split(/[,/]/).map(tag => tag.trim().toLowerCase()).filter(Boolean) || [];
const getSimilarityScore = (source, target) => target.reduce((score, token) => score + (source.includes(token) ? 1 : 0), 0);

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, isAuthenticated, user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [activeTab, setActiveTab] = useState('description');
  const [similarJobs, setSimilarJobs] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertCity, setAlertCity] = useState('');
  const [alertIndustry, setAlertIndustry] = useState('');
  const [alertLevel, setAlertLevel] = useState('');
  const [alertSalary, setAlertSalary] = useState('');
  const [alertFrequency, setAlertFrequency] = useState('daily');
  const [sendNow, setSendNow] = useState(false);

  const tabs = [
    { id: 'description', label: 'Mô tả' },
    { id: 'benefits', label: 'Quyền lợi' },
    { id: 'requirements', label: 'Kỹ năng yêu cầu' },
    { id: 'details', label: 'Chi tiết công việc' },
    { id: 'contact', label: 'Liên hệ' },
    { id: 'company', label: 'Về công ty' },
  ];

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    fetch(`${API}/${id}`)
      .then(r => r.json())
      .then(d => { setJob(d.data); setLoading(false); })
      .catch(() => setLoading(false));
    if (token) {
      fetch(`${API}/saved-ids`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if (d.ids?.includes(parseInt(id))) setSaved(true); });
      fetch(`${API}/applied`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if (d.data?.some(j => j.id === parseInt(id))) setApplied(true); });
    }
  }, [id, token]);

  useEffect(() => {
    if (!job) return;
    queueMicrotask(() => setSimilarLoading(true));
    fetch(`${API}?page=1&limit=100`)
      .then(r => r.json())
      .then(d => {
        const currentTags = getTags(job.industry);
        const currentLocation = normalizeSearchText(
          getLocationLookupText(job.location, job.job_address, job.company_address)
        );
        const suggestions = (d.data || [])
          .filter(item => item.id !== job.id)
          .map(item => {
            const itemLocation = normalizeSearchText(
              getLocationLookupText(item.location, item.job_address, item.company_address)
            );
            const locationScore = currentLocation && itemLocation && itemLocation === currentLocation ? 1 : 0;
            const score = getSimilarityScore(currentTags, getTags(item.industry)) + locationScore;
            return { ...item, score };
          })
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score || a.id - b.id)
          .slice(0, 4);

        setSimilarJobs(suggestions);
      })
      .catch(() => setSimilarJobs([]))
      .finally(() => setSimilarLoading(false));
  }, [job]);

  useEffect(() => {
    if (job) {
      document.title = `${job.title || job.job_title || 'Chi tiết việc làm'} | WebTimViec`;
    } else {
      document.title = 'WebTimViec';
    }

    return () => {
      document.title = 'WebTimViec';
    };
  }, [job]);

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
    try {
      const res = await fetch(`${API}/${id}/apply`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể nộp hồ sơ lúc này');
      }
      setApplied(true);
    } catch (err) {
      alert(err.message);
    }
    setActionLoading('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Đang cập nhật';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Đang cập nhật';
      return date.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return 'Đang cập nhật';
    }
  };

  const getRemainingDays = (deadline) => {
    if (!deadline) return null;
    const target = new Date(deadline);
    if (isNaN(target.getTime())) return null;
    const diff = target.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const renderContentText = (text) => {
    if (!text) return null;
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 1) return <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{text}</p>;
    return (
      <div className="space-y-3 text-sm text-gray-600">
        {lines.map((line, index) => (
          <p key={index} className="whitespace-pre-line">{line}</p>
        ))}
      </div>
    );
  };

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveTab(sectionId);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div></div>;
  if (!job) return <div className="text-center py-20 text-gray-500">Không tìm thấy việc làm</div>;

  const tags = job.industry?.split(/[,/]/).map(t => t.trim()).filter(Boolean) || [];
  const jobTitle = job.title || job.job_title;
  const jobLocation = job.location || job.job_address;
  const jobDescription = job.description || job.job_description;
  const jobRequirements = job.requirements || job.job_requirements;
  const jobExperience = job.experience || job.years_of_experience;
  const jobDeadline = job.deadline || job.submission_deadline;
  const companyName = job.company_name;
  const companyAddress = job.company_address;
  const companyOverview = job.company_overview || job.company_description;
  const postedOn = formatDate(job.created_at || job.updated_at || job.posted_at);
  const remainingDays = getRemainingDays(jobDeadline);
  const backRoute = getDefaultRouteByRole(user?.role_code);

  const handleCompanyClick = () => {
    if (!companyName) return;
    navigate(getCompanyFilterRoute(user?.role_code, companyName));
  };

  const handleOpenAlertModal = () => {
    setAlertCity(getRegionFromAddress(job.location, job.job_address, job.company_address));
    setAlertIndustry(job.industry || '');
    setAlertLevel('');
    setAlertSalary('');
    setAlertFrequency('daily');
    setSendNow(false);
    setShowAlertModal(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link to={backRoute} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-slate-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
      </Link>

      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-700 text-white shadow-2xl shadow-slate-900/20">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_30%)]" />
          <div className="absolute -left-16 top-8 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-16 bottom-8 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="relative px-6 py-8 sm:px-10">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-[0.3em] text-cyan-100">
                  <span>Việc làm</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100 border border-white/15">{job.job_type || 'Chính thức'}</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight text-white">{jobTitle}</h1>
                {companyName ? (
                  <button type="button" onClick={handleCompanyClick} className="text-left text-base text-slate-200 transition hover:text-white">
                    {companyName}
                  </button>
                ) : (
                  <p className="text-base text-slate-200">Đang cập nhật</p>
                )}
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm text-slate-100">
                  <div className="flex items-center gap-2 rounded-3xl bg-white/10 px-4 py-3 shadow-sm shadow-white/5">
                    <MapPin className="w-4 h-4 text-cyan-200" />{jobLocation || 'Chưa rõ'}
                  </div>
                  <div className="flex items-center gap-2 rounded-3xl bg-white/10 px-4 py-3 shadow-sm shadow-white/5">
                    <DollarSign className="w-4 h-4 text-cyan-200" />{job.salary || 'Thỏa thuận'}
                  </div>
                  <div className="flex items-center gap-2 rounded-3xl bg-white/10 px-4 py-3 shadow-sm shadow-white/5">
                    <GraduationCap className="w-4 h-4 text-cyan-200" />{jobExperience || 'Không yêu cầu'}
                  </div>
                  <div className="flex items-center gap-2 rounded-3xl bg-white/10 px-4 py-3 shadow-sm shadow-white/5">
                    <Clock className="w-4 h-4 text-cyan-200" />{job.job_type || 'Chính thức'}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-300" />Ngày đăng tuyển {postedOn}</span>
                  {remainingDays !== null && <span className="inline-flex items-center gap-2">Hết hạn trong: {remainingDays} ngày</span>}
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.slice(0, 5).map((tag, index) => (
                      <span key={index} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-50">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[1.75rem] border border-white/15 bg-white/10 p-5 text-slate-100 shadow-lg shadow-white/10 backdrop-blur-xl">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-200">Thông tin nhanh</div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-3xl bg-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Loại hình</p>
                    <p className="mt-2 text-base font-semibold">{job.job_type || 'Chính thức'}</p>
                  </div>
                  <div className="rounded-3xl bg-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Ngành nghề</p>
                    <p className="mt-2 text-base font-semibold">{job.industry || 'Đang cập nhật'}</p>
                  </div>
                  <div className="rounded-3xl bg-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Địa điểm</p>
                    <p className="mt-2 text-base font-semibold">{jobLocation || 'Đang cập nhật'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 xl:flex-row">
              <button
                onClick={handleApply}
                disabled={applied || actionLoading === 'apply'}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                  applied
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'bg-white text-slate-900 hover:-translate-y-0.5 hover:shadow-lg'
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {actionLoading === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : applied ? <><CheckCircle2 className="w-4 h-4" />Đã ứng tuyển</> : <><Send className="w-4 h-4" />Ứng tuyển ngay</>}
              </button>
              <button
                onClick={handleSave}
                disabled={actionLoading === 'save'}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  saved
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-white/30 bg-white/10 text-white hover:bg-white/20'
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {actionLoading === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                {saved ? 'Đã lưu' : 'Lưu việc'}
              </button>
              <button
                type="button"
                onClick={handleOpenAlertModal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <Bell className="w-4 h-4" />
                Gửi cho tôi việc tương tự
              </button>
            </div>
            <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              Nhận thông báo phù hợp khi có việc tương tự.
            </div>
            {isAuthenticated && user?.role_code === 'seeker' ? (
              <div className="mt-3 rounded-3xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
                Khi bấm ứng tuyển, hệ thống sẽ dùng <b>CV chính</b> trong{' '}
                <Link to="/seeker/my-cvs" className="font-semibold underline underline-offset-2">
                  Quản lý hồ sơ CV
                </Link>
                .
              </div>
            ) : null}

            <div className="mt-6 border-t border-white/15 pt-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                Theo dõi nhanh các phần quan trọng của tin tuyển dụng ngay bên dưới.
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => scrollToSection(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-100/20 text-slate-200 hover:bg-white/10'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showAlertModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
            <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/30">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Thông báo việc làm</div>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">Gửi cho tôi việc tương tự</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAlertModal(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6 px-6 py-6">
                <div className="space-y-3 rounded-[1.75rem] bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Việc làm</div>
                  <div className="flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                    <Search className="w-4 h-4 text-slate-400" />
                    <span className="truncate">{jobTitle || 'Việc làm tương tự'}</span>
                  </div>
                </div>

                <div className="space-y-3 rounded-[1.75rem] border border-slate-200 bg-white p-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Nhập tỉnh, thành phố</label>
                  <div className="mt-2 flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <input
                      value={alertCity}
                      onChange={(e) => setAlertCity(e.target.value)}
                      placeholder="Nhập tỉnh, thành phố"
                      className="w-full bg-transparent text-sm text-slate-700 outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ngành nghề</label>
                    <select
                      value={alertIndustry}
                      onChange={(e) => setAlertIndustry(e.target.value)}
                      className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="">Chọn ngành nghề</option>
                      <option value="Cơ khí">Cơ khí</option>
                      <option value="CNTT">CNTT</option>
                      <option value="Kinh doanh">Kinh doanh</option>
                      <option value="Sản xuất">Sản xuất</option>
                    </select>
                  </div>
                  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cấp bậc</label>
                    <select
                      value={alertLevel}
                      onChange={(e) => setAlertLevel(e.target.value)}
                      className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="">Chọn cấp bậc</option>
                      <option value="Mới tốt nghiệp">Mới tốt nghiệp</option>
                      <option value="Nhân viên">Nhân viên</option>
                      <option value="Trưởng nhóm">Trưởng nhóm</option>
                      <option value="Quản lý">Quản lý</option>
                    </select>
                  </div>
                  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mức lương</label>
                    <select
                      value={alertSalary}
                      onChange={(e) => setAlertSalary(e.target.value)}
                      className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="">Chọn mức lương</option>
                      <option value="< 10 triệu">Dưới 10 triệu</option>
                      <option value="10 - 15 triệu">10 - 15 triệu</option>
                      <option value="15 - 20 triệu">15 - 20 triệu</option>
                      <option value="> 20 triệu">Trên 20 triệu</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Nhận thông báo</div>
                  <div className="mt-3 grid gap-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <input
                        type="radio"
                        checked={alertFrequency === 'daily'}
                        onChange={() => setAlertFrequency('daily')}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span>Hàng ngày</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <input
                        type="radio"
                        checked={alertFrequency === 'weekly'}
                        onChange={() => setAlertFrequency('weekly')}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span>Hàng tuần</span>
                    </label>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={sendNow}
                    onChange={(e) => setSendNow(e.target.checked)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span>Gửi thông báo ngay bây giờ</span>
                </label>
              </div>

              <div className="border-t border-slate-200 px-6 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" className="text-sm font-semibold text-blue-600">Xem việc phù hợp →</button>
                  <button
                    type="button"
                    onClick={() => setShowAlertModal(false)}
                    className="inline-flex items-center justify-center rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Tạo thông báo việc làm
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <section id="description" className="scroll-mt-28 bg-white rounded-[2rem] border border-slate-200 p-6 shadow-lg shadow-slate-200/40">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Mô tả công việc</h2>
                <p className="text-sm text-slate-500">Thông tin chi tiết về nhiệm vụ và yêu cầu công việc.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 1</span>
            </div>
            {renderContentText(jobDescription) || <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">Mô tả công việc đang được cập nhật.</div>}
          </section>

          <section id="benefits" className="scroll-mt-28 bg-white rounded-[2rem] border border-slate-200 p-6 shadow-lg shadow-slate-200/40">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Quyền lợi</h2>
                <p className="text-sm text-slate-500">Những lợi ích bạn nhận được khi ứng tuyển công việc này.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 2</span>
            </div>
            {renderContentText(job.benefits) || <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">Quyền lợi đang được cập nhật.</div>}
          </section>

          <section id="requirements" className="scroll-mt-28 bg-white rounded-[2rem] border border-slate-200 p-6 shadow-lg shadow-slate-200/40">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Kỹ năng yêu cầu</h2>
                <p className="text-sm text-slate-500">Yêu cầu chuyên môn và kỹ năng cần thiết cho vị trí này.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 3</span>
            </div>
            {renderContentText(jobRequirements) || <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">Yêu cầu ứng viên đang được cập nhật.</div>}
          </section>

          <section id="details" className="scroll-mt-28 bg-white rounded-[2rem] border border-slate-200 p-6 shadow-lg shadow-slate-200/40">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Chi tiết công việc</h2>
                <p className="text-sm text-slate-500">Tổng hợp các thông tin quan trọng của công việc.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 4</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4 text-sm text-slate-600">
                <div className="rounded-3xl bg-slate-50 p-4"><p className="text-slate-500">Loại hình</p><p className="font-medium text-slate-900">{job.job_type || 'Chính thức'}</p></div>
                <div className="rounded-3xl bg-slate-50 p-4"><p className="text-slate-500">Ngành nghề</p><p className="font-medium text-slate-900">{job.industry || 'Đang cập nhật'}</p></div>
                <div className="rounded-3xl bg-slate-50 p-4"><p className="text-slate-500">Địa điểm</p><p className="font-medium text-slate-900">{jobLocation || 'Đang cập nhật'}</p></div>
              </div>
              <div className="space-y-4 text-sm text-slate-600">
                <div className="rounded-3xl bg-slate-50 p-4"><p className="text-slate-500">Kinh nghiệm</p><p className="font-medium text-slate-900">{jobExperience || 'Không yêu cầu'}</p></div>
                <div className="rounded-3xl bg-slate-50 p-4"><p className="text-slate-500">Số lượng tuyển</p><p className="font-medium text-slate-900">{job.number_candidate || 'Không giới hạn'}</p></div>
                <div className="rounded-3xl bg-slate-50 p-4"><p className="text-slate-500">Hạn nộp</p><p className="font-medium text-slate-900">{jobDeadline || 'Đang cập nhật'}</p></div>
                <div className="rounded-3xl bg-slate-50 p-4"><p className="text-slate-500">Mức lương</p><p className="font-medium text-slate-900">{job.salary || 'Thỏa thuận'}</p></div>
              </div>
            </div>
          </section>

          <section id="contact" className="scroll-mt-28 bg-white rounded-[2rem] border border-slate-200 p-6 shadow-lg shadow-slate-200/40">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Liên hệ</h2>
                <p className="text-sm text-slate-500">Thông tin liên hệ với nhà tuyển dụng.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 5</span>
            </div>
            <div className="space-y-4 text-sm text-slate-600">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-slate-500">Công ty</p>
                {companyName ? (
                  <button type="button" onClick={handleCompanyClick} className="font-medium text-slate-900 transition hover:text-blue-700">
                    {companyName}
                  </button>
                ) : (
                  <p className="font-medium text-slate-900">Đang cập nhật</p>
                )}
              </div>
              <div className="rounded-3xl bg-slate-50 p-4"><p className="text-slate-500">Địa chỉ</p><p className="font-medium text-slate-900">{companyAddress || 'Đang cập nhật'}</p></div>
              <div className="rounded-3xl bg-slate-50 p-4"><p className="text-slate-500">Khu vực làm việc</p><p className="font-medium text-slate-900">{jobLocation || 'Đang cập nhật'}</p></div>
              {job.url_job && (
                <div className="rounded-3xl bg-slate-50 p-4"><p className="text-slate-500">Trang tuyển dụng</p><p className="font-medium text-blue-600"><a href={job.url_job} target="_blank" rel="noreferrer">Xem chi tiết</a></p></div>
              )}
            </div>
          </section>

          <section id="company" className="scroll-mt-28 bg-white rounded-[2rem] border border-slate-200 p-6 shadow-lg shadow-slate-200/40">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Về công ty</h2>
                <p className="text-sm text-slate-500">Thông tin tổng quan về nhà tuyển dụng.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 6</span>
            </div>
            {companyOverview ? (
              <div className="text-sm text-slate-600 leading-relaxed">{companyOverview}</div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">Thông tin về công ty đang được cập nhật.</div>
            )}
          </section>

          <section className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-lg shadow-slate-200/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Việc làm phù hợp</h2>
                <p className="mt-2 text-sm text-slate-500">Gợi ý công việc phù hợp dựa trên vị trí và ngành nghề hiện tại.</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">{similarJobs.length} gợi ý</span>
            </div>

            {similarLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[...Array(2)].map((_, idx) => (
                  <div key={idx} className="animate-pulse rounded-[1.75rem] bg-slate-100 h-36" />
                ))}
              </div>
            ) : similarJobs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">Chưa có gợi ý phù hợp. Hãy thử tìm kiếm việc làm khác.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {similarJobs.map(similar => (
                  <Link key={similar.id} to={getJobDetailRoute(user?.role_code, similar.id)} className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-700">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-700">{similar.title || similar.job_title}</h3>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{similar.company_name || 'Đang cập nhật'}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 shadow-sm"><MapPin className="w-3 h-3" />{similar.location || similar.job_address || 'Chưa rõ'}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 shadow-sm"><DollarSign className="w-3 h-3" />{similar.salary || 'Thỏa thuận'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
