import { NavLink } from 'react-router-dom';
import { Bell, FileText, ShieldCheck, Sparkles } from 'lucide-react';

const seekerTools = [
  {
    to: '/seeker/cv-builder',
    label: 'Tạo CV AI',
    description: 'Tạo CV mới bằng AI',
    icon: Sparkles,
    gradient: 'from-fuchsia-500 to-indigo-600',
  },
  {
    to: '/seeker/my-cvs',
    label: 'Quản lý CV',
    description: 'Xem và tải CV đã lưu',
    icon: FileText,
    gradient: 'from-navy-600 to-cyan-600',
  },
  {
    to: '/seeker/blockchain-verification',
    label: 'Blockchain',
    description: 'Xác thực CV và hồ sơ',
    icon: ShieldCheck,
    gradient: 'from-emerald-500 to-cyan-600',
  },
  {
    to: '/seeker/job-alerts',
    label: 'Việc tương tự',
    description: 'Tin đã bật thông báo',
    icon: Bell,
    gradient: 'from-cyan-500 to-blue-600',
  },
];

export default function SeekerToolsNav() {
  return (
    <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        {seekerTools.map((tool) => (
          <NavLink
            key={tool.to}
            to={tool.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                isActive
                  ? 'bg-navy-50 text-navy-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} text-white shadow-sm`}>
                  <tool.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? 'text-navy-800' : 'text-gray-800'}`}>
                    {tool.label}
                  </p>
                  <p className="truncate text-xs text-gray-500">{tool.description}</p>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
