import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import {
  isSecondaryEmployerNavKey,
  primaryEmployerNavItems,
  secondaryEmployerNavItems,
} from '@components/employer/employerNavigation';
import { getEmployerDashboardPath, getEmployerDashboardState } from '@services/employer/dashboardRoutes';

export default function EmployerSidebar({ activeKey, onSelect }) {
  const navigate = useNavigate();
  const [toolsOpen, setToolsOpen] = useState(() => isSecondaryEmployerNavKey(activeKey));
  const toolsExpanded = toolsOpen || isSecondaryEmployerNavKey(activeKey);

  const handleNavigate = (key) => {
    if (onSelect) {
      onSelect(key);
      return;
    }

    navigate(getEmployerDashboardPath(key), { state: getEmployerDashboardState(key) });
  };

  const renderItem = (item) => {
    const active = activeKey === item.key;

    return (
      <button
        key={item.key}
        type="button"
        onClick={() => handleNavigate(item.key)}
        className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm font-medium transition-all duration-300 ${
          active
            ? 'bg-gradient-to-r from-indigo-50 to-violet-50 font-semibold text-indigo-700 shadow-sm shadow-indigo-100/50'
            : 'text-gray-600 hover:bg-indigo-50/40 hover:text-indigo-700'
        }`}
      >
        <item.icon className={`h-[18px] w-[18px] transition-colors duration-300 ${active ? 'text-indigo-600' : ''}`} />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <aside className="w-full shrink-0 lg:w-64">
      <div className="sticky top-[72px] rounded-2xl border border-indigo-100/60 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => navigate('/employer/post-job')}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 hover:shadow-xl hover:shadow-indigo-300/60"
        >
          <Plus className="h-4 w-4" />
          Đăng tin mới
        </button>

        <div className="mb-4 border-t border-indigo-50"></div>

        <h3 className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Quản lý</h3>
        <div className="space-y-1">
          {primaryEmployerNavItems.map(renderItem)}
        </div>

        <div className="mt-4 border-t border-indigo-50 pt-3">
          <button
            type="button"
            onClick={() => setToolsOpen((current) => !current)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-400 transition-colors hover:bg-indigo-50/40 hover:text-indigo-600"
          >
            Công cụ khác
            <ChevronDown className={`h-4 w-4 transition-transform ${toolsExpanded ? 'rotate-180' : ''}`} />
          </button>
          {toolsExpanded && (
            <div className="mt-1 space-y-1">
              {secondaryEmployerNavItems.map(renderItem)}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
