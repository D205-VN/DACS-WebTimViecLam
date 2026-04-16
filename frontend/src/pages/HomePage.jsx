import HeroSection from '../components/HeroSection';
import FilterSidebar from '../components/FilterSidebar';
import JobList from '../components/JobList';
import RightSidebar from '../components/RightSidebar';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Main Content: Filters + Job Feed + Sidebar */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Filters */}
          <div className="hidden lg:block w-64 shrink-0">
            <FilterSidebar />
          </div>

          {/* Center - Job List */}
          <div className="flex-1 min-w-0">
            <JobList />
          </div>

          {/* Right Sidebar - Widgets */}
          <div className="hidden xl:block w-72 shrink-0">
            <RightSidebar />
          </div>
        </div>
      </main>
    </>
  );
}
