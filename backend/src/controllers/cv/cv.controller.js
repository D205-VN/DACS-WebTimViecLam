const cvService = require('../../services/cv/cv.service');

const delegate = (handler) => (req, res, next) => handler(req, res, next);

module.exports = {
  getSuggestions: delegate(cvService.getSuggestions),
  generateCV: delegate(cvService.generateCV),
  saveCV: delegate(cvService.saveCV),
  getMyCVs: delegate(cvService.getMyCVs),
  setPrimaryCV: delegate(cvService.setPrimaryCV),
  importFromImage: delegate(cvService.importFromImage),
  reviewCVContent: delegate(cvService.reviewCVContent),
  reviewSavedCV: delegate(cvService.reviewSavedCV),
  reviseCVContent: delegate(cvService.reviseCVContent),
  reviseSavedCV: delegate(cvService.reviseSavedCV),
  deleteCV: delegate(cvService.deleteCV),
};
