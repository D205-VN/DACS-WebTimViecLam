import React from 'react';
import { FileText, TrendingUp, Users, UserPlus, ChevronRight, Briefcase, MapPin, DollarSign, Calendar, Plus, Building2, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function normalizeModerationStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return ['pending', 'approved', 'rejected'].includes(normalized) ? normalized : 'approved';
}

function getJobModerationMeta(status) {
  switch (normalizeModerationStatus(status)) {
    case 'pending':
      return { label: 'Chờ duyệt', className: 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200/60' };
    case 'rejected':
      return { label: 'Từ chối', className: 'bg-gradient-to-r from-rose-50 to-pink-50 text-rose-700 border border-rose-200/60' };
    default:
      return { label: 'Đã duyệt', className: 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200/60' };
  }
}

export default function DashboardTab({ stats, recentJobs, loading, setActiveTab }) {
  const navigate = useNavigate();

  const displayStats = stats || {
    totalJobs: 0,
    activeJobs: 0,
    pendingJobs: 0,
    rejectedJobs: 0,
    totalCandidates: 0,
    newCandidates: 0,
  };

  const statCards = [
    { label: 'Tổng tin đăng', value: displayStats.totalJobs, icon: FileText, gradient: 'from-blue-500 to-indigo-600', bgLight: 'bg-blue-50', iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600' },
    { label: 'Tin đang hiển thị', value: displayStats.activeJobs, icon: TrendingUp, gradient: 'from-emerald-500 to-teal-600', bgLight: 'bg-emerald-50', iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
    { label: 'Tin chờ duyệt', value: displayStats.pendingJobs, icon: UserPlus, gradient: 'from-amber-500 to-orange-600', bgLight: 'bg-amber-50', iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600' },
    { label: 'Tổng ứng viên', value: displayStats.totalCandidates, icon: Users, gradient: 'from-violet-500 to-purple-600', bgLight: 'bg-violet-50', iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600' },
  ];

  return (
    <>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((item, idx) => (
          <div
            key={idx}
            className="group relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm p-5 shadow-sm hover:shadow-xl hover:shadow-indigo-100/40 transition-all duration-500 hover:-translate-y-1"
          >
            {/* Gradient accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${item.gradient} rounded-t-2xl`}></div>
            {/* Floating glow */}
            <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${item.gradient} opacity-[0.06] group-hover:opacity-[0.12] blur-2xl transition-opacity duration-500`}></div>

            <div className={`${item.iconBg} text-white w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-lg`}>
              <item.icon className="w-5 h-5" />
            </div>
            <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider mb-1">{item.label}</p>
            <h2 className="text-3xl font-extrabold text-gray-800">{item.value}</h2>
          </div>
        ))}
      </div>

      {/* Recent Jobs */}
      <div className="overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm">
        {/* Header with gradient bar */}
        <div className="relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-t-2xl"></div>
          <div className="p-5 pt-6 border-b border-indigo-50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200/60">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg">Tin tuyển dụng mới nhất</h3>
            </div>
            <button
              onClick={() => setActiveTab('jobs')}
              className="text-indigo-600 text-sm font-semibold hover:text-violet-700 flex items-center gap-1 transition-colors group"
            >
              Xem tất cả
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : recentJobs.length > 0 ? (
            recentJobs.map((job, idx) => {
              const borderColors = ['border-l-indigo-500', 'border-l-violet-500', 'border-l-emerald-500', 'border-l-amber-500', 'border-l-rose-500'];
              return (
                <div
                  key={job.id}
                  className={`flex flex-col md:flex-row justify-between items-start md:items-center p-4 border border-indigo-100/40 rounded-2xl hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-500 group border-l-4 ${borderColors[idx % borderColors.length]} bg-gradient-to-r from-white to-indigo-50/20 hover:-translate-y-0.5`}
                >
                  <div className="flex items-center gap-4 mb-3 md:mb-0">
                    <div className="rounded-xl border border-indigo-100/60 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 text-indigo-600 transition-all duration-200 group-hover:bg-gradient-to-br group-hover:from-indigo-100 group-hover:to-violet-100 group-hover:shadow-sm">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-gray-800 group-hover:text-indigo-700 transition-colors">{job.title}</h4>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${getJobModerationMeta(job.status).className}`}>
                          {getJobModerationMeta(job.status).label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        {job.location && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-violet-400" /> {job.location}
                          </span>
                        )}
                        {job.salary ? (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-amber-400" /> {job.salary}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-amber-400" /> Thỏa thuận
                          </span>
                        )}
                        {job.deadline && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-blue-400" /> Hạn: {new Date(job.deadline).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                          </span>
                        )}
                        <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {job.applicant_count || 0} Ứng viên
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('jobs')}
                      className="px-4 py-2 bg-white border border-indigo-100/60 rounded-xl text-sm font-semibold text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                    >
                      Quản lý tin
                    </button>
                    {normalizeModerationStatus(job.status) === 'approved' && (
                      <button onClick={() => setActiveTab('candidates')} className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all">
                        Ứng viên
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
                <Briefcase className="w-8 h-8 text-indigo-300" />
              </div>
              <p className="text-gray-500 mb-4">Bạn chưa có tin tuyển dụng nào.</p>
              <button onClick={() => navigate('/employer/post-job')} className="text-indigo-600 font-bold hover:text-violet-700 transition-colors">Đăng tin ngay</button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        {[
          {
            onClick: () => navigate('/employer/post-job'),
            icon: Plus,
            gradient: 'from-indigo-500 to-violet-600',
            shadow: 'shadow-indigo-200/60',
            title: 'Đăng tin mới',
            desc: 'Tạo tin tuyển dụng để tìm ứng viên phù hợp',
          },
          {
            onClick: () => setActiveTab('candidates'),
            icon: Users,
            gradient: 'from-emerald-500 to-teal-600',
            shadow: 'shadow-emerald-200/60',
            title: 'Xem ứng viên',
            desc: 'Duyệt hồ sơ ứng viên đã nộp đơn',
          },
          {
            onClick: () => setActiveTab('company'),
            icon: Building2,
            gradient: 'from-violet-500 to-purple-600',
            shadow: 'shadow-violet-200/60',
            title: 'Hồ sơ công ty',
            desc: 'Cập nhật thông tin và hình ảnh công ty',
          },
        ].map((action) => (
          <button
            key={action.title}
            onClick={action.onClick}
            className="group relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm p-6 text-left shadow-sm hover:shadow-xl hover:shadow-indigo-50 transition-all duration-500 hover:-translate-y-1"
          >
            <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${action.gradient} opacity-[0.05] group-hover:opacity-[0.12] blur-2xl transition-opacity duration-500`}></div>
            <div className="flex items-start justify-between relative z-10">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} text-white shadow-lg ${action.shadow}`}>
                <action.icon className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
            </div>
            <h4 className="font-bold text-gray-800 mb-1.5 relative z-10">{action.title}</h4>
            <p className="text-xs text-gray-500 relative z-10">{action.desc}</p>
          </button>
        ))}
      </div>
    </>
  );
}
