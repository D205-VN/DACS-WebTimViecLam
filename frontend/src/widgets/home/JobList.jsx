import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, DollarSign, Clock, Bookmark, BookmarkCheck, Briefcase } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import { getCompanyFilterRoute, getJobDetailRoute } from '@shared/utils/roleRedirect';
import API_BASE_URL from '@shared/api/baseUrl';
import { cachedJsonFetch } from '@shared/api/requestCache';

const API = `${API_BASE_URL}/api/jobs`;

const accentColors = [
  { border: 'border-l-indigo-500', initials: 'bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-700 ring-indigo-200' },
  { border: 'border-l-violet-500', initials: 'bg-gradient-to-br from-violet-100 to-violet-50 text-violet-700 ring-violet-200' },
  { border: 'border-l-rose-500', initials: 'bg-gradient-to-br from-rose-100 to-rose-50 text-rose-700 ring-rose-200' },
  { border: 'border-l-amber-500', initials: 'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 ring-amber-200' },
  { border: 'border-l-teal-500', initials: 'bg-gradient-to-br from-teal-100 to-teal-50 text-teal-700 ring-teal-200' },
  { border: 'border-l-cyan-500', initials: 'bg-gradient-to-br from-cyan-100 to-cyan-50 text-cyan-700 ring-cyan-200' },
  { border: 'border-l-pink-500', initials: 'bg-gradient-to-br from-pink-100 to-pink-50 text-pink-700 ring-pink-200' },
  { border: 'border-l-emerald-500', initials: 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 ring-emerald-200' },
];

const tagColors = [
  'bg-indigo-50 text-indigo-700',
  'bg-violet-50 text-violet-700',
  'bg-rose-50 text-rose-700',
  'bg-cyan-50 text-cyan-700',
  'bg-teal-50 text-teal-700',
  'bg-amber-50 text-amber-700',
];

function getCompanyInitials(name = '') {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'AW';
}

export default function JobList({ searchParams, title, emptyMessage }) {
  const navigate = useNavigate();
  const { token, isAuthenticated, user } = useAuth();
  const [jobsData, setJobsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [savedIds, setSavedIds] = useState(new Set());
  const selectedLevels = useMemo(() => searchParams?.levels || [], [searchParams?.levels]);
  const selectedIndustries = useMemo(() => searchParams?.industries || [], [searchParams?.industries]);

  const fetchJobs = useCallback(async (pageNum, isAppend = false) => {
    try {
      if (isAppend) setLoadingMore(true);
      else setLoading(true);

      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '20',
      });
      if (searchParams?.keyword) params.set('keyword', searchParams.keyword);
      const hasGeoLocation =
        searchParams?.locationSource === 'geolocation' &&
        Number.isFinite(searchParams?.userCoordinates?.lat) &&
        Number.isFinite(searchParams?.userCoordinates?.lng);

      if (searchParams?.location && !hasGeoLocation) params.set('location', searchParams.location);
      if (searchParams?.jobType) params.set('jobType', searchParams.jobType);
      if (searchParams?.salaryRange) params.set('salaryRange', searchParams.salaryRange);
      if (searchParams?.company) params.set('company', searchParams.company);
      if (selectedLevels.length) params.set('levels', selectedLevels.join(','));
      if (selectedIndustries.length) params.set('industries', selectedIndustries.join(','));
      if (hasGeoLocation) {
        params.set('lat', String(searchParams.userCoordinates.lat));
        params.set('lng', String(searchParams.userCoordinates.lng));
        params.set('locationSource', 'geolocation');
      }

      const payload = await cachedJsonFetch(`${API}?${params.toString()}`, {}, { ttlMs: 20 * 1000 });

      if (isAppend) setJobsData((prev) => [...prev, ...(payload.data || [])]);
      else setJobsData(payload.data || []);

      setTotalJobs(payload.meta?.total || 0);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [
    searchParams?.keyword,
    searchParams?.location,
    searchParams?.jobType,
    searchParams?.salaryRange,
    searchParams?.company,
    searchParams?.locationSource,
    searchParams?.userCoordinates?.lat,
    searchParams?.userCoordinates?.lng,
    selectedLevels,
    selectedIndustries,
  ]);

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
  }, [fetchJobs]);

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

  const handleCompanyClick = (e, companyName) => {
    e.stopPropagation();
    if (!companyName) return;
    navigate(getCompanyFilterRoute(user?.role_code, companyName));
  };

  const isGeolocationSearch =
    searchParams?.locationSource === 'geolocation' &&
    Number.isFinite(searchParams?.userCoordinates?.lat) &&
    Number.isFinite(searchParams?.userCoordinates?.lng);
  const heading = title || (
    searchParams?.company
      ? `Tin tuyển dụng tại ${searchParams.company}`
      : isGeolocationSearch
        ? 'Việc làm gần vị trí của bạn'
        : 'Việc làm mới nhất'
  );
  const description = searchParams?.company
    ? `Tìm thấy ${loading && page === 1 ? '...' : totalJobs.toLocaleString()} tin tuyển dụng của công ty này`
    : isGeolocationSearch
      ? `Hiển thị ${loading && page === 1 ? '...' : totalJobs.toLocaleString()} việc làm, ưu tiên theo khoảng cách từ vị trí GPS hiện tại`
      : `Tìm thấy ${loading && page === 1 ? '...' : totalJobs.toLocaleString()} việc làm`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between overflow-hidden rounded-xl border border-indigo-100/60 bg-white/90 px-4 py-3 backdrop-blur-sm shadow-sm">
        <div>
          <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">{heading}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>

      {loading && page === 1 ? (
        <div className="flex items-center justify-center rounded-xl border border-indigo-100/60 bg-white/90 py-12 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {jobsData?.map((job, jobIndex) => {
              const tags = job.industry && typeof job.industry === 'string'
                ? job.industry.split(/[,/]/).map((t) => t.trim()).filter(Boolean).slice(0, 3)
                : [];
              const isSaved = savedIds.has(job.id);
              const accent = accentColors[jobIndex % accentColors.length];

              return (
                <div
                  key={job.id}
                  onClick={() => navigate(getJobDetailRoute(user?.role_code, job.id))}
                  className={`group cursor-pointer rounded-xl border border-indigo-100/50 border-l-[3px] ${accent.border} bg-white/90 p-4 backdrop-blur-sm transition-all duration-200 hover:border-indigo-200/80 hover:bg-white hover:shadow-lg hover:shadow-indigo-100/40 hover:-translate-y-0.5`}
                >
                  <div className="flex gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ${accent.initials}`}>
                      {job.company_name ? getCompanyInitials(job.company_name) : <Briefcase className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-base font-bold leading-snug text-gray-900 transition-colors group-hover:text-indigo-700">{job.title}</h3>
                          {job.company_name ? (
                            <button
                              type="button"
                              onClick={(e) => handleCompanyClick(e, job.company_name)}
                              className="mt-1 max-w-full truncate text-sm font-medium text-gray-500 transition-colors hover:text-indigo-600"
                            >
                              {job.company_name}
                            </button>
                          ) : (
                            <p className="mt-1 text-sm font-medium text-gray-500">Đang cập nhật</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleToggleSave(e, job.id)}
                          className={`shrink-0 rounded-lg p-2 transition-all duration-200 ${isSaved ? 'bg-rose-50 text-rose-500 hover:text-rose-600 shadow-sm shadow-rose-100' : 'text-gray-400 hover:bg-rose-50 hover:text-rose-500'}`}
                          title={isSaved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}
                        >
                          {isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <MapPin className="w-3.5 h-3.5 text-violet-400" />
                          <span className="capitalize">{job.location || 'Chưa rõ'}</span>
                        </span>
                        <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                          <DollarSign className="w-3.5 h-3.5" />
                          {job.salary || 'Thỏa thuận'}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          {job.job_type || 'Chính thức'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex flex-wrap gap-1.5">
                          {isGeolocationSearch && Number.isFinite(job.distance_km) ? (
                            <span className="max-w-[140px] truncate rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                              Cách bạn {job.distance_km} km
                            </span>
                          ) : null}
                          {job.career_level ? (
                            <span className="max-w-[140px] truncate rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                              {job.career_level}
                            </span>
                          ) : null}
                          {tags.map((tag, idx) => (
                            <span key={idx} className={`max-w-[120px] truncate rounded-lg px-2.5 py-1 text-[11px] font-medium ${tagColors[idx % tagColors.length]}`}>
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
            <div className="rounded-xl border border-indigo-100/60 bg-white/90 p-10 text-center text-gray-500 backdrop-blur-sm">
              {emptyMessage || 'Không tìm thấy việc làm phù hợp với bộ lọc hiện tại.'}
            </div>
          )}

          {jobsData?.length < totalJobs && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-xl border border-indigo-200 bg-white px-8 py-2.5 text-sm font-semibold text-indigo-700 transition-all duration-200 hover:bg-indigo-50 hover:shadow-md hover:shadow-indigo-100/40 disabled:opacity-50"
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
