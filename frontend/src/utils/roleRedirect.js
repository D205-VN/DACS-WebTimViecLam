export function getDefaultRouteByRole(roleCode) {
  if (roleCode === 'admin') return '/admin/dashboard';
  if (roleCode === 'employer') return '/employer/dashboard';
  return '/';
}
