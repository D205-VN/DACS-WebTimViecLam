const ADMIN_DASHBOARD_TABS = new Set([
  'overview',
  'users',
  'jobs',
  'notifications',
  'settings',
]);

export function getAdminDashboardPath(tab = 'overview', params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  if (tab && tab !== 'overview') {
    searchParams.set('tab', tab);
  } else {
    searchParams.delete('tab');
  }

  const query = searchParams.toString();
  return query ? `/admin/dashboard?${query}` : '/admin/dashboard';
}

export function getAdminDashboardState(tab = 'overview') {
  return { activeTab: tab };
}

export function getAdminDashboardTab(location) {
  const searchParams = new URLSearchParams(location.search);
  const queryTab = searchParams.get('tab');
  const stateTab = location.state?.activeTab;

  if (ADMIN_DASHBOARD_TABS.has(queryTab)) return queryTab;
  if (ADMIN_DASHBOARD_TABS.has(stateTab)) return stateTab;

  return 'overview';
}
