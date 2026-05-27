import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Briefcase, Building2, MapPin, Search, Users, ExternalLink } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import JobList from '@components/home/JobList';
import API_BASE_URL from '@services/http/baseUrl';

const API = `${API_BASE_URL}/api/jobs`;

export default function CompaniesPage() {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const requestedCompany = urlSearchParams.get('company') || '';
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API}/companies`)
      .then((res) => res.json())
      .then((payload) => {
        if (!cancelled) {
          setCompanies(payload.data || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanies([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCompanies = useMemo(() => {
    const query = deferredKeyword.trim().toLowerCase();
    if (!query) return companies;

    return companies.filter((company) =>
      company.company_name?.toLowerCase().includes(query)
    );
  }, [companies, deferredKeyword]);

  const selectedCompany = useMemo(() => {
    if (!requestedCompany) return '';

    const matchedCompany = companies.find(
      (company) => company.company_name?.trim().toLowerCase() === requestedCompany.trim().toLowerCase()
    );

    return matchedCompany?.company_name || requestedCompany;
  }, [companies, requestedCompany]);

  useEffect(() => {
    if (loading || requestedCompany || companies.length === 0) return;
    setUrlSearchParams({ company: companies[0].company_name });
  }, [loading, requestedCompany, companies, setUrlSearchParams]);

  const activeCompany = useMemo(() => {
    if (!selectedCompany) return null;

    return companies.find(
      (company) => company.company_name?.trim().toLowerCase() === selectedCompany.trim().toLowerCase()
    ) || null;
  }, [companies, selectedCompany]);

  const handleSelectCompany = (companyName) => {
    setUrlSearchParams({ company: companyName });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-4 overflow-hidden rounded-xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"></div>
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">Danh sách công ty</h1>
          <p className="text-sm text-gray-500 mt-1">
            Chọn một công ty để xem toàn bộ tin tuyển dụng đang hiển thị.
          </p>
        </div>
      </div>

      {!companies.length ? (
        <div className="rounded-xl border border-indigo-100/60 bg-white/90 p-10 text-center text-gray-500 backdrop-blur-sm">
          Chưa có công ty nào đang đăng tuyển.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="h-fit overflow-hidden rounded-xl border border-indigo-100/60 bg-white/90 p-4 backdrop-blur-sm shadow-sm xl:sticky xl:top-16">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100">
                <Building2 className="w-4 h-4 text-indigo-700" />
              </div>
              <h2 className="text-base font-bold text-gray-800">Công ty</h2>
            </div>

            <div className="relative mb-4">
              <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm công ty..."
                className="w-full rounded-xl border border-indigo-100 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
              />
            </div>

            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {filteredCompanies.map((company) => {
                const isActive = company.company_name === selectedCompany;

                return (
                  <button
                    key={company.company_name}
                    type="button"
                    onClick={() => handleSelectCompany(company.company_name)}
                    className={`w-full rounded-xl border p-3 text-left transition-all duration-200 ${
                      isActive
                        ? 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 shadow-sm shadow-indigo-100/50'
                        : 'border-transparent hover:border-indigo-100 hover:bg-indigo-50/50'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${isActive ? 'text-indigo-700' : 'text-gray-800'}`}>{company.company_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-violet-400" />
                        {company.job_count} tin
                      </span>
                      {company.company_size ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-amber-400" />
                          {company.company_size}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}

              {!filteredCompanies.length ? (
                <div className="text-sm text-gray-500 text-center py-6">
                  Không tìm thấy công ty phù hợp.
                </div>
              ) : null}
            </div>
          </aside>

          <div className="space-y-5">
            {selectedCompany ? (
              <>
                <div className="overflow-hidden rounded-xl border border-indigo-100/60 bg-white/90 p-5 backdrop-blur-sm shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">{selectedCompany}</h2>
                        <Link
                          to={`/company?name=${encodeURIComponent(selectedCompany)}`}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-200/50 transition-all duration-200 hover:shadow-lg hover:from-indigo-700 hover:to-violet-700"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Trang công ty
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-violet-400" />
                          {activeCompany?.job_count || 0} tin đang tuyển
                        </span>
                        {activeCompany?.company_size ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-amber-400" />
                            {activeCompany.company_size}
                          </span>
                        ) : null}
                        {activeCompany?.company_address ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-rose-400" />
                            {activeCompany.company_address}
                          </span>
                        ) : null}
                      </div>
                      {activeCompany?.company_overview ? (
                        <p className="text-sm text-gray-600 leading-relaxed mt-4 whitespace-pre-line">
                          {activeCompany.company_overview}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 mt-4">
                          Chưa có mô tả chi tiết cho công ty này.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <JobList
                  searchParams={{ company: selectedCompany }}
                  title={`Tin tuyển dụng của ${selectedCompany}`}
                  emptyMessage="Công ty này hiện chưa có tin tuyển dụng."
                />
              </>
            ) : (
              <div className="rounded-xl border border-indigo-100/60 bg-white/90 p-10 text-center text-gray-500 backdrop-blur-sm">
                Chọn một công ty ở bên trái để xem tin tuyển dụng.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
