import { useState } from 'react';
import { Search, MapPin, Briefcase, ChevronDown, Sparkles, TrendingUp, Users } from 'lucide-react';

export default function HeroSection() {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [jobTypeOpen, setJobTypeOpen] = useState(false);

  const jobTypes = [
    { value: '', label: 'Tất cả loại' },
    { value: 'remote', label: 'Remote' },
    { value: 'fulltime', label: 'Full-time' },
    { value: 'parttime', label: 'Part-time' },
    { value: 'freelance', label: 'Freelance' },
  ];

  const stats = [
    { icon: Briefcase, value: '12,500+', label: 'Việc làm mới' },
    { icon: Users, value: '8,200+', label: 'Nhà tuyển dụng' },
    { icon: TrendingUp, value: '95%', label: 'Tỷ lệ phản hồi' },
  ];

  const popularTags = ['React Developer', 'Marketing', 'Data Analyst', 'UI/UX Designer', 'Product Manager'];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-navy-600/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-navy-600/10 to-transparent rounded-full"></div>
        {/* Dot grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-sm text-navy-100">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Hơn <strong className="text-white">12,500+</strong> việc làm mới mỗi ngày</span>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white leading-tight mb-4">
            Tìm kiếm công việc
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              mơ ước của bạn
            </span>
          </h1>
          <p className="text-base sm:text-lg text-navy-200 max-w-2xl mx-auto leading-relaxed">
            Khám phá hàng ngàn cơ hội việc làm từ các công ty hàng đầu Việt Nam.
            <br className="hidden sm:block" />
            Bắt đầu hành trình sự nghiệp của bạn ngay hôm nay.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-white rounded-2xl shadow-2xl shadow-navy-900/30 p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0">
              {/* Keyword Input */}
              <div className="flex items-center gap-2 flex-1 px-4 py-3 sm:border-r border-gray-200">
                <Search className="w-5 h-5 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Chức danh, từ khóa..."
                  className="w-full text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none bg-transparent"
                />
              </div>

              {/* Location Input */}
              <div className="flex items-center gap-2 flex-1 px-4 py-3 sm:border-r border-gray-200">
                <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Địa điểm..."
                  className="w-full text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none bg-transparent"
                />
              </div>

              {/* Job Type Dropdown */}
              <div className="relative flex-1">
                <button
                  onClick={() => setJobTypeOpen(!jobTypeOpen)}
                  className="flex items-center justify-between gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-gray-400 shrink-0" />
                    <span className={jobType ? 'text-gray-800' : 'text-gray-400'}>
                      {jobType ? jobTypes.find(j => j.value === jobType)?.label : 'Loại công việc'}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${jobTypeOpen ? 'rotate-180' : ''}`} />
                </button>
                {jobTypeOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl shadow-gray-200/50 py-1 z-10">
                    {jobTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => {
                          setJobType(type.value);
                          setJobTypeOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          jobType === type.value
                            ? 'text-navy-700 bg-navy-50 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Button */}
              <button className="bg-gradient-to-r from-navy-600 to-navy-800 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-navy-700/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 shrink-0">
                <span className="hidden sm:inline">Tìm kiếm</span>
                <Search className="w-5 h-5 sm:hidden" />
              </button>
            </div>
          </div>
        </div>

        {/* Popular search tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          <span className="text-sm text-navy-300">Phổ biến:</span>
          {popularTags.map((tag) => (
            <button
              key={tag}
              className="px-3 py-1 text-xs font-medium text-navy-200 bg-white/8 border border-white/10 rounded-full hover:bg-white/15 hover:text-white transition-all duration-200"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 sm:gap-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <stat.icon className="w-5 h-5 text-emerald-400" />
                <span className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</span>
              </div>
              <span className="text-sm text-navy-300">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
