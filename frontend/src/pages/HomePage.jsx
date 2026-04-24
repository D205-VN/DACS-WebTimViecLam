import { useEffect, useState } from 'react';
import HeroSection from '@widgets/home/HeroSection';
import AIJobRecommendations from '@widgets/home/AIJobRecommendations';
import FilterSidebar from '@widgets/home/FilterSidebar';
import JobList from '@widgets/home/JobList';
import RightSidebar from '@widgets/home/RightSidebar';
import API_BASE_URL from '@shared/api/baseUrl';

const fallbackFilterOptions = {
  salaryRanges: [
    { value: '', label: 'Tất cả' },
    { value: '0-10', label: 'Dưới 10 triệu' },
    { value: '10-15', label: '10 - 15 triệu' },
    { value: '15-20', label: '15 - 20 triệu' },
    { value: '20-30', label: '20 - 30 triệu' },
    { value: '30+', label: 'Trên 30 triệu' },
  ],
  levels: [
    { value: 'Mới tốt nghiệp' },
    { value: 'Thực tập sinh' },
    { value: 'Nhân viên' },
    { value: 'Trưởng nhóm' },
    { value: 'Quản lý' },
  ],
  industries: [
    { value: 'lập trình viên' },
    { value: 'marketing' },
    { value: 'kế toán' },
    { value: 'nhân viên kinh doanh' },
    { value: 'hành chính' },
    { value: 'chăm sóc khách hàng' },
  ],
};

export default function HomePage() {
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    location: '',
    jobType: '',
    salaryRange: '',
    levels: [],
    industries: [],
    userCoordinates: null,
    locationSource: 'manual',
  });
  const [filterOptions, setFilterOptions] = useState(fallbackFilterOptions);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/jobs/filters`)
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.data) {
          setFilterOptions(payload.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleSearch = (nextSearch) => {
    setSearchParams((prev) => ({ ...prev, ...nextSearch }));
  };

  const handleApplyFilters = (nextFilters) => {
    setSearchParams((prev) => ({ ...prev, ...nextFilters }));
  };

  return (
    <>
      {/* Hero Section */}
      <HeroSection onSearch={handleSearch} />

      {/* AI Job Recommendations — only visible to logged-in seekers */}
      <div className="max-w-7xl mx-auto">
        <AIJobRecommendations userCoordinates={searchParams.userCoordinates} />
      </div>

      {/* Main Content: Filters + Job Feed + Sidebar */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Filters */}
          <div className="hidden lg:block w-64 shrink-0">
            <FilterSidebar
              key={[
                searchParams.salaryRange,
                searchParams.levels.join('|'),
                searchParams.industries.join('|'),
              ].join('::')}
              value={{
                salaryRange: searchParams.salaryRange,
                levels: searchParams.levels,
                industries: searchParams.industries,
              }}
              options={filterOptions}
              onApply={handleApplyFilters}
            />
          </div>

          {/* Center - Job List */}
          <div id="job-feed" className="flex-1 min-w-0">
            <JobList searchParams={searchParams} />
          </div>

          {/* Right Sidebar - Widgets */}
          <div className="hidden xl:block w-72 shrink-0">
            <RightSidebar searchParams={searchParams} />
          </div>
        </div>
      </main>
    </>
  );
}
