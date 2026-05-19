import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, DollarSign, Clock, Bookmark, BookmarkCheck, Briefcase, ArrowLeft, Send, CheckCircle2, Loader2, GraduationCap, Calendar, Bell, X, FileText, Sparkles, Target, BrainCircuit, ShieldCheck, BriefcaseBusiness } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import { findProvinceByName, normalizeProvinceName, normalizeSearchText } from '@shared/geo/provinceCoordinates';
import { getCompanyFilterRoute, getDefaultRouteByRole, getJobDetailRoute } from '@shared/utils/roleRedirect';
import { getSeekerAiTestPath } from '@shared/utils/aiTestRoutes';
import API_BASE_URL from '@shared/api/baseUrl';
import { talentInsightsApi } from '@shared/api/talentInsightsApi';

const API = `${API_BASE_URL}/api/jobs`;

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
const VIETNAMESE_STOP_WORDS = new Set([
  'và', 'hoặc', 'các', 'cho', 'với', 'của', 'trong', 'ngoài', 'theo', 'một', 'những', 'được', 'làm', 'việc',
  'ứng', 'viên', 'công', 'ty', 'kinh', 'nghiệm', 'yêu', 'cầu', 'mô', 'tả', 'quyền', 'lợi', 'chưa', 'cập', 'nhật',
]);

