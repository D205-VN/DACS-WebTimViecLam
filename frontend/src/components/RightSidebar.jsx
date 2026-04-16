import { Star, TrendingUp, ArrowRight, MapPin } from 'lucide-react';

const topCompanies = [
  { name: 'FPT Software', logo: '🏢', color: 'from-blue-500 to-cyan-500', jobs: 145, rating: 4.5 },
  { name: 'VNG Corporation', logo: '🎮', color: 'from-amber-400 to-orange-500', jobs: 89, rating: 4.3 },
  { name: 'Shopee Vietnam', logo: '🛒', color: 'from-orange-400 to-red-500', jobs: 210, rating: 4.4 },
  { name: 'MoMo', logo: '💜', color: 'from-pink-500 to-rose-600', jobs: 67, rating: 4.6 },
];

const suggestedJobs = [
  { title: 'Frontend Developer', company: 'Zalo', salary: '20-30tr', location: 'HCM' },
  { title: 'Business Analyst', company: 'Techcombank', salary: '18-25tr', location: 'HN' },
  { title: 'Mobile Developer', company: 'Grab Vietnam', salary: '25-40tr', location: 'HCM' },
];

export default function RightSidebar() {
  return (
    <div className="space-y-5">
      {/* Top Companies Widget */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-navy-700" />
            <h3 className="text-base font-bold text-gray-800">Công ty hàng đầu</h3>
          </div>
          <a href="#" className="text-xs text-navy-600 hover:text-navy-800 font-medium transition-colors flex items-center gap-0.5">
            Xem tất cả
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>

        <div className="space-y-3">
          {topCompanies.map((company) => (
            <div
              key={company.name}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              <div className={`w-10 h-10 bg-gradient-to-br ${company.color} rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm`}>
                {company.logo}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-700 group-hover:text-navy-700 transition-colors truncate">
                  {company.name}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs text-gray-500">{company.rating}</span>
                  </div>
                  <span className="text-xs text-gray-300">•</span>
                  <span className="text-xs text-success-600 font-medium">{company.jobs} việc làm</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Jobs Widget */}
      <div className="bg-gradient-to-br from-navy-700 to-navy-900 rounded-2xl p-5 shadow-lg shadow-navy-900/20">
        <h3 className="text-base font-bold text-white mb-4">💡 Gợi ý cho bạn</h3>
        <div className="space-y-3">
          {suggestedJobs.map((job, i) => (
            <div
              key={i}
              className="p-3 bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/15 cursor-pointer transition-all duration-200"
            >
              <h4 className="text-sm font-semibold text-white">{job.title}</h4>
              <p className="text-xs text-navy-200 mt-0.5">{job.company}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-emerald-400">{job.salary}</span>
                <span className="flex items-center gap-0.5 text-xs text-navy-300">
                  <MapPin className="w-3 h-3" />
                  {job.location}
                </span>
              </div>
            </div>
          ))}
        </div>
        <button className="w-full mt-4 py-2 text-sm font-semibold text-navy-200 border border-white/15 rounded-xl hover:bg-white/10 hover:text-white transition-all">
          Xem tất cả gợi ý
        </button>
      </div>
    </div>
  );
}
