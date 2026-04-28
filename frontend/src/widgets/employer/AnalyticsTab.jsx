import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Briefcase, Loader2, AlertCircle, Eye, Lightbulb, PieChart } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';

const STATUS_META = {
  pending: { label: 'Chờ xử lý', color: 'bg-amber-500' },
  interview: { label: 'Phỏng vấn', color: 'bg-blue-500' },
  hired: { label: 'Duyệt hồ sơ', color: 'bg-emerald-500' },
  rejected: { label: 'Từ chối', color: 'bg-red-500' },
};

function formatStatus(status) {
  return STATUS_META[status]?.label || status;
}

function formatCompactCurrency(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 'Chưa đủ dữ liệu';

  if (numericValue >= 1000000) {
    const millions = numericValue / 1000000;
    const formatted = millions >= 100 ? Math.round(millions) : Number(millions.toFixed(1));
    return `${formatted.toLocaleString('vi-VN')} triệu`;
  }

  return `${Math.round(numericValue).toLocaleString('vi-VN')} VND`;
}

function formatSourceLabel(source) {
  switch (source) {
    case 'referral':
      return 'Referrals';
    case 'social':
      return 'Mạng xã hội';
    case 'email':
      return 'Email';
    case 'job_alert':
      return 'Job alerts';
    case 'direct':
      return 'Trực tiếp';
    default:
      return 'Organic';
  }
}

function getInsightTone(severity) {
  switch (severity) {
    case 'high':
      return 'border-red-100 bg-red-50 text-red-700';
    case 'medium':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    default:
      return 'border-blue-100 bg-blue-50 text-blue-700';
  }
}

