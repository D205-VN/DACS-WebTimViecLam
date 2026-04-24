import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Briefcase, Building2, MapPin, Search, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import JobList from '@widgets/home/JobList';
import API_BASE_URL from '@shared/api/baseUrl';

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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-700"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Danh sách công ty</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chọn một công ty để xem toàn bộ tin tuyển dụng đang hiển thị.
        </p>
      </div>

      {!companies.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
          Chưa có công ty nào đang đăng tuyển.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
          <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-fit xl:sticky xl:top-20">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-navy-700" />
              <h2 className="text-base font-bold text-gray-800">Công ty</h2>
            </div>

            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm công ty..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-navy-100"
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
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'border-navy-200 bg-navy-50'
                        : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">{company.company_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" />
                        {company.job_count} tin
                      </span>
                      {company.company_size ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
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
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-navy-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-gray-800">{selectedCompany}</h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4" />
                          {activeCompany?.job_count || 0} tin đang tuyển
                        </span>
                        {activeCompany?.company_size ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            {activeCompany.company_size}
                          </span>
                        ) : null}
                        {activeCompany?.company_address ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" />
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
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
                Chọn một công ty ở bên trái để xem tin tuyển dụng.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
