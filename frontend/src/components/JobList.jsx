import { MapPin, DollarSign, Clock, Heart, Bookmark } from 'lucide-react';

const jobsData = [
  {
    id: 1,
    title: 'Senior React Developer',
    company: 'FPT Software',
    logo: '🏢',
    logoColor: 'from-blue-500 to-cyan-500',
    location: 'Hà Nội',
    salary: '25 - 35 triệu',
    type: 'Full-time',
    tags: ['React', 'TypeScript', 'Redux'],
    posted: '2 giờ trước',
    hot: true,
  },
  {
    id: 2,
    title: 'Marketing Manager',
    company: 'Shopee Vietnam',
    logo: '🛒',
    logoColor: 'from-orange-400 to-red-500',
    location: 'Hồ Chí Minh',
    salary: '20 - 30 triệu',
    type: 'Full-time',
    tags: ['Digital Marketing', 'SEO', 'Analytics'],
    posted: '5 giờ trước',
    hot: true,
  },
  {
    id: 3,
    title: 'UI/UX Designer',
    company: 'Tiki Corporation',
    logo: '🎨',
    logoColor: 'from-violet-500 to-purple-600',
    location: 'Remote',
    salary: '18 - 25 triệu',
    type: 'Remote',
    tags: ['Figma', 'Adobe XD', 'Prototyping'],
    posted: '1 ngày trước',
    hot: false,
  },
  {
    id: 4,
    title: 'Data Analyst',
    company: 'Vietcombank',
    logo: '🏦',
    logoColor: 'from-emerald-500 to-teal-600',
    location: 'Hà Nội',
    salary: '15 - 22 triệu',
    type: 'Full-time',
    tags: ['Python', 'SQL', 'Power BI'],
    posted: '1 ngày trước',
    hot: false,
  },
  {
    id: 5,
    title: 'Product Manager',
    company: 'VNG Corporation',
    logo: '🎮',
    logoColor: 'from-amber-400 to-orange-500',
    location: 'Hồ Chí Minh',
    salary: '30 - 45 triệu',
    type: 'Full-time',
    tags: ['Agile', 'Scrum', 'Jira'],
    posted: '3 giờ trước',
    hot: true,
  },
  {
    id: 6,
    title: 'DevOps Engineer',
    company: 'MoMo',
    logo: '💜',
    logoColor: 'from-pink-500 to-rose-600',
    location: 'Hồ Chí Minh',
    salary: '28 - 40 triệu',
    type: 'Full-time',
    tags: ['AWS', 'Docker', 'Kubernetes'],
    posted: '6 giờ trước',
    hot: false,
  },
];

export default function JobList() {
  return (
    <div>
      {/* Results Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Việc làm mới nhất</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tìm thấy <span className="font-semibold text-navy-700">12,543</span> việc làm</p>
        </div>
        <select className="text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-200 cursor-pointer">
          <option>Mới nhất</option>
          <option>Lương cao nhất</option>
          <option>Phù hợp nhất</option>
        </select>
      </div>

      {/* Job Cards */}
      <div className="space-y-3">
        {jobsData.map((job) => (
          <div
            key={job.id}
            className="group bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-navy-100/40 hover:-translate-y-0.5 hover:border-navy-100"
          >
            <div className="flex gap-4">
              {/* Company Logo */}
              <div className={`w-12 h-12 bg-gradient-to-br ${job.logoColor} rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm`}>
                {job.logo}
              </div>

              {/* Job Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-800 group-hover:text-navy-700 transition-colors">
                        {job.title}
                      </h3>
                      {job.hot && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-100 rounded-full">
                          Hot 🔥
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{job.company}</p>
                  </div>
                  <button className="p-1.5 text-gray-300 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                    <Bookmark className="w-5 h-5" />
                  </button>
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="w-3.5 h-3.5" />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-success-600">
                    <DollarSign className="w-3.5 h-3.5" />
                    {job.salary}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    {job.type}
                  </span>
                </div>

                {/* Tags & Time */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {job.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 text-xs font-medium text-navy-600 bg-navy-50 rounded-lg"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-3">{job.posted}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      <div className="mt-6 text-center">
        <button className="px-8 py-2.5 text-sm font-semibold text-navy-700 bg-navy-50 rounded-xl hover:bg-navy-100 transition-colors">
          Xem thêm việc làm
        </button>
      </div>
    </div>
  );
}