export default function AnalyticsTab() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/employer/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Không thể tải thống kê');
        }
        setData(json);
      } catch (err) {
        console.error('Fetch analytics error:', err);
        setError(err.message || 'Không thể tải thống kê');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchAnalytics();
    else setLoading(false);
  }, [token]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-navy-700 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Đang tải thống kê...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10">
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      </div>
    );
  }

  const summary = data?.summary || {
    totalJobs: 0,
    activeJobs: 0,
    totalViews: 0,
    totalCandidates: 0,
    newCandidates: 0,
    conversionRate: 0,
  };

  const weekly = data?.weekly || [];
  const weeklyViews = data?.weeklyViews || [];
  const viewsByLabel = new Map(weeklyViews.map((item) => [item.label, item.count]));
  const maxWeeklyCount = Math.max(...weekly.map((item) => item.count), 1);
  const statuses = data?.statuses || [];
  const topJobs = data?.topJobs || [];
  const sources = data?.sources || [];
  const maxSourceCount = Math.max(...sources.map((item) => item.count), 1);
  const aiInsights = data?.aiInsights || [];
  const market = data?.marketInsights || {
    summary: {
      totalJobs: 0,
      openJobs: 0,
      newJobs30d: 0,
      growth30d: 0,
      avgSalary: null,
      medianSalary: null,
      hottestRole: '',
      hottestIndustry: '',
    },
    topRoles: [],
    topIndustries: [],
    hotSkills: [],
  };

  const stats = [
    {
      label: 'Tổng lượt xem',
      value: summary.totalViews,
      helper: 'Lượt xem chi tiết tin tuyển dụng',
      icon: Eye,
      color: 'text-cyan-500',
      bg: 'bg-cyan-50',
    },
    {
      label: 'Tổng lượt ứng tuyển',
      value: summary.totalCandidates,
      helper: `${summary.newCandidates} ứng viên mới / 7 ngày`,
      icon: Users,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Conversion rate',
      value: `${summary.conversionRate}%`,
      helper: 'Ứng tuyển / lượt xem',
      icon: TrendingUp,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
    },
    {
      label: 'Tin tuyển dụng',
      value: summary.totalJobs,
      helper: `${summary.activeJobs} tin đang hiển thị`,
      icon: Briefcase,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
  ];
  const marketStats = [
    {
      label: 'Kho dữ liệu thị trường',
      value: market.summary.totalJobs,
      helper: `${market.summary.openJobs} tin còn mở`,
      icon: Briefcase,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
    },
    {
      label: 'Nhu cầu 30 ngày',
      value: market.summary.newJobs30d,
      helper: `${market.summary.growth30d >= 0 ? '+' : ''}${market.summary.growth30d}% so với 30 ngày trước`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Lương median',
      value: formatCompactCurrency(market.summary.medianSalary),
      helper: `Lương TB: ${formatCompactCurrency(market.summary.avgSalary)}`,
      icon: BarChart3,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Ngành sôi động',
      value: market.summary.hottestIndustry || 'Chưa đủ dữ liệu',
      helper: market.summary.hottestRole ? `Role nổi bật: ${market.summary.hottestRole}` : 'Chưa đủ dữ liệu role',
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color} mb-4`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <h4 className="text-2xl font-bold text-gray-800 mb-1">{stat.value}</h4>
            <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
            <p className="text-xs text-gray-400 mt-2">{stat.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-80 flex flex-col">
          <h3 className="font-bold text-gray-800 mb-6">Ứng tuyển trong 7 ngày gần nhất</h3>
          <div className="flex-1 flex flex-col min-h-0">
            {/* Bar area */}
            <div className="flex-1 border-l border-gray-200 relative flex items-end justify-between px-2 gap-3">
              {weekly.map((item) => (
                <div key={item.label} className="flex-1 flex justify-center min-w-0 h-full items-end">
                  <div
                    className="w-full bg-navy-200 hover:bg-navy-400 transition-colors rounded-t-md relative group cursor-pointer"
                    style={{ height: `${Math.max((item.count / maxWeeklyCount) * 100, item.count > 0 ? 12 : 4)}%` }}
                  >
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {item.count} ứng tuyển | {viewsByLabel.get(item.label) || 0} lượt xem
                    </span>
                  </div>
                </div>
              ))}
              {!weekly.length && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Chưa có dữ liệu 7 ngày gần nhất</div>
              )}
            </div>
            {/* Labels */}
            <div className="flex justify-between px-2 gap-3 border-t border-gray-200 pt-2 shrink-0">
              {weekly.map((item) => (
                <div key={item.label} className="flex-1 text-center">
                  <span className="text-[10px] text-gray-400">{item.label}</span>
                  <span className="block text-[10px] text-cyan-500">{viewsByLabel.get(item.label) || 0} view</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-80 flex flex-col">
          <h3 className="font-bold text-gray-800 mb-6">Phân bổ trạng thái ứng viên</h3>
          <div className="flex-1 flex flex-col justify-center gap-4">
            {statuses.length ? statuses.map((status) => {
              const width = summary.totalCandidates > 0 ? (status.count / summary.totalCandidates) * 100 : 0;
              const color = STATUS_META[status.status]?.color || 'bg-gray-500';

              return (
                <div key={status.status}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">{formatStatus(status.status)}</span>
                    <span className="text-gray-500">{status.count} hồ sơ</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            }) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Chưa có hồ sơ ứng tuyển để phân tích</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-80">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-800">Nguồn ứng viên</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>

          <div className="space-y-4">
            {sources.length ? sources.map((source) => {
              const width = (source.count / maxSourceCount) * 100;
              return (
                <div key={source.source}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">{formatSourceLabel(source.source)}</span>
                    <span className="text-gray-500">{source.count} hồ sơ</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-cyan-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            }) : (
              <div className="flex h-48 items-center justify-center text-sm text-gray-400">Chưa có dữ liệu nguồn ứng viên</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-80">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-800">AI insights cho mô tả tuyển dụng</h3>
            <Lightbulb className="w-5 h-5 text-amber-500" />
          </div>

          <div className="space-y-3">
            {aiInsights.length ? aiInsights.map((insight, index) => (
              <div key={`${insight.job_id}-${insight.type}-${index}`} className={`rounded-xl border p-4 ${getInsightTone(insight.severity)}`}>
                <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">{insight.title}</p>
                <h4 className="mt-2 text-sm font-bold">{insight.message}</h4>
                <p className="mt-2 text-sm leading-6 opacity-90">{insight.recommendation}</p>
              </div>
            )) : (
              <div className="flex h-48 items-center justify-center text-center text-sm text-gray-400">
                Chưa có cảnh báo lớn. Khi tin có lượt xem nhưng ít ứng tuyển, insight sẽ xuất hiện tại đây.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="font-bold text-gray-800">Phân tích thị trường lao động</h3>
            <p className="mt-1 text-sm text-gray-500">
              Dữ liệu tổng hợp từ kho tin tuyển dụng hiện có để theo dõi nhu cầu tuyển dụng, lương và kỹ năng nổi bật.
            </p>
          </div>
          <span className="text-xs text-gray-400 shrink-0">MVP market insights</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {marketStats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-gray-100 bg-gray-50/70 p-5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color} mb-4`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <h4 className="text-xl font-bold text-gray-800 mb-1 break-words">{stat.value}</h4>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-xs text-gray-400 mt-2">{stat.helper}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800">Tin tuyển dụng thu hút nhất</h3>
          <span className="text-xs text-gray-400">Top 5 theo số hồ sơ nhận được</span>
        </div>

        <div className="space-y-4">
          {topJobs.length ? topJobs.map((job, index) => (
            <div key={job.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/60">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-400 mb-1">TOP {index + 1}</p>
                <h4 className="font-semibold text-gray-800 truncate">{job.title}</h4>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-navy-700">{job.applicant_count}</p>
                <p className="text-xs text-gray-500">{job.view_count || 0} view | {job.conversion_rate || 0}%</p>
              </div>
            </div>
          )) : (
            <div className="text-sm text-gray-400 text-center py-8">Chưa có tin tuyển dụng nào nhận hồ sơ</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-800">Role đang có nhu cầu cao</h3>
            <span className="text-xs text-gray-400">Top 6 theo số lượng tin</span>
          </div>

          <div className="space-y-4">
            {market.topRoles.length ? market.topRoles.map((role, index) => (
              <div key={`${role.role}-${index}`} className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/60">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-400 mb-1">TOP {index + 1}</p>
                  <h4 className="font-semibold text-gray-800 break-words">{role.role}</h4>
                  <p className="mt-2 text-xs text-gray-500">
                    Median: {formatCompactCurrency(role.median_salary)} | TB: {formatCompactCurrency(role.avg_salary)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-navy-700">{role.demand_count}</p>
                  <p className="text-xs text-gray-500">tin tuyển</p>
                </div>
              </div>
            )) : (
              <div className="text-sm text-gray-400 text-center py-8">Chưa đủ dữ liệu role để phân tích</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-800">Ngành đang sôi động</h3>
            <span className="text-xs text-gray-400">Top 6 theo nhu cầu tuyển dụng</span>
          </div>

          <div className="space-y-4">
            {market.topIndustries.length ? market.topIndustries.map((industry, index) => (
              <div key={`${industry.industry}-${index}`} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/60">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-400 mb-1">TOP {index + 1}</p>
                  <h4 className="font-semibold text-gray-800 break-words">{industry.industry}</h4>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-emerald-700">{industry.demand_count}</p>
                  <p className="text-xs text-gray-500">tin tuyển</p>
                </div>
              </div>
            )) : (
              <div className="text-sm text-gray-400 text-center py-8">Chưa đủ dữ liệu ngành để phân tích</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-bold text-gray-800">Kỹ năng nổi bật trên thị trường</h3>
            <p className="mt-1 text-sm text-gray-500">Các kỹ năng xuất hiện nhiều trong `tags`, `requirements` và `description`.</p>
          </div>
          <span className="text-xs text-gray-400">Top 8</span>
        </div>

        {market.hotSkills.length ? (
          <div className="flex flex-wrap gap-3">
            {market.hotSkills.map((skill) => (
              <div key={skill.skill} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5">
                <span className="text-sm font-semibold text-gray-700">{skill.skill}</span>
                <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-700">
                  {skill.demand_count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400 text-center py-8">Chưa đủ dữ liệu kỹ năng để phân tích</div>
        )}
      </div>
    </div>
  );
}
