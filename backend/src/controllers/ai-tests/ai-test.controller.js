const aiTestService = require('../../services/ai-tests/ai-test.service');

const delegate = (handler) => (req, res, next) => handler(req, res, next);

module.exports = Object.fromEntries(
  Object.entries(aiTestService)
    .filter(([, handler]) => typeof handler === 'function')
    .map(([name, handler]) => [name, delegate(handler)])
);
