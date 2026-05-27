import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Briefcase,
  BrainCircuit,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  Trophy,
  AlertTriangle,
  Video,
  CheckSquare,
  Bot,
} from 'lucide-react';
import { useAuth } from '@components/providers/AuthContext';
import { getBackLabelByRole, getDefaultRouteByRole, getJobDetailRoute } from '@services/navigation/roleRedirect';
import { getSeekerAiTestPath } from '@services/ai-tests/aiTestRoutes';
import { aiTestApi } from '@services/ai-tests/aiTestApi';

function formatTestType(type) {
  if (type === 'video_ai') return 'Video AI + tự luận';
  if (type === 'avatar_live3d' || type === 'avatar_live2d') return 'Avatar Live3D + tự luận';
  return 'Trắc nghiệm';
}

function getTestTypeStyle(type) {
  if (type === 'video_ai') return { icon: Video, gradientFrom: 'from-blue-500', gradientTo: 'to-cyan-500' };
  if (type === 'avatar_live3d' || type === 'avatar_live2d') return { icon: Bot, gradientFrom: 'from-violet-500', gradientTo: 'to-fuchsia-500' };
  return { icon: CheckSquare, gradientFrom: 'from-emerald-500', gradientTo: 'to-teal-500' };
}

function getGrade(pct) {
  if (pct >= 90) return { label: 'Xuất sắc', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (pct >= 70) return { label: 'Tốt', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
  if (pct >= 50) return { label: 'Trung bình', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { label: 'Cần cải thiện', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' };
}

function getScoreColor(pct) {
  if (pct >= 90) return 'text-emerald-600';
  if (pct >= 70) return 'text-blue-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-rose-600';
}

function getProgressGradient(pct) {
  if (pct >= 90) return 'from-emerald-400 to-green-500';
  if (pct >= 70) return 'from-blue-400 to-cyan-500';
  if (pct >= 50) return 'from-amber-400 to-orange-500';
  return 'from-rose-400 to-pink-500';
}

export default function MyScoresPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const backLabel = getBackLabelByRole(user?.role_code);

  useEffect(() => {
    aiTestApi
      .getMySubmissions()
      .then((data) => {
        setSubmissions(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Failed to load submissions:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Group submissions by job
  const jobGroups = [];
  const jobMap = new Map();
  submissions.forEach((sub) => {
    const key = sub.job_id || `test-${sub.test_id}`;
    if (!jobMap.has(key)) {
      jobMap.set(key, {
        job_id: sub.job_id,
        job_title: sub.job_title,
        company_name: sub.company_name,
        job_location: sub.job_location,
        job_salary: sub.job_salary,
        submissions: [],
      });
      jobGroups.push(jobMap.get(key));
    }
    jobMap.get(key).submissions.push(sub);
  });

  const completedSubmissions = submissions.filter(
    (s) => s.status === 'completed' || s.status === 'graded'
  );

  const avgScore =
    completedSubmissions.length > 0
      ? Math.round(
          completedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) /
            completedSubmissions.length
        )
      : 0;

  const bestScore =
    completedSubmissions.length > 0
      ? Math.max(...completedSubmissions.map((s) => s.percentage || 0))
      : 0;

  return (
    <div className="aw-container max-w-5xl py-6">
      <Link
        to={backRoute}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      {/* Header */}
      <div className="aw-surface mb-6 p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-violet-50/50 to-purple-50/30 pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Bảng điểm</h1>
            <p className="text-sm text-gray-500">
              {completedSubmissions.length} bài test đã hoàn thành
              {jobGroups.length > 0 && ` · ${jobGroups.length} tin tuyển dụng`}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      {completedSubmissions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="aw-surface p-4 text-center">
            <p className="text-3xl font-black text-indigo-600">
              {completedSubmissions.length}
            </p>
            <p className="text-xs font-semibold text-gray-500 mt-1">Bài test</p>
          </div>
          <div className="aw-surface p-4 text-center">
            <p className={`text-3xl font-black ${getScoreColor(avgScore)}`}>
              {avgScore}%
            </p>
            <p className="text-xs font-semibold text-gray-500 mt-1">Điểm TB</p>
          </div>
          <div className="aw-surface p-4 text-center">
            <p className={`text-3xl font-black ${getScoreColor(bestScore)}`}>
              {bestScore}%
            </p>
            <p className="text-xs font-semibold text-gray-500 mt-1">Cao nhất</p>
          </div>
          <div className="aw-surface p-4 text-center">
            <p className="text-3xl font-black text-emerald-600">
              {completedSubmissions.reduce((s, sub) => s + (sub.correct_count || 0), 0)}
            </p>
            <p className="text-xs font-semibold text-gray-500 mt-1">Câu đúng</p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="aw-surface p-16 text-center">
          <Award className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-semibold">
            Bạn chưa làm bài test nào.
          </p>
          <p className="text-gray-400 mt-2 text-sm">
            Khi ứng tuyển và có bài test AI, kết quả sẽ hiển thị ở đây.
          </p>
          <Link
            to={backRoute}
            className="inline-block mt-6 text-sm font-semibold text-indigo-700 hover:underline"
          >
            Khám phá việc làm →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {jobGroups.map((group) => (
            <div key={group.job_id || group.submissions[0]?.test_id} className="aw-surface overflow-hidden">
              {/* Job Header */}
              <div className="flex items-start gap-4 p-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50/50 to-violet-50/30">
                <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center text-white shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  {group.job_id ? (
                    <Link to={getJobDetailRoute(user?.role_code, group.job_id)} className="block group">
                      <h3 className="text-base font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                        {group.job_title || 'Tin tuyển dụng'}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">{group.company_name || ''}</p>
                    </Link>
                  ) : (
                    <h3 className="text-base font-bold text-gray-900">Bài test độc lập</h3>
                  )}
                  {(group.job_location || group.job_salary) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      {group.job_location && (
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <MapPin className="w-3.5 h-3.5" />{group.job_location}
                        </span>
                      )}
                      {group.job_salary && (
                        <span className="flex items-center gap-1 text-sm font-semibold text-success-600">
                          <DollarSign className="w-3.5 h-3.5" />{group.job_salary}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Submissions for this job */}
              <div className="divide-y divide-gray-50">
                {group.submissions.map((sub) => {
                  const isCompleted = sub.status === 'completed' || sub.status === 'graded';
                  const pct = sub.percentage || 0;
                  const grade = getGrade(pct);
                  const typeStyle = getTestTypeStyle(sub.test_type);
                  const TypeIcon = typeStyle.icon;
                  const totalQ = sub.total_questions || 0;
                  const maxScore = sub.max_score || 0;
                  const totalScore = sub.total_score || 0;

                  return (
                    <div key={sub.id} className="p-5">
                      {/* Test info row */}
                      <div className="flex items-start gap-3 justify-between">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${typeStyle.gradientFrom} ${typeStyle.gradientTo} text-white shadow-sm`}>
                            <TypeIcon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500">Bài test AI</p>
                            <h4 className="mt-0.5 text-base font-bold text-gray-900 truncate">{sub.test_title || 'Bài test'}</h4>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700 border border-violet-100">
                                {formatTestType(sub.test_type)}
                              </span>
                              <span className="rounded-full bg-gray-50 px-2.5 py-1 text-gray-600 border border-gray-200 flex items-center gap-1">
                                <Clock className="w-3 h-3" />{sub.duration || 60} phút
                              </span>
                              {!isCompleted && (
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 border border-amber-100">Đang làm</span>
                              )}
                              {sub.suspicious_flag && (
                                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 border border-rose-200 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />Cảnh báo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Score badge or retake button */}
                        {isCompleted ? (
                          <div className={`flex flex-col items-center shrink-0 rounded-2xl px-5 py-3 ${grade.bg} border ${grade.border}`}>
                            <span className={`text-2xl font-black ${grade.color}`}>{pct}%</span>
                            <span className={`text-xs font-bold ${grade.color} mt-0.5`}>{grade.label}</span>
                          </div>
                        ) : (
                          <Link
                            to={getSeekerAiTestPath(sub.test_id, sub.test_type)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 shrink-0"
                          >
                            <BrainCircuit className="w-3.5 h-3.5" />Tiếp tục làm
                          </Link>
                        )}
                      </div>

                      {/* Score breakdown when completed */}
                      {isCompleted && totalQ > 0 && (
                        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50/70 p-4">
                          {/* Progress bar */}
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`text-3xl font-black ${grade.color}`}>{pct}%</div>
                            <div className="flex-1">
                              <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
                                <div
                                  className={`h-full rounded-full bg-gradient-to-r ${getProgressGradient(pct)} transition-all duration-700`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Stats grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="rounded-lg bg-white p-3 text-center border border-gray-100">
                              <p className="text-lg font-black text-gray-800">{totalScore.toFixed(1)}</p>
                              <p className="text-[11px] font-semibold text-gray-500 mt-0.5">Tổng điểm</p>
                            </div>
                            <div className="rounded-lg bg-white p-3 text-center border border-gray-100">
                              <p className="text-lg font-black text-gray-800">{maxScore}</p>
                              <p className="text-[11px] font-semibold text-gray-500 mt-0.5">Điểm tối đa</p>
                            </div>
                            <div className="rounded-lg bg-white p-3 text-center border border-gray-100">
                              <p className="text-lg font-black text-emerald-600">{sub.correct_count || 0}</p>
                              <p className="text-[11px] font-semibold text-gray-500 mt-0.5">Câu đúng</p>
                            </div>
                            <div className="rounded-lg bg-white p-3 text-center border border-gray-100">
                              <p className="text-lg font-black text-gray-800">{sub.answered_questions || 0}/{totalQ}</p>
                              <p className="text-[11px] font-semibold text-gray-500 mt-0.5">Đã trả lời</p>
                            </div>
                          </div>

                          {sub.completed_at && (
                            <p className="mt-3 text-xs text-gray-400">
                              Hoàn thành lúc {new Date(sub.completed_at).toLocaleString('vi-VN')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Time info */}
                      {!isCompleted && (
                        <p className="mt-3 text-xs text-gray-400">
                          Bắt đầu lúc {new Date(sub.started_at).toLocaleString('vi-VN')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
