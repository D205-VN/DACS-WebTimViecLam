import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Briefcase, Loader2, AlertCircle } from 'lucide-react';
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
    totalCandidates: 0,
    newCandidates: 0,
    conversionRate: 0,
  };

  const weekly = data?.weekly || [];
  const maxWeeklyCount = Math.max(...weekly.map((item) => item.count), 1);
  const statuses = data?.statuses || [];
  const topJobs = data?.topJobs || [];

  const stats = [
    {
      label: 'Tổng tin tuyển dụng',
      value: summary.totalJobs,
      helper: `${summary.activeJobs} tin đang tuyển`,
      icon: Briefcase,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
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
      label: 'Tỷ lệ ứng tuyển / tin',
      value: `${summary.conversionRate}%`,
      helper: 'Dựa trên tin còn hoạt động',
      icon: TrendingUp,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
    },
    {
      label: 'Trạng thái hồ sơ',
      value: statuses.length,
      helper: 'Nhóm trạng thái đang có dữ liệu',
      icon: BarChart3,
      color: 'text-violet-500',
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
                      {item.count}
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
                <p className="text-xs text-gray-500">ứng viên</p>
              </div>
            </div>
          )) : (
            <div className="text-sm text-gray-400 text-center py-8">Chưa có tin tuyển dụng nào nhận hồ sơ</div>
          )}
        </div>
      </div>
    </div>
  );
}
