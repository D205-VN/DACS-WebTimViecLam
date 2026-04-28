const ROUTE_BY_ROLE = {
  guest: {
    home: '/',
    companies: '/companies',
    blog: '/blog',
    profile: '/profile',
    changePassword: '/change-password',
    savedJobs: '/saved-jobs',
    appliedJobs: '/applied-jobs',
    jobAlerts: '/seeker/job-alerts',
    cvBuilder: '/seeker/cv-builder',
    myCvs: '/seeker/my-cvs',
    cvImport: '/seeker/cv-import',
    blockchainVerification: '/seeker/blockchain-verification',
  },
  seeker: {
    home: '/seeker/home',
    companies: '/seeker/companies',
    blog: '/seeker/blog',
    profile: '/seeker/profile',
    changePassword: '/seeker/change-password',
    savedJobs: '/seeker/saved-jobs',
    appliedJobs: '/seeker/applied-jobs',
    jobAlerts: '/seeker/job-alerts',
    cvBuilder: '/seeker/cv-builder',
    myCvs: '/seeker/my-cvs',
    cvImport: '/seeker/cv-import',
    blockchainVerification: '/seeker/blockchain-verification',
  },
  employer: {
    home: '/employer/dashboard',
    postJob: '/employer/post-job',
    companies: '/companies',
    blog: '/blog',
    profile: '/profile',
    changePassword: '/employer/change-password',
  },
  admin: {
    home: '/admin/dashboard',
    companies: '/companies',
    blog: '/blog',
    profile: '/profile',
    changePassword: '/admin/change-password',
  },
};

export function getRouteByRole(roleCode, key) {
  const roleKey = ROUTE_BY_ROLE[roleCode] ? roleCode : 'guest';
  return ROUTE_BY_ROLE[roleKey]?.[key] || ROUTE_BY_ROLE.guest[key] || '/';
}

export function getDefaultRouteByRole(roleCode) {
  return getRouteByRole(roleCode, 'home');
}

export function getJobDetailRoute(roleCode, jobId) {
  const basePath = roleCode === 'seeker' ? '/seeker/jobs' : '/jobs';
  return jobId ? `${basePath}/${jobId}` : basePath;
}

export function getBlogDetailRoute(roleCode, slug) {
  const basePath = getRouteByRole(roleCode, 'blog');
  return slug ? `${basePath}/${slug}` : basePath;
}

export function getCompanyFilterRoute(roleCode, companyName) {
  const basePath = getRouteByRole(roleCode, 'companies');
  if (!companyName) return basePath;
  return `${basePath}?company=${encodeURIComponent(companyName)}`;
}

export function getBackLabelByRole(roleCode) {
  if (roleCode === 'admin' || roleCode === 'employer') {
    return 'Quay lại bảng điều khiển';
  }

  if (roleCode === 'seeker') {
    return 'Quay lại trang tìm việc';
  }

  return 'Quay lại trang chủ';
}
