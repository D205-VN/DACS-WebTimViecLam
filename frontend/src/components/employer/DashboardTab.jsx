import React from 'react';
import { FileText, TrendingUp, Users, UserPlus, ChevronRight, Briefcase, MapPin, DollarSign, Calendar, Plus, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardTab({ stats, recentJobs, loading, setActiveTab }) {
  const navigate = useNavigate();

  const displayStats = stats || {
    totalJobs: 0,
    activeJobs: 0,
    totalCandidates: 0,
    newCandidates: 0,
  };

  const statCards = [
    { label: 'Tổng tin đăng', value: displayStats.totalJobs, icon: FileText, color: 'from-blue-500 to-blue-600', bgLight: 'bg-blue-50', textColor: 'text-blue-600' },
    { label: 'Tin đang tuyển', value: displayStats.activeJobs, icon: TrendingUp, color: 'from-emerald-500 to-emerald-600', bgLight: 'bg-emerald-50', textColor: 'text-emerald-600' },
    { label: 'Tổng ứng viên', value: displayStats.totalCandidates, icon: Users, color: 'from-violet-500 to-violet-600', bgLight: 'bg-violet-50', textColor: 'text-violet-600' },
    { label: 'Ứng viên mới', value: displayStats.newCandidates, icon: UserPlus, color: 'from-amber-500 to-amber-600', bgLight: 'bg-amber-50', textColor: 'text-amber-600' },
  ];

  return (
    <>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((item, idx) => (
          <div
            key={idx}
            className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
          >
            <div className={`${item.bgLight} ${item.textColor} w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
              <item.icon className="w-5 h-5" />
            </div>
            <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider mb-1">{item.label}</p>
            <h2 className="text-2xl font-bold text-gray-800">{item.value}</h2>
          </div>
        ))}
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 text-lg">Tin tuyển dụng mới nhất</h3>
          <button
            onClick={() => setActiveTab('jobs')}
            className="text-navy-600 text-sm font-semibold hover:text-navy-800 flex items-center gap-1 transition-colors"
          >
            Xem tất cả
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-700"></div>
            </div>
          ) : recentJobs.length > 0 ? (
            recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-gray-50/80 border border-gray-100 rounded-xl hover:border-navy-200 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex items-center gap-4 mb-3 md:mb-0">
                  <div className="bg-white p-3 rounded-lg border border-gray-200 text-navy-600 group-hover:bg-gradient-to-br group-hover:from-navy-600 group-hover:to-navy-800 group-hover:text-white group-hover:border-transparent transition-all duration-200 shadow-sm">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 group-hover:text-navy-700 transition-colors">{job.title}</h4>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      {job.location && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.location}
                        </span>
                      )}
                      {job.salary ? (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> {job.salary}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Thỏa thuận
                        </span>
                      )}
                      {job.deadline && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Hạn: {new Date(job.deadline).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                      <span className="text-xs font-medium text-success-600 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {job.applicant_count || 0} Ứng viên
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all">
                    Sửa
                  </button>
                  <button onClick={() => setActiveTab('candidates')} className="px-4 py-2 bg-gradient-to-r from-navy-600 to-navy-800 text-white rounded-lg text-sm font-semibold hover:shadow-md transition-all">
                    Ứng viên
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-500 mb-4">Bạn chưa có tin tuyển dụng nào.</p>
              <button onClick={() => navigate('/employer/post-job')} className="text-navy-600 font-bold hover:underline">Đăng tin ngay</button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <button
          onClick={() => navigate('/employer/post-job')}
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-navy-200 hover:-translate-y-0.5 transition-all duration-200 text-left group"
        >
          <div className="w-10 h-10 bg-navy-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-navy-100 transition-colors">
            <Plus className="w-5 h-5 text-navy-600" />
          </div>
          <h4 className="font-bold text-gray-800 mb-1">Đăng tin mới</h4>
          <p className="text-xs text-gray-500">Tạo tin tuyển dụng để tìm ứng viên phù hợp</p>
        </button>

        <button
          onClick={() => setActiveTab('candidates')}
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-navy-200 hover:-translate-y-0.5 transition-all duration-200 text-left group"
        >
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <h4 className="font-bold text-gray-800 mb-1">Xem ứng viên</h4>
          <p className="text-xs text-gray-500">Duyệt hồ sơ ứng viên đã nộp đơn</p>
        </button>

        <button
          onClick={() => setActiveTab('company')}
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-navy-200 hover:-translate-y-0.5 transition-all duration-200 text-left group"
        >
          <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-violet-100 transition-colors">
            <Building2 className="w-5 h-5 text-violet-600" />
          </div>
          <h4 className="font-bold text-gray-800 mb-1">Hồ sơ công ty</h4>
          <p className="text-xs text-gray-500">Cập nhật thông tin và hình ảnh công ty</p>
        </button>
      </div>
    </>
  );
}
