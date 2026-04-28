module.exports = [
  { path: '/api/jobs', router: require('./jobs/job.routes') },
  { path: '/api/auth', router: require('./auth/auth.routes') },
  { path: '/api/cv', router: require('./cv/cv.routes') },
  { path: '/api/admin', router: require('./admin/admin.routes') },
  { path: '/api/employer', router: require('./employer/employer.routes') },
  { path: '/api/verification', router: require('./verification/verification.routes') },
  { path: '/api/notifications', router: require('./notifications/notification.routes') },
  { path: '/api/match', router: require('./match/match.routes') },
  { path: '/api/messages', router: require('./messages/message.routes') },
];
