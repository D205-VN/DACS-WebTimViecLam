import { useState, useEffect, useCallback, createElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useAuth } from '@components/providers/AuthContext';
import { getJobDetailRoute } from '@services/navigation/roleRedirect';
import API_BASE_URL from '@services/http/baseUrl';

function CircularScore({ score, size = 52 }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 70 ? '#10b981' :
    score >= 45 ? '#f59e0b' :
    '#6b7280';

  const bgColor =
    score >= 70 ? 'rgba(16, 185, 129, 0.1)' :
    score >= 45 ? 'rgba(245, 158, 11, 0.1)' :
    'rgba(107, 114, 128, 0.1)';

  const glowColor =
    score >= 70 ? '0 0 8px rgba(16, 185, 129, 0.3)' :
    score >= 45 ? '0 0 8px rgba(245, 158, 11, 0.3)' :
    '0 0 8px rgba(107, 114, 128, 0.2)';

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ filter: `drop-shadow(${glowColor})` }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill={bgColor}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
        <span className="-mt-0.5 text-[8px] text-gray-400">điểm</span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-indigo-50 bg-white p-4">
      <div className="flex gap-3">
        <div className="h-12 w-12 shrink-0 rounded-xl bg-indigo-50" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-indigo-50" />
          <div className="h-3 w-1/2 rounded bg-indigo-50" />
          <div className="mt-3 flex gap-2">
            <div className="h-5 w-20 rounded bg-indigo-50" />
            <div className="h-5 w-24 rounded bg-indigo-50" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RecommendationPanel({ children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-indigo-100/60 bg-white/90 p-4 backdrop-blur-sm shadow-sm">
      {children}
    </section>
  );
}

function NoticePanel({ icon, title, description, action, tone = 'navy' }) {
  const toneClass = {
    amber: 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border-amber-200/60',
    orange: 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border-orange-200/60',
    rose: 'bg-gradient-to-r from-rose-50 to-pink-50 text-rose-700 border-rose-200/60',
    navy: 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border-indigo-200/60',
  }[tone];

  return (
    <RecommendationPanel>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
          {createElement(icon, { className: 'h-6 w-6' })}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
        </div>
        {action}
      </div>
    </RecommendationPanel>
  );
}

const skillColors = [
  'bg-cyan-50 text-cyan-700',
  'bg-violet-50 text-violet-700',
  'bg-rose-50 text-rose-700',
  'bg-amber-50 text-amber-700',
  'bg-teal-50 text-teal-700',
  'bg-indigo-50 text-indigo-700',
  'bg-pink-50 text-pink-700',
  'bg-emerald-50 text-emerald-700',
];

const reasonColors = [
  'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700',
  'bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700',
  'bg-gradient-to-r from-rose-50 to-pink-50 text-rose-700',
];

