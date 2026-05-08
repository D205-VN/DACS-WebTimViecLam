import { NavLink } from 'react-router-dom';
import { Bell, FileText, ShieldCheck, Sparkles } from 'lucide-react';

const seekerTools = [
  {
    to: '/seeker/cv-builder',
    label: 'Tạo CV AI',
    description: 'Tạo CV mới bằng AI',
    icon: Sparkles,
    tone: 'bg-fuchsia-50 text-fuchsia-700',
  },
  {
    to: '/seeker/my-cvs',
    label: 'Quản lý CV',
    description: 'Xem và tải CV đã lưu',
    icon: FileText,
    tone: 'bg-indigo-50 text-indigo-700',
  },
  {
    to: '/seeker/blockchain-verification',
    label: 'Blockchain',
    description: 'Xác thực CV và hồ sơ',
    icon: ShieldCheck,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    to: '/seeker/job-alerts',
    label: 'Việc tương tự',
    description: 'Tin đã bật thông báo',
    icon: Bell,
    tone: 'bg-cyan-50 text-cyan-700',
  },
];

export default function SeekerToolsNav() {
  return (
    <div className="aw-surface mb-5 p-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        {seekerTools.map((tool) => (
          <NavLink
            key={tool.to}
            to={tool.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-indigo-50/30 hover:text-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tool.tone}`}>
                  <tool.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? 'text-indigo-800' : 'text-gray-800'}`}>
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
