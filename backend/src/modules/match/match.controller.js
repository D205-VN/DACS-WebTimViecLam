const matchService = require('./match.service');

exports.getRecommendations = async (req, res) => {
  try {
    res.json(await matchService.getRecommendations(req.user.id, req.query));
  } catch (err) {
    console.error('Match recommendations error:', err);
    res.status(500).json({ error: 'Lỗi khi tính gợi ý việc làm' });
  }
};
