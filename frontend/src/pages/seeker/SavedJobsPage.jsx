import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkX, MapPin, DollarSign, Clock, Briefcase, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@components/providers/AuthContext';
import { getBackLabelByRole, getDefaultRouteByRole, getJobDetailRoute } from '@services/navigation/roleRedirect';
import API_BASE_URL from '@services/http/baseUrl';

const API = `${API_BASE_URL}/api/jobs`;

export default function SavedJobsPage() {
  const { token, user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const backLabel = getBackLabelByRole(user?.role_code);

  useEffect(() => {
    fetch(`${API}/saved`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setJobs(d.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  const handleUnsave = async (jobId) => {
    await fetch(`${API}/${jobId}/save`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setJobs(prev => prev.filter(j => j.id !== jobId));
  };

  return (
    <div className="aw-container max-w-5xl py-6">
      <Link to={backRoute} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      <div className="aw-surface mb-4 flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
          <Bookmark className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Việc làm đã lưu</h1>
          <p className="text-sm text-gray-500">{jobs.length} việc làm</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : jobs.length === 0 ? (
        <div className="aw-surface p-12 text-center">
          <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Bạn chưa lưu việc làm nào.</p>
          <Link to={backRoute} className="inline-block mt-4 text-sm font-semibold text-indigo-700 hover:underline">Khám phá việc làm →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="aw-surface group p-5 transition-colors hover:border-gray-300 hover:bg-indigo-50/30">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={getJobDetailRoute(user?.role_code, job.id)} className="block">
                      <h3 className="line-clamp-2 text-base font-bold text-gray-900 transition-colors group-hover:text-indigo-700">{job.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{job.company_name || 'Đang cập nhật'}</p>
                    </Link>
                    <button onClick={() => handleUnsave(job.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Bỏ lưu">
                      <BookmarkX className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    <span className="flex items-center gap-1 text-sm text-gray-500"><MapPin className="w-3.5 h-3.5" />{job.location || 'Chưa rõ'}</span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-success-600"><DollarSign className="w-3.5 h-3.5" />{job.salary || 'Thỏa thuận'}</span>
                    <span className="flex items-center gap-1 text-sm text-gray-500"><Clock className="w-3.5 h-3.5" />{new Date(job.saved_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
