import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, Building2, Loader2, MapPin, Sparkles, TrendingUp } from 'lucide-react';
import { useAuth } from '@components/providers/AuthContext';
import { getCompanyFilterRoute, getJobDetailRoute, getRouteByRole } from '@services/navigation/roleRedirect';
import API_BASE_URL from '@services/http/baseUrl';
import { cachedJsonFetch } from '@services/http/requestCache';

const rankColors = [
  'bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-700',
  'bg-gradient-to-br from-slate-100 to-gray-50 text-slate-700',
  'bg-gradient-to-br from-orange-100 to-amber-50 text-orange-700',
  'bg-gradient-to-br from-indigo-100 to-blue-50 text-indigo-700',
  'bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700',
];

function getCompanyInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function Panel({ children, accentColor = 'from-indigo-500 to-violet-500' }) {
  return (
    <section className="overflow-hidden rounded-xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm">
      <div className={`h-1 bg-gradient-to-r ${accentColor}`}></div>
      {children}
    </section>
  );
}

export default function RightSidebar({ searchParams }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [topCompanies, setTopCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [suggestedJobs, setSuggestedJobs] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  useEffect(() => {
    let cancelled = false;

    cachedJsonFetch(`${API_BASE_URL}/api/jobs/companies`, {}, { ttlMs: 5 * 60 * 1000 })
      .then((payload) => {
        if (!cancelled) {
          setTopCompanies((payload.data || []).slice(0, 5));
          setLoadingCompanies(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTopCompanies([]);
          setLoadingCompanies(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: '1',
      limit: '20',
    });
    const hasGeoLocation =
      searchParams?.locationSource === 'geolocation' &&
      Number.isFinite(searchParams?.userCoordinates?.lat) &&
      Number.isFinite(searchParams?.userCoordinates?.lng);

    if (searchParams?.keyword) params.set('keyword', searchParams.keyword);
    if (searchParams?.location && !hasGeoLocation) params.set('location', searchParams.location);
    if (searchParams?.jobType) params.set('jobType', searchParams.jobType);
    if (searchParams?.salaryRange) params.set('salaryRange', searchParams.salaryRange);
    if (searchParams?.levels?.length) params.set('levels', searchParams.levels.join(','));
    if (searchParams?.industries?.length) params.set('industries', searchParams.industries.join(','));
    if (hasGeoLocation) {
      params.set('lat', String(searchParams.userCoordinates.lat));
      params.set('lng', String(searchParams.userCoordinates.lng));
      params.set('locationSource', 'geolocation');
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setLoadingSuggestions(true);
      }
    });

    cachedJsonFetch(`${API_BASE_URL}/api/jobs?${params.toString()}`, {}, { ttlMs: 20 * 1000 })
      .then((payload) => {
        if (!cancelled) {
          setSuggestedJobs((payload.data || []).slice(0, 4));
          setLoadingSuggestions(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestedJobs([]);
          setLoadingSuggestions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    searchParams?.keyword,
    searchParams?.location,
    searchParams?.jobType,
    searchParams?.salaryRange,
    searchParams?.levels,
    searchParams?.industries,
    searchParams?.locationSource,
    searchParams?.userCoordinates?.lat,
    searchParams?.userCoordinates?.lng,
  ]);

  const isGeolocationSearch =
    searchParams?.locationSource === 'geolocation' &&
    Number.isFinite(searchParams?.userCoordinates?.lat) &&
    Number.isFinite(searchParams?.userCoordinates?.lng);
  const suggestionTitle = isGeolocationSearch
    ? 'Việc gần vị trí của bạn'
    : searchParams?.location
      ? `Việc gần ${searchParams.location}`
      : 'Gợi ý cho bạn';
  const suggestionDescription = isGeolocationSearch
    ? 'Ưu tiên khoảng cách GPS hiện tại.'
    : searchParams?.location
      ? 'Ưu tiên khu vực bạn đang tìm.'
      : 'Cập nhật theo bộ lọc và tin mới.';

  return (
    <div className="space-y-4">
      <Panel accentColor="from-amber-500 via-orange-500 to-rose-500">
        <div className="flex items-center justify-between border-b border-indigo-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold text-gray-900">Công ty hàng đầu</h3>
          </div>
          <Link to={getRouteByRole(user?.role_code, 'companies')} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800">
            Xem tất cả
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="space-y-1 p-2">
          {loadingCompanies ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-3 rounded-lg p-2">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50"></div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-indigo-50"></div>
                  <div className="h-3 w-1/2 rounded bg-indigo-50"></div>
                </div>
              </div>
            ))
          ) : topCompanies.length > 0 ? (
            topCompanies.map((company, index) => (
              <button
                key={company.company_name}
                type="button"
                onClick={() => navigate(getCompanyFilterRoute(user?.role_code, company.company_name))}
                className="group flex w-full items-start gap-3 rounded-lg p-2 text-left transition-all duration-200 hover:bg-indigo-50/50"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${rankColors[index % rankColors.length]}`}>
                  {index < 3 ? `#${index + 1}` : getCompanyInitials(company.company_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="line-clamp-2 text-sm font-semibold text-gray-800 transition-colors group-hover:text-indigo-700">
                      {company.company_name}
                    </h4>
                    <span className="shrink-0 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 px-2 py-1 text-[11px] font-semibold text-emerald-600">
                      {company.job_count} tin
                    </span>
                  </div>

                  <div className="mt-1.5 space-y-1 text-xs text-gray-500">
                    {company.company_size ? (
                      <div className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-violet-400" />
                        {company.company_size}
                      </div>
                    ) : null}
                    {company.company_address ? (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                        <span className="line-clamp-2">{company.company_address}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-amber-400" />
                        Đang tuyển nhiều vị trí
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/30 px-4 py-6 text-center text-sm text-gray-500">
              Chưa có dữ liệu công ty nổi bật.
            </div>
          )}
        </div>
      </Panel>

      <Panel accentColor="from-violet-500 via-purple-500 to-indigo-500">
        <div className="border-b border-indigo-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-bold text-gray-900">{suggestionTitle}</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">{suggestionDescription}</p>
        </div>

        <div className="space-y-2 p-2">
          {loadingSuggestions ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-lg border border-indigo-50 p-3">
                <div className="h-4 w-2/3 rounded bg-indigo-50" />
                <div className="mt-2 h-3 w-1/2 rounded bg-indigo-50" />
                <div className="mt-3 h-3 w-full rounded bg-indigo-50" />
              </div>
            ))
          ) : suggestedJobs.length > 0 ? (
            suggestedJobs.map((job, idx) => {
              const borderColors = ['border-l-indigo-400', 'border-l-violet-400', 'border-l-rose-400', 'border-l-amber-400'];
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => navigate(getJobDetailRoute(user?.role_code, job.id))}
                  className={`w-full rounded-lg border border-indigo-50 border-l-[3px] ${borderColors[idx % borderColors.length]} p-3 text-left transition-all duration-200 hover:border-indigo-100 hover:bg-indigo-50/30 hover:shadow-sm`}
                >
                  <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{job.title}</h4>
                  <p className="mt-1 truncate text-xs text-gray-500">{job.company_name || 'Đang cập nhật công ty'}</p>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-emerald-600">{job.salary || 'Thỏa thuận'}</div>
                      {isGeolocationSearch && Number.isFinite(job.distance_km) ? (
                        <div className="mt-1 text-[11px] text-amber-600">Cách bạn {job.distance_km} km</div>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 items-start gap-1 text-right text-xs text-gray-500">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                      <span className="line-clamp-2">{job.location || 'Chưa rõ địa điểm'}</span>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/30 px-4 py-5 text-center text-sm text-gray-500">
              Không có gợi ý phù hợp với bộ lọc hiện tại.
            </div>
          )}
        </div>

        <div className="border-t border-indigo-50 p-3">
          <button
            type="button"
            onClick={() => document.getElementById('job-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-300/50"
          >
            {loadingSuggestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
            Xem việc phù hợp
          </button>
        </div>
      </Panel>
    </div>
  );
}
