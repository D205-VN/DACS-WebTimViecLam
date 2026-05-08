const EMPLOYER_DASHBOARD_TABS = new Set([
  'dashboard',
  'jobs',
  'candidates',
  'notifications',
  'analytics',
  'ai-tests',
  'company',
  'onboarding',
  'meeting-rooms',
]);

export function getEmployerDashboardPath(tab = 'dashboard', params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  if (tab && tab !== 'dashboard') {
    searchParams.set('tab', tab);
  } else {
    searchParams.delete('tab');
  }

  const query = searchParams.toString();
  return query ? `/employer/dashboard?${query}` : '/employer/dashboard';
}

export function getEmployerDashboardState(tab = 'dashboard') {
  return { activeTab: tab };
}

export function getEmployerDashboardTab(location) {
  const searchParams = new URLSearchParams(location.search);
  const queryTab = searchParams.get('tab');
  const stateTab = location.state?.activeTab;

  if (EMPLOYER_DASHBOARD_TABS.has(queryTab)) return queryTab;
  if (searchParams.has('room')) return 'meeting-rooms';
  if (EMPLOYER_DASHBOARD_TABS.has(stateTab)) return stateTab;

  return 'dashboard';
}
