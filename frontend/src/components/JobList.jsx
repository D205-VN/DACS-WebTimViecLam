import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, DollarSign, Clock, Bookmark, BookmarkCheck, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = '/api/jobs';

export default function JobList({ searchParams }) {
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const [jobsData, setJobsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [savedIds, setSavedIds] = useState(new Set());

  const buildQueryString = (pageNum) => {
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: '20',
    });

    if (searchParams?.keyword) params.set('q', searchParams.keyword);
    if (searchParams?.location) params.set('location', searchParams.location);
    if (searchParams?.jobType) params.set('job_type', searchParams.jobType);

    return params.toString();
  };

  const fetchJobs = async (pageNum, isAppend = false) => {
    try {
      if (isAppend) setLoadingMore(true);
      else setLoading(true);

      const res = await fetch(`${API}?${buildQueryString(pageNum)}`);
      const payload = await res.json();

      if (isAppend) setJobsData((prev) => [...prev, ...(payload.data || [])]);
      else setJobsData(payload.data || []);

      setTotalJobs(payload.meta?.total || 0);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetch(`${API}/saved-ids`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setSavedIds(new Set(d.ids || [])))
        .catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    setPage(1);
    fetchJobs(1);
  }, [searchParams?.keyword, searchParams?.location, searchParams?.jobType]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchJobs(next, true);
  };

  const handleToggleSave = async (e, jobId) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const res = await fetch(`${API}/${jobId}/save`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (data.saved) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Việc làm mới nhất</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Tìm thấy <span className="font-semibold text-navy-700">{loading && page === 1 ? '...' : totalJobs.toLocaleString()}</span> việc làm
          </p>
        </div>
      </div>

      {loading && page === 1 ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-700"></div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {jobsData?.map((job) => {
              const tags = job.industry && typeof job.industry === 'string'
                ? job.industry.split(/[,/]/).map((t) => t.trim()).filter(Boolean).slice(0, 3)
                : [];
              const isSaved = savedIds.has(job.id);

              return (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="group bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-navy-100/40 hover:-translate-y-0.5 hover:border-navy-100"
                >
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-navy-500 to-cyan-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-gray-800 group-hover:text-navy-700 transition-colors uppercase">{job.title}</h3>
                          <p className="text-sm text-gray-500 mt-0.5 font-medium">{job.company_name || 'Đang cập nhật'}</p>
                        </div>
                        <button
                          onClick={(e) => handleToggleSave(e, job.id)}
                          className={`p-1.5 transition-all shrink-0 rounded-lg ${isSaved ? 'text-red-500 hover:text-red-600 opacity-100' : 'text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100'}`}
                        >
                          {isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="capitalize">{job.location || 'Chưa rõ'}</span>
                        </span>
                        <span className="flex items-center gap-1 text-sm font-semibold text-success-600">
                          <DollarSign className="w-3.5 h-3.5" />
                          {job.salary || 'Thỏa thuận'}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          {job.job_type || 'Chính thức'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((tag, idx) => (
                            <span key={idx} className="px-2.5 py-1 text-[11px] font-medium text-navy-600 bg-navy-50 rounded-lg truncate max-w-[120px]">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-400 shrink-0 ml-3">{job.experience || 'Không yêu cầu KN'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!jobsData.length && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
              Không tìm thấy việc làm phù hợp với từ khóa hoặc địa điểm bạn đã nhập.
            </div>
          )}

          {jobsData?.length < totalJobs && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-2.5 text-sm font-semibold text-navy-700 bg-navy-50 rounded-xl hover:bg-navy-100 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Đang tải thêm...' : 'Xem thêm việc làm'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
