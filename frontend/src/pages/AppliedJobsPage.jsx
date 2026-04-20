import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, MapPin, DollarSign, Clock, Briefcase, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = '/api/jobs';

const statusMap = {
  pending: { label: 'Đang chờ', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  viewed: { label: 'Đã xem', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  invited: { label: 'Được mời PV', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  rejected: { label: 'Từ chối', color: 'bg-red-50 text-red-600 border-red-200' },
};

export default function AppliedJobsPage() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/applied`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setJobs(d.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
          <Send className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Việc làm đã ứng tuyển</h1>
          <p className="text-sm text-gray-500">{jobs.length} việc làm</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-navy-600" /></div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Send className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Bạn chưa ứng tuyển việc làm nào.</p>
          <Link to="/" className="inline-block mt-4 text-sm font-semibold text-navy-700 hover:underline">Khám phá việc làm →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const st = statusMap[job.status] || statusMap.pending;
            return (
              <div key={job.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-navy-100 transition-all group">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-navy-500 to-cyan-500 rounded-xl flex items-center justify-center text-white shrink-0">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/jobs/${job.id}`} className="block">
                        <h3 className="text-base font-bold text-gray-800 group-hover:text-navy-700 transition-colors uppercase">{job.title}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{job.company_name || 'Đang cập nhật'}</p>
                      </Link>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-lg border shrink-0 ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      <span className="flex items-center gap-1 text-sm text-gray-500"><MapPin className="w-3.5 h-3.5" />{job.location || 'Chưa rõ'}</span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-success-600"><DollarSign className="w-3.5 h-3.5" />{job.salary || 'Thỏa thuận'}</span>
                      <span className="flex items-center gap-1 text-sm text-gray-500"><Clock className="w-3.5 h-3.5" />{new Date(job.applied_at).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
