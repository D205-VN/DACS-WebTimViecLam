import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, MapPin, DollarSign, Briefcase, ChevronRight,
  RefreshCw, AlertCircle, FileText, Loader2, Zap,
  TrendingUp, Target, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getJobDetailRoute } from '../utils/roleRedirect';
import API_BASE_URL from '../config/api';

function CircularScore({ score, size = 56 }) {
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

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill={bgColor}
          stroke="rgba(255,255,255,0.1)"
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
        <span className="text-[8px] text-gray-400 -mt-0.5">điểm</span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-xl bg-white/10 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-white/10" />
          <div className="h-3 w-1/2 rounded bg-white/10" />
          <div className="flex gap-2 mt-3">
            <div className="h-5 w-20 rounded-full bg-white/10" />
            <div className="h-5 w-24 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

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

  // Don't render for non-seekers or unauthenticated users
  if (!isAuthenticated || user?.role_code !== 'seeker') return null;

  // Loading state
  if (loading) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-navy-900 to-indigo-950 rounded-3xl mx-4 sm:mx-6 lg:mx-8 mt-6 p-6 sm:p-8">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-lg shadow-emerald-500/20">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI đang phân tích CV của bạn...</h2>
              <p className="text-sm text-slate-400">Đang so sánh kỹ năng với hàng ngàn tin tuyển dụng</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </section>
    );
  }

  // No CV state
  if (cvStatus === 'no_cv') {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-navy-900 to-indigo-950 rounded-3xl mx-4 sm:mx-6 lg:mx-8 mt-6 p-6 sm:p-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30">
            <FileText className="h-7 w-7 text-amber-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white mb-1">Tạo CV để nhận gợi ý AI</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Hệ thống AI sẽ phân tích kỹ năng, kinh nghiệm trong CV của bạn và tự động đề xuất các công việc phù hợp nhất.
            </p>
          </div>
          <button
            onClick={() => navigate('/seeker/cv-builder')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-amber-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 shrink-0"
          >
            <Zap className="w-4 h-4" />
            Tạo CV ngay
          </button>
        </div>
      </section>
    );
  }

  // CV insufficient
  if (cvStatus === 'insufficient') {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-navy-900 to-indigo-950 rounded-3xl mx-4 sm:mx-6 lg:mx-8 mt-6 p-6 sm:p-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/20 border border-orange-500/30">
            <AlertCircle className="h-7 w-7 text-orange-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white mb-1">Bổ sung kỹ năng trong CV</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              CV hiện tại chưa có đủ thông tin kỹ năng. Hãy thêm kỹ năng chuyên môn để AI gợi ý việc chính xác hơn.
            </p>
          </div>
          <button
            onClick={() => navigate('/seeker/my-cvs')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-orange-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 shrink-0"
          >
            <FileText className="w-4 h-4" />
            Chỉnh sửa CV
          </button>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-navy-900 to-indigo-950 rounded-3xl mx-4 sm:mx-6 lg:mx-8 mt-6 p-6 sm:p-8">
        <div className="relative flex items-center gap-4">
          <AlertCircle className="h-6 w-6 text-rose-400 shrink-0" />
          <p className="text-sm text-slate-300 flex-1">{error}</p>
          <button
            onClick={() => fetchRecommendations(true)}
            className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>
        </div>
      </section>
    );
  }

  // No recommendations
  if (!recommendations.length) return null;

  return (
    <section id="ai-recommendations" className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-navy-900 to-indigo-950 rounded-3xl mx-4 sm:mx-6 lg:mx-8 mt-6 p-6 sm:p-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-indigo-500/5 to-transparent rounded-full" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">AI Gợi ý Việc làm</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Smart Match
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Dựa trên {cvSkills.length > 0 ? `${cvSkills.length} kỹ năng` : 'CV'} của bạn
                {userCoordinates ? ' và vị trí hiện tại' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchRecommendations(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-200 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>

        {/* Skills preview */}
        {cvSkills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-5">
            <span className="text-xs text-slate-500 mr-1">Kỹ năng CV:</span>
            {cvSkills.slice(0, 8).map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 text-[11px] font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full"
              >
                {skill}
              </span>
            ))}
            {cvSkills.length > 8 && (
              <span className="text-[11px] text-slate-500">+{cvSkills.length - 8} khác</span>
            )}
          </div>
        )}

        {/* Job cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.map((job, index) => (
            <button
              key={job.id}
              type="button"
              onClick={() => navigate(getJobDetailRoute(user?.role_code, job.id))}
              className="group relative bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-sm rounded-2xl border border-white/[0.08] hover:border-emerald-500/30 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/5"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Score badge + Job info */}
              <div className="flex gap-3 mb-3">
                <CircularScore score={job.match_score} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-emerald-300 transition-colors leading-snug">
                    {job.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 truncate">{job.company_name || 'Đang cập nhật'}</p>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
                {job.salary && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                    <DollarSign className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{job.salary}</span>
                  </span>
                )}
                {job.location && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{job.location}</span>
                  </span>
                )}
              </div>

              {/* Match reasons */}
              <div className="flex flex-wrap gap-1.5">
                {job.match_reasons?.slice(0, 2).map((reason, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/5 border border-white/10 text-slate-300"
                  >
                    <span>{reason.icon}</span>
                    <span className="truncate max-w-[130px]">{reason.text}</span>
                  </span>
                ))}
              </div>

              {/* Hover arrow */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <ChevronRight className="w-4 h-4 text-emerald-400" />
              </div>
            </button>
          ))}
        </div>

        {/* Score legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 pt-5 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Target className="w-3.5 h-3.5 text-slate-500" />
            <span>Thuật toán AI phân tích:</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Kỹ năng 40%
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Briefcase className="w-3 h-3 text-amber-500" />
            Chức danh 25%
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <TrendingUp className="w-3 h-3 text-cyan-500" />
            Ngành nghề 15%
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <MapPin className="w-3 h-3 text-rose-500" />
            Địa điểm 20%
          </div>
        </div>
      </div>
    </section>
  );
}
