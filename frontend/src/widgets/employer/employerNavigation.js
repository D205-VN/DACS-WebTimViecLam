import {
  BarChart3,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Users,
  Bell,
  Video,
} from 'lucide-react';

export const primaryEmployerNavItems = [
  { key: 'dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
  { key: 'jobs', label: 'Tin tuyển dụng', icon: FileText },
  { key: 'candidates', label: 'Ứng viên', icon: Users },
  { key: 'meeting-rooms', label: 'Phòng Meet', icon: Video },
  { key: 'notifications', label: 'Thông báo', icon: Bell },
];

export const secondaryEmployerNavItems = [
  { key: 'ai-tests', label: 'Bài Test AI', icon: BrainCircuit },
  { key: 'analytics', label: 'Phân tích', icon: BarChart3 },
  { key: 'company', label: 'Hồ sơ công ty', icon: Building2 },
  { key: 'onboarding', label: 'Onboarding', icon: ClipboardCheck },
];

export const employerNavItems = [
  ...primaryEmployerNavItems,
  ...secondaryEmployerNavItems,
];

export function isSecondaryEmployerNavKey(key) {
  return secondaryEmployerNavItems.some((item) => item.key === key);
}