const stripHtml = (value = '') => String(value || '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim();

const splitContentLines = (text = '') => String(text || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .split(/\r?\n/)
  .flatMap((rawLine) => {
    const line = rawLine.trim();
    if (!line) return [];

    const withBulletBreaks = line
      .replace(/(^|\s)-(?=\s*[0-9A-Za-zÀ-ỹ])/g, '$1\n- ')
      .replace(/([:;])\s*\+(?=\s*[0-9A-Za-zÀ-ỹ])/g, '$1\n+ ')
      .replace(/\s\+(?=\s*[0-9A-Za-zÀ-ỹ])/g, '\n+ ');

    return withBulletBreaks
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);
  });

const tokenize = (value = '') => normalizeSearchText(stripHtml(value))
  .split(/[^a-z0-9à-ỹ]+/i)
  .map(token => token.trim())
  .filter(token => token.length > 2 && !VIETNAMESE_STOP_WORDS.has(token));

function buildCvJobFit(cv, job) {
  if (!cv || !job) {
    return {
      score: 0,
      tone: 'text-slate-600',
      label: 'Chưa có CV',
      matches: [],
      tips: ['Chọn một CV để hệ thống tính mức độ phù hợp.'],
    };
  }

  const cvText = `${cv.title || ''} ${cv.target_role || ''} ${stripHtml(cv.html_content || '')}`;
  const jobText = `${job.title || ''} ${job.description || ''} ${job.requirements || ''} ${job.industry || ''} ${job.tags || ''}`;
  const cvTokens = new Set(tokenize(cvText));
  const jobTokens = [...new Set(tokenize(jobText))].slice(0, 90);
  const matches = jobTokens.filter(token => cvTokens.has(token)).slice(0, 10);
  const titleTokens = tokenize(job.title || '');
  const roleTokens = tokenize(`${cv.target_role || ''} ${cv.title || ''}`);
  const roleMatches = titleTokens.filter(token => roleTokens.includes(token));
  const cvLocation = normalizeSearchText(cv.current_location || '');
  const jobLocation = normalizeSearchText(job.location || job.company_address || '');
  const createdAt = cv.created_at ? new Date(cv.created_at) : null;
  const ageDays = createdAt && !Number.isNaN(createdAt.getTime())
    ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let score = 20;
  score += Math.min(42, matches.length * 6);
  score += roleMatches.length > 0 ? 18 : 0;
  score += cvLocation && jobLocation && jobLocation.includes(cvLocation) ? 10 : cvLocation || jobLocation ? 4 : 6;
  score += ageDays === null ? 4 : ageDays <= 180 ? 10 : ageDays <= 365 ? 6 : 2;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const tips = [];
  if (matches.length < 5) tips.push('Bổ sung thêm kỹ năng/từ khóa xuất hiện trong mô tả công việc.');
  if (roleMatches.length === 0) tips.push('Điều chỉnh tiêu đề CV hoặc vị trí mục tiêu gần hơn với tin tuyển dụng.');
  if (ageDays !== null && ageDays > 180) tips.push('CV đã tạo khá lâu, nên cập nhật lại trước khi nộp.');
  if (!tips.length) tips.push('CV đang khá khớp, hãy viết thư giới thiệu nêu rõ thành tích liên quan.');

  return {
    score,
    tone: score >= 75 ? 'text-emerald-700' : score >= 55 ? 'text-amber-700' : 'text-red-700',
    label: score >= 75 ? 'Rất phù hợp' : score >= 55 ? 'Có tiềm năng' : 'Cần cải thiện',
    matches,
    tips,
  };
}

function getFitTone(score) {
  if (score >= 75) return 'text-emerald-700';
  if (score >= 55) return 'text-amber-700';
  return 'text-red-700';
}

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { token, isAuthenticated, user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [activeTab, setActiveTab] = useState('description');
  const [similarJobs, setSimilarJobs] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [alertSubscribed, setAlertSubscribed] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [cvs, setCvs] = useState([]);
  const [cvsLoading, setCvsLoading] = useState(false);
  const [selectedCvId, setSelectedCvId] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [applyError, setApplyError] = useState('');
  const [jobFitInsight, setJobFitInsight] = useState(null);
  const [trustInsight, setTrustInsight] = useState(null);

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
    fetch(`${API}/${id}${routerLocation.search || ''}`)
      .then(r => r.json())
      .then(d => { setJob(d.data); setLoading(false); })
      .catch(() => setLoading(false));
    if (token) {
      fetch(`${API}/saved-ids`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if (d.ids?.includes(parseInt(id))) setSaved(true); });
      fetch(`${API}/applied`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if (d.data?.some(j => j.id === parseInt(id))) setApplied(true); });
      fetch(`${API}/alert-ids`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if (d.ids?.includes(parseInt(id))) setAlertSubscribed(true); });
    }
  }, [id, token, routerLocation.search]);

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
    setTrustInsight(null);
    talentInsightsApi
      .getEmployerTrustForJob(id)
      .then(setTrustInsight)
      .catch((err) => console.error('Load employer trust score error:', err));
  }, [id]);

  useEffect(() => {
    if (!token || user?.role_code !== 'seeker') {
      setJobFitInsight(null);
      return;
    }

    talentInsightsApi
      .getJobFit(id)
      .then(setJobFitInsight)
      .catch((err) => console.error('Load job fit insight error:', err));
  }, [id, token, user?.role_code]);

  useEffect(() => {
    if (!token || user?.role_code !== 'seeker') {
      setCvs([]);
      setSelectedCvId('');
      return;
    }

    setCvsLoading(true);
    fetch(`${API_BASE_URL}/api/cv/my-cvs`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const list = data.cvs || [];
        setCvs(list);
        const primary = list.find(cv => cv.is_primary) || list[0];
        setSelectedCvId(primary?.id ? String(primary.id) : '');
      })
      .catch(() => {
        setCvs([]);
        setSelectedCvId('');
      })
      .finally(() => setCvsLoading(false));
  }, [token, user?.role_code]);

  useEffect(() => {
    if (job) {
      document.title = `${job.title || job.job_title || 'Chi tiết việc làm'} | AptertekWork`;
    } else {
      document.title = 'AptertekWork';
    }

    return () => {
      document.title = 'AptertekWork';
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
    setApplyError('');
    setApplyModalOpen(true);
  };

  const handleConfirmApply = async () => {
    if (!selectedCvId) {
      setApplyError('Vui lòng chọn CV trước khi ứng tuyển.');
      return;
    }

    setActionLoading('apply');
    try {
      const query = new URLSearchParams(routerLocation.search);
      const source = query.get('source') || (query.get('ref') ? 'referral' : 'organic');
      const res = await fetch(`${API}/${id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ source, cv_id: Number(selectedCvId), cover_letter: coverLetter.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể nộp hồ sơ lúc này');
      }
      setApplied(true);
      setApplyModalOpen(false);
      setCoverLetter('');
      setApplyError('');
    } catch (err) {
      setApplyError(err.message || 'Không thể nộp hồ sơ lúc này');
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
    const lines = splitContentLines(text);
    if (lines.length === 1) return <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">{lines[0]}</p>;
    return (
      <div className="space-y-2 text-sm leading-relaxed text-gray-600">
        {lines.map((line, index) => {
          const isBullet = /^[-+•]/.test(line);
          const content = isBullet ? line.replace(/^[-+•]\s*/, '').trim() : line;

          return (
            <div key={`${content}-${index}`} className={isBullet ? 'flex gap-2' : 'whitespace-pre-line'}>
              {isBullet ? <span className="mt-0.5 text-slate-400">-</span> : null}
              <span className="min-w-0">{content}</span>
            </div>
          );
        })}
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
  const selectedCv = cvs.find(cv => String(cv.id) === String(selectedCvId)) || null;
  const fallbackCvFit = buildCvJobFit(selectedCv, {
    title: jobTitle,
    description: jobDescription,
    requirements: jobRequirements,
    industry: job.industry,
    tags: tags.join(' '),
    location: jobLocation,
    company_address: companyAddress,
  });
  const apiFit = jobFitInsight?.fit;
  const cvFit = apiFit ? {
    score: apiFit.score,
    tone: getFitTone(apiFit.score),
    label: apiFit.label,
    matches: apiFit.matched_skills || [],
    missingSkills: apiFit.missing_skills || [],
    reasons: apiFit.reasons || [],
    tips: apiFit.cv_tips || [],
  } : fallbackCvFit;

  const handleCompanyClick = () => {
    if (!companyName) return;
    navigate(getCompanyFilterRoute(user?.role_code, companyName));
  };

  const handleSubscribeAlert = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setActionLoading('alert');
    try {
      const res = await fetch(`${API}/${id}/alert`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAlertSubscribed(data.subscribed);
    } catch (err) {
      console.error('Lỗi đăng ký nhận thông báo', err);
    }
    setActionLoading('');
  };

  return (
    <div className="aw-container py-6">
      <Link to={backRoute} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-slate-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
      </Link>

      <div className="space-y-5">
        <div className="aw-surface overflow-hidden">
          <div className="relative px-6 py-8 sm:px-10">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-[0.18em] text-gray-500">
                  <span>Việc làm</span>
                  <span className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{job.job_type || 'Chính thức'}</span>
                </div>
                <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-tight text-gray-950 md:text-4xl">{jobTitle}</h1>
                {companyName ? (
                  <button type="button" onClick={handleCompanyClick} className="text-left text-base font-semibold text-indigo-700 transition hover:text-indigo-900">
                    {companyName}
                  </button>
                ) : (
                  <p className="text-base text-gray-500">Đang cập nhật</p>
                )}
                <div className="mt-5 grid gap-3 text-sm text-gray-700 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="flex items-center gap-2 rounded-lg bg-indigo-50/50 px-4 py-3">
                    <MapPin className="w-4 h-4 text-indigo-600" />{jobLocation || 'Chưa rõ'}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 font-semibold text-emerald-700">
                    <DollarSign className="w-4 h-4" />{job.salary || 'Thỏa thuận'}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-indigo-50/50 px-4 py-3">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />{jobExperience || 'Không yêu cầu'}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-indigo-50/50 px-4 py-3">
                    <Clock className="w-4 h-4 text-indigo-600" />{job.job_type || 'Chính thức'}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-gray-500">
                  <span className="inline-flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />Ngày đăng tuyển {postedOn}</span>
                  {remainingDays !== null && <span className="inline-flex items-center gap-2">Hết hạn trong: {remainingDays} ngày</span>}
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.slice(0, 5).map((tag, index) => (
                      <span key={index} className="rounded-md border border-indigo-100/60 bg-indigo-50/50 px-3 py-1 text-xs font-semibold text-gray-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-indigo-100/60 bg-indigo-50/50 p-5 text-gray-700">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Thông tin nhanh</div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-lg bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Loại hình</p>
                    <p className="mt-2 text-base font-semibold text-gray-950">{job.job_type || 'Chính thức'}</p>
                  </div>
                  <div className="rounded-lg bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Ngành nghề</p>
                    <p className="mt-2 text-base font-semibold text-gray-950">{job.industry || 'Đang cập nhật'}</p>
                  </div>
                  <div className="rounded-lg bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Địa điểm</p>
                    <p className="mt-2 text-base font-semibold text-gray-950">{jobLocation || 'Đang cập nhật'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 xl:flex-row">
              <button
                onClick={handleApply}
                disabled={applied || actionLoading === 'apply'}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition ${
                  applied
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700'
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {actionLoading === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : applied ? <><CheckCircle2 className="w-4 h-4" />Đã ứng tuyển</> : <><Send className="w-4 h-4" />Ứng tuyển ngay</>}
              </button>
              <button
                onClick={handleSave}
                disabled={actionLoading === 'save'}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                  saved
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-indigo-100/60 bg-white text-gray-700 hover:bg-indigo-50/30'
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {actionLoading === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                {saved ? 'Đã lưu' : 'Lưu việc'}
              </button>
              <button
                type="button"
                onClick={handleSubscribeAlert}
                disabled={actionLoading === 'alert'}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                  alertSubscribed
                    ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                    : 'border-indigo-100/60 bg-white text-gray-700 hover:bg-indigo-50/30'
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {actionLoading === 'alert' ? <Loader2 className="w-4 h-4 animate-spin" /> : alertSubscribed ? <CheckCircle2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                {alertSubscribed ? 'Đã gửi công việc tương tự' : 'Gửi cho tôi việc tương tự'}
              </button>
              {job.ai_test && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) { navigate('/login'); return; }
                    navigate(getSeekerAiTestPath(job.ai_test.id, job.ai_test.test_type));
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <BrainCircuit className="w-4 h-4" />
                  Làm bài Test AI
                </button>
              )}
              {isAuthenticated && user?.role_code === 'seeker' ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(`/seeker/interview-copilot/${id}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                  >
                    <BrainCircuit className="w-4 h-4" />
                    Luyện phỏng vấn
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/seeker/work-simulation/${id}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
                  >
                    <BriefcaseBusiness className="w-4 h-4" />
                    Mini simulation
                  </button>
                </>
              ) : null}
            </div>
            <div className="mt-3 rounded-lg border border-indigo-100/60 bg-indigo-50/50 px-4 py-3 text-sm text-gray-600">
              Nhận thông báo phù hợp khi có việc tương tự.
            </div>
            {isAuthenticated && user?.role_code === 'seeker' ? (
              <div className="mt-3 rounded-lg border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Điểm phù hợp CV/job</p>
                    <p className="mt-1 text-cyan-700/80">
                      {apiFit?.reasons?.[0] || (selectedCv ? `Đang dùng ${selectedCv.title}` : 'Chọn CV khi ứng tuyển để tính điểm chi tiết.')}
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-900">
                    <Target className="h-4 w-4 text-cyan-600" />
                    {apiFit || selectedCv ? `${cvFit.score}% - ${cvFit.label}` : 'Chưa có CV'}
                  </span>
                </div>
                {apiFit ? (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg bg-white/70 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">Vì sao phù hợp</p>
                      <div className="mt-2 space-y-1 text-sm text-cyan-800">
                        {(cvFit.reasons || []).slice(0, 3).map(reason => <p key={reason}>{reason}</p>)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/70 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Kỹ năng còn thiếu</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(cvFit.missingSkills || []).length ? (
                          cvFit.missingSkills.slice(0, 5).map(skill => (
                            <span key={skill} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{skill}</span>
                          ))
                        ) : (
                          <span className="text-sm text-cyan-800">CV đã khớp các yêu cầu chính đang nhận diện.</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 border-t border-indigo-50 pt-4">
              <div className="rounded-lg border border-indigo-100/60 bg-indigo-50/50 px-4 py-3 text-sm text-gray-600">
                Theo dõi nhanh các phần quan trọng của tin tuyển dụng ngay bên dưới.
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => scrollToSection(tab.id)}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm' : 'bg-gradient-to-r from-indigo-50 to-violet-50 text-gray-600 hover:bg-gray-200'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>


        <div className="space-y-6">
          <section id="description" className="aw-surface scroll-mt-28 p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Mô tả công việc</h2>
                <p className="text-sm text-slate-500">Thông tin chi tiết về nhiệm vụ và yêu cầu công việc.</p>
              </div>
              <span className="rounded-md bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 1</span>
            </div>
            {renderContentText(jobDescription) || <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">Mô tả công việc đang được cập nhật.</div>}
          </section>

          <section id="benefits" className="aw-surface scroll-mt-28 p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Quyền lợi</h2>
                <p className="text-sm text-slate-500">Những lợi ích bạn nhận được khi ứng tuyển công việc này.</p>
              </div>
              <span className="rounded-md bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 2</span>
            </div>
            {renderContentText(job.benefits) || <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">Quyền lợi đang được cập nhật.</div>}
          </section>

          <section id="requirements" className="aw-surface scroll-mt-28 p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Kỹ năng yêu cầu</h2>
                <p className="text-sm text-slate-500">Yêu cầu chuyên môn và kỹ năng cần thiết cho vị trí này.</p>
              </div>
              <span className="rounded-md bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 3</span>
            </div>
            {renderContentText(jobRequirements) || <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">Yêu cầu ứng viên đang được cập nhật.</div>}
          </section>

          <section id="details" className="aw-surface scroll-mt-28 p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Chi tiết công việc</h2>
                <p className="text-sm text-slate-500">Tổng hợp các thông tin quan trọng của công việc.</p>
              </div>
              <span className="rounded-md bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 4</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4 text-sm text-slate-600">
                <div className="rounded-lg bg-slate-50 p-4"><p className="text-slate-500">Loại hình</p><p className="font-medium text-slate-900">{job.job_type || 'Chính thức'}</p></div>
                <div className="rounded-lg bg-slate-50 p-4"><p className="text-slate-500">Ngành nghề</p><p className="font-medium text-slate-900">{job.industry || 'Đang cập nhật'}</p></div>
                <div className="rounded-lg bg-slate-50 p-4"><p className="text-slate-500">Địa điểm</p><p className="font-medium text-slate-900">{jobLocation || 'Đang cập nhật'}</p></div>
              </div>
              <div className="space-y-4 text-sm text-slate-600">
                <div className="rounded-lg bg-slate-50 p-4"><p className="text-slate-500">Kinh nghiệm</p><p className="font-medium text-slate-900">{jobExperience || 'Không yêu cầu'}</p></div>
                <div className="rounded-lg bg-slate-50 p-4"><p className="text-slate-500">Số lượng tuyển</p><p className="font-medium text-slate-900">{job.number_candidate || 'Không giới hạn'}</p></div>
                <div className="rounded-lg bg-slate-50 p-4"><p className="text-slate-500">Hạn nộp</p><p className="font-medium text-slate-900">{jobDeadline || 'Đang cập nhật'}</p></div>
                <div className="rounded-lg bg-slate-50 p-4"><p className="text-slate-500">Mức lương</p><p className="font-medium text-slate-900">{job.salary || 'Thỏa thuận'}</p></div>
              </div>
            </div>
          </section>

          <section id="contact" className="aw-surface scroll-mt-28 p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Liên hệ</h2>
                <p className="text-sm text-slate-500">Thông tin liên hệ với nhà tuyển dụng.</p>
              </div>
              <span className="rounded-md bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 5</span>
            </div>
            <div className="space-y-4 text-sm text-slate-600">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-slate-500">Công ty</p>
                {companyName ? (
                  <button type="button" onClick={handleCompanyClick} className="font-medium text-slate-900 transition hover:text-blue-700">
                    {companyName}
                  </button>
                ) : (
                  <p className="font-medium text-slate-900">Đang cập nhật</p>
                )}
              </div>
              <div className="rounded-lg bg-slate-50 p-4"><p className="text-slate-500">Địa chỉ</p><p className="font-medium text-slate-900">{companyAddress || 'Đang cập nhật'}</p></div>
              <div className="rounded-lg bg-slate-50 p-4"><p className="text-slate-500">Khu vực làm việc</p><p className="font-medium text-slate-900">{jobLocation || 'Đang cập nhật'}</p></div>
              {job.url_job && (
                <div className="rounded-lg bg-slate-50 p-4"><p className="text-slate-500">Trang tuyển dụng</p><p className="font-medium text-blue-600"><a href={job.url_job} target="_blank" rel="noreferrer">Xem chi tiết</a></p></div>
              )}
            </div>
          </section>

          <section id="company" className="aw-surface scroll-mt-28 p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Về công ty</h2>
                <p className="text-sm text-slate-500">Thông tin tổng quan về nhà tuyển dụng.</p>
              </div>
              <span className="rounded-md bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Mục 6</span>
            </div>
            {companyOverview ? (
              <div className="text-sm text-slate-600 leading-relaxed">{companyOverview}</div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">Thông tin về công ty đang được cập nhật.</div>
            )}
            {trustInsight ? (
              <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-emerald-700">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-950">Employer Trust Score</p>
                      <p className="text-sm text-emerald-800">{trustInsight.label}</p>
                    </div>
                  </div>
                  <span className="w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-emerald-700">{trustInsight.score}%</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(trustInsight.signals || []).map(signal => (
                    <div key={signal.label} className="rounded-lg bg-white px-3 py-2 text-sm">
                      <p className="text-xs font-semibold text-slate-500">{signal.label}</p>
                      <p className={`mt-1 font-bold ${signal.good ? 'text-emerald-700' : 'text-amber-700'}`}>{signal.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="aw-surface p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Việc làm phù hợp</h2>
                <p className="mt-2 text-sm text-slate-500">Gợi ý công việc phù hợp dựa trên vị trí và ngành nghề hiện tại.</p>
              </div>
              <span className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">{similarJobs.length} gợi ý</span>
            </div>

            {similarLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[...Array(2)].map((_, idx) => (
                  <div key={idx} className="animate-pulse rounded-lg bg-slate-100 h-36" />
                ))}
              </div>
            ) : similarJobs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">Chưa có gợi ý phù hợp. Hãy thử tìm kiếm việc làm khác.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {similarJobs.map(similar => (
                  <Link key={similar.id} to={getJobDetailRoute(user?.role_code, similar.id)} className="group overflow-hidden rounded-lg border border-slate-200 bg-white p-5 transition duration-200  ">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-700">{similar.title || similar.job_title}</h3>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{similar.company_name || 'Đang cập nhật'}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50/50 px-2 py-1 shadow-sm"><MapPin className="w-3 h-3" />{similar.location || similar.job_address || 'Chưa rõ'}</span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50/50 px-2 py-1 shadow-sm"><DollarSign className="w-3 h-3" />{similar.salary || 'Thỏa thuận'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {applyModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-lg">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Ứng tuyển</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">{jobTitle}</h3>
                <p className="mt-1 text-sm text-slate-500">{companyName || 'Nhà tuyển dụng'}</p>
              </div>
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 text-slate-500 transition hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-[calc(92vh-90px)] overflow-y-auto lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5 p-6">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Chọn CV nộp hồ sơ</label>
                  {cvsLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Đang tải CV...
                    </div>
                  ) : cvs.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                      Bạn chưa có CV. Hãy tạo hoặc import CV trước khi ứng tuyển.
                      <Link to="/seeker/cv-builder" className="ml-1 font-semibold underline underline-offset-2">Tạo CV ngay</Link>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {cvs.map(cv => {
                        const active = String(selectedCvId) === String(cv.id);
                        return (
                          <button
                            key={cv.id}
                            type="button"
                            onClick={() => setSelectedCvId(String(cv.id))}
                            className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${
                              active ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${active ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">{cv.title}</p>
                                {cv.is_primary ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">CV chính</span> : null}
                              </div>
                              <p className="mt-1 text-sm text-slate-500">{cv.target_role || 'Chưa có vị trí mục tiêu'}</p>
                              {cv.current_location ? <p className="mt-1 text-xs text-slate-400">{cv.current_location}</p> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Thư giới thiệu ngắn</label>
                  <textarea
                    value={coverLetter}
                    onChange={(event) => setCoverLetter(event.target.value.slice(0, 2000))}
                    rows={7}
                    placeholder="Nêu 2-3 điểm mạnh liên quan trực tiếp tới vị trí này..."
                    className="w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-violet-200"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">{coverLetter.length}/2000</p>
                </div>

                {applyError ? (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{applyError}</div>
                ) : null}
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-6 lg:border-l lg:border-t-0">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Phù hợp</p>
                      <h4 className={`mt-2 text-4xl font-black ${cvFit.tone}`}>{apiFit || selectedCv ? `${cvFit.score}%` : '--'}</h4>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                      <Sparkles className="h-7 w-7" />
                    </div>
                  </div>
                  <p className="mt-3 font-semibold text-slate-900">{cvFit.label}</p>
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-700">Từ khóa trùng</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cvFit.matches.length > 0 ? cvFit.matches.map(token => (
                        <span key={token} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{token}</span>
                      )) : <span className="text-sm text-slate-400">Chưa tìm thấy từ khóa trùng nổi bật.</span>}
                    </div>
                  </div>
                  <div className="mt-5">
                    <p className="text-sm font-semibold text-slate-700">Gợi ý trước khi nộp</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-600">
                      {cvFit.tips.map(tip => <li key={tip} className="rounded-lg bg-slate-50 px-3 py-2">{tip}</li>)}
                    </ul>
                  </div>
                  {cvFit.missingSkills?.length ? (
                    <div className="mt-5">
                      <p className="text-sm font-semibold text-slate-700">Kỹ năng còn thiếu</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {cvFit.missingSkills.map(skill => (
                          <span key={skill} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{skill}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setApplyModalOpen(false)}
                    className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmApply}
                    disabled={actionLoading === 'apply' || cvsLoading || cvs.length === 0}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Nộp hồ sơ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
