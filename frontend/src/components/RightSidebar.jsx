import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, Building2, Loader2, MapPin, Sparkles, TrendingUp } from 'lucide-react';

const rankColors = [
  'from-amber-400 to-orange-500',
  'from-slate-400 to-slate-600',
  'from-orange-500 to-rose-500',
  'from-navy-500 to-cyan-500',
  'from-emerald-500 to-teal-600',
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

export default function RightSidebar({ searchParams }) {
  const navigate = useNavigate();
  const [topCompanies, setTopCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [suggestedJobs, setSuggestedJobs] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/jobs/companies')
      .then((res) => res.json())
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
      limit: '4',
    });

    if (searchParams?.keyword) params.set('keyword', searchParams.keyword);
    if (searchParams?.location) params.set('location', searchParams.location);
    if (searchParams?.jobType) params.set('jobType', searchParams.jobType);
    if (searchParams?.salaryRange) params.set('salaryRange', searchParams.salaryRange);
    if (searchParams?.levels?.length) params.set('levels', searchParams.levels.join(','));
    if (searchParams?.industries?.length) params.set('industries', searchParams.industries.join(','));

    queueMicrotask(() => {
      if (!cancelled) {
        setLoadingSuggestions(true);
      }
    });

    fetch(`/api/jobs?${params.toString()}`)
      .then((res) => res.json())
      .then((payload) => {
        if (!cancelled) {
          setSuggestedJobs(payload.data || []);
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
  ]);

  const suggestionTitle = searchParams?.location
    ? `Việc gần ${searchParams.location}`
    : 'Gợi ý cho bạn';
  const suggestionDescription = searchParams?.location
    ? searchParams?.locationSource === 'geolocation'
      ? 'Ưu tiên theo vị trí hiện tại bạn vừa lấy.'
      : 'Ưu tiên theo khu vực bạn đang tìm kiếm.'
    : 'Làm mới theo từ khóa, bộ lọc và tin tuyển dụng mới nhất.';

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-navy-700" />
            <h3 className="text-base font-bold text-gray-800">Công ty hàng đầu</h3>
          </div>
          <Link to="/companies" className="text-xs text-navy-600 hover:text-navy-800 font-medium transition-colors flex items-center gap-0.5">
            Xem tất cả
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-3">
          {loadingCompanies ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 animate-pulse">
                <div className="w-11 h-11 rounded-xl bg-gray-100 shrink-0"></div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3 rounded bg-gray-100 w-2/3"></div>
                  <div className="h-3 rounded bg-gray-100 w-1/2"></div>
                </div>
              </div>
            ))
          ) : topCompanies.length > 0 ? (
            topCompanies.map((company, index) => (
              <button
                key={company.company_name}
                type="button"
                onClick={() => navigate(`/companies?company=${encodeURIComponent(company.company_name)}`)}
                className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors text-left group"
              >
                <div className={`w-11 h-11 bg-gradient-to-br ${rankColors[index % rankColors.length]} rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm font-bold text-sm`}>
                  {index < 3 ? `#${index + 1}` : getCompanyInitials(company.company_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-semibold text-gray-700 group-hover:text-navy-700 transition-colors line-clamp-2">
                      {company.company_name}
                    </h4>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-600">
                      {company.job_count} tin
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-gray-500">
                    {company.company_size ? (
                      <div className="inline-flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {company.company_size}
                      </div>
                    ) : null}
                    {company.company_address ? (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{company.company_address}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                        Đang tuyển dụng nhiều vị trí
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              Chưa có dữ liệu công ty nổi bật.
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-navy-700 to-navy-900 rounded-2xl p-5 shadow-lg shadow-navy-900/20">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
            <Sparkles className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{suggestionTitle}</h3>
            <p className="mt-1 text-xs leading-5 text-navy-200">{suggestionDescription}</p>
          </div>
        </div>

        <div className="space-y-3">
          {loadingSuggestions ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-white/10 p-3 animate-pulse">
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="mt-2 h-3 w-1/2 rounded bg-white/10" />
                <div className="mt-3 h-3 w-full rounded bg-white/10" />
              </div>
            ))
          ) : suggestedJobs.length > 0 ? (
            suggestedJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="w-full rounded-xl border border-white/10 bg-white/10 p-3 text-left backdrop-blur-sm transition-all duration-200 hover:bg-white/15"
              >
                <h4 className="text-sm font-semibold text-white">{job.title}</h4>
                <p className="mt-0.5 text-xs text-navy-200">{job.company_name || 'Đang cập nhật công ty'}</p>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="text-xs font-semibold text-emerald-300">{job.salary || 'Thỏa thuận'}</div>
                  <div className="flex items-center gap-1 text-right text-xs text-navy-200">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="line-clamp-2">{job.location || 'Chưa rõ địa điểm'}</span>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-5 text-center text-sm text-navy-200">
              Không có gợi ý phù hợp với bộ lọc hiện tại.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => document.getElementById('job-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-navy-100 transition-all hover:bg-white/10 hover:text-white"
        >
          {loadingSuggestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
          Xem việc phù hợp
        </button>
      </div>
    </div>
  );
}