export default function AIJobRecommendations({ userCoordinates }) {
  const navigate = useNavigate();
  const { token, user, isAuthenticated } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cvStatus, setCvStatus] = useState(null);
  const [cvSkills, setCvSkills] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecommendations = useCallback(async (isRefresh = false) => {
    if (!token) return;

    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const params = new URLSearchParams({ limit: '6' });
      if (userCoordinates?.lat && userCoordinates?.lng) {
        params.set('lat', String(userCoordinates.lat));
        params.set('lng', String(userCoordinates.lng));
      }

      const res = await fetch(`${API_BASE_URL}/api/match/recommendations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Lỗi kết nối server');

      const payload = await res.json();
      setRecommendations(payload.data || []);
      setCvStatus(payload.cv_status || null);
      setCvSkills(payload.cv_skills || []);
    } catch (err) {
      console.error('AI recommendations error:', err);
      setError('Không thể tải gợi ý. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, userCoordinates?.lat, userCoordinates?.lng]);

  useEffect(() => {
    if (isAuthenticated && user?.role_code === 'seeker') {
      fetchRecommendations();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user?.role_code, fetchRecommendations]);

  if (!isAuthenticated || user?.role_code !== 'seeker') return null;

  if (loading) {
    return (
      <RecommendationPanel>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">AI đang phân tích CV của bạn</h2>
            <p className="text-sm text-gray-500">Đang so sánh kỹ năng với tin tuyển dụng mới.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </RecommendationPanel>
    );
  }

  if (cvStatus === 'no_cv') {
    return (
      <NoticePanel
        icon={FileText}
        tone="amber"
        title="Tạo CV để nhận gợi ý AI"
        description="AI sẽ dùng kỹ năng và kinh nghiệm trong CV để đề xuất việc làm phù hợp hơn."
        action={(
          <button
            onClick={() => navigate('/seeker/cv-builder')}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200/50 transition-all duration-200 hover:shadow-lg hover:from-indigo-700 hover:to-violet-700"
          >
            <Zap className="h-4 w-4" />
            Tạo CV ngay
          </button>
        )}
      />
    );
  }

  if (cvStatus === 'insufficient') {
    return (
      <NoticePanel
        icon={AlertCircle}
        tone="orange"
        title="Bổ sung kỹ năng trong CV"
        description="CV hiện tại chưa có đủ dữ liệu kỹ năng để AI gợi ý chính xác."
        action={(
          <button
            onClick={() => navigate('/seeker/my-cvs')}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200/50 transition-all duration-200 hover:shadow-lg hover:from-indigo-700 hover:to-violet-700"
          >
            <FileText className="h-4 w-4" />
            Chỉnh sửa CV
          </button>
        )}
      />
    );
  }

  if (error) {
    return (
      <NoticePanel
        icon={AlertCircle}
        tone="rose"
        title="Không tải được gợi ý"
        description={error}
        action={(
          <button
            onClick={() => fetchRecommendations(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-all duration-200 hover:bg-indigo-50"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </button>
        )}
      />
    );
  }

  if (!recommendations.length) return null;

  return (
    <RecommendationPanel>
      <div id="ai-recommendations">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">AI gợi ý việc làm</h2>
                <span className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  Smart Match
                </span>
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                Dựa trên {cvSkills.length > 0 ? `${cvSkills.length} kỹ năng` : 'CV'} của bạn
                {userCoordinates ? ' và vị trí hiện tại' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchRecommendations(true)}
            disabled={refreshing}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>

        {cvSkills.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-gray-500">Kỹ năng CV</span>
            {cvSkills.slice(0, 8).map((skill, idx) => (
              <span
                key={skill}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium ${skillColors[idx % skillColors.length]}`}
              >
                {skill}
              </span>
            ))}
            {cvSkills.length > 8 && (
              <span className="text-[11px] text-gray-500">+{cvSkills.length - 8} khác</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((job, idx) => {
            const cardBorders = ['border-l-emerald-400', 'border-l-indigo-400', 'border-l-violet-400', 'border-l-amber-400', 'border-l-rose-400', 'border-l-teal-400'];
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => navigate(getJobDetailRoute(user?.role_code, job.id))}
                className={`group relative rounded-xl border border-indigo-50 border-l-[3px] ${cardBorders[idx % cardBorders.length]} bg-white p-4 text-left transition-all duration-200 hover:border-indigo-100 hover:bg-indigo-50/20 hover:shadow-md hover:shadow-indigo-100/30 hover:-translate-y-0.5`}
              >
                <div className="mb-3 flex gap-3">
                  <CircularScore score={job.match_score} />
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 transition-colors group-hover:text-indigo-700">
                      {job.title}
                    </h3>
                    <p className="mt-1 truncate text-xs text-gray-500">{job.company_name || 'Đang cập nhật'}</p>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {job.salary && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <DollarSign className="h-3 w-3" />
                      <span className="max-w-[100px] truncate">{job.salary}</span>
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3 text-violet-400" />
                      <span className="max-w-[100px] truncate">{job.location}</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {job.match_reasons?.slice(0, 2).map((reason, ridx) => (
                    <span
                      key={ridx}
                      className={`inline-flex max-w-full items-center rounded-lg px-2 py-1 text-[10px] font-medium ${reasonColors[ridx % reasonColors.length]}`}
                    >
                      <span className="truncate max-w-[130px]">{reason.text}</span>
                    </span>
                  ))}
                </div>

                <div className="absolute right-4 top-4 opacity-0 transition-all duration-200 group-hover:opacity-100">
                  <ChevronRight className="h-4 w-4 text-indigo-600" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-indigo-50 pt-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Target className="h-3.5 w-3.5 text-indigo-500" />
            <span>AI phân tích</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Kỹ năng 40%
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <Briefcase className="h-3 w-3 text-amber-500" />
            Chức danh 25%
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <TrendingUp className="h-3 w-3 text-violet-500" />
            Ngành nghề 15%
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <MapPin className="h-3 w-3 text-rose-500" />
            Địa điểm 20%
          </div>
        </div>
      </div>
    </RecommendationPanel>
  );
}
