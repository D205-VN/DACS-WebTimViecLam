module.exports = [
  { path: '/api/jobs', router: require('./job.routes') },
  { path: '/api/auth', router: require('./auth.routes') },
  { path: '/api/cv', router: require('./cv.routes') },
  { path: '/api/admin', router: require('./admin.routes') },
  { path: '/api/employer', router: require('./employer.routes') },
  { path: '/api/ai-tests', router: require('./ai-test.routes') },
  { path: '/api/verification', router: require('./verification.routes') },
  { path: '/api/notifications', router: require('./notification.routes') },
  { path: '/api/match', router: require('./match.routes') },
  { path: '/api/messages', router: require('./message.routes') },
  { path: '/api/meeting-rooms', router: require('./meeting-room.routes') },
  { path: '/api/talent-insights', router: require('./talent-insight.routes') },
];
