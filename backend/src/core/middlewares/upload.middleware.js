const path = require('path');
const multer = require('multer');

function normalizeExtension(filename = '') {
  return path.extname(String(filename || '')).toLowerCase().replace(/^\./, '');
}

function sanitizeUploadFilename(filename = 'document') {
  const safeName = String(filename || 'document')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-120);

  return safeName || 'document';
}

function createFileFilter({ allowedMimeTypes = [], allowedExtensions = [], label = 'file' } = {}) {
  const mimeSet = new Set(allowedMimeTypes);
  const extensionSet = new Set(allowedExtensions.map((item) => String(item).toLowerCase()));

  return (req, file, callback) => {
    const extension = normalizeExtension(file.originalname);
    const mimeAllowed = !mimeSet.size || mimeSet.has(file.mimetype);
    const extensionAllowed = !extensionSet.size || extensionSet.has(extension);

    if (mimeAllowed && extensionAllowed) {
      return callback(null, true);
    }

    const error = new Error(`Định dạng ${label} không được hỗ trợ.`);
    error.status = 400;
    return callback(error);
  };
}

function handleMulterUpload(uploadHandler) {
  return (req, res, next) => {
    uploadHandler(req, res, (error) => {
      if (!error) return next();

      if (error instanceof multer.MulterError) {
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        const message = error.code === 'LIMIT_FILE_SIZE'
          ? 'File quá lớn. Vui lòng chọn file nhỏ hơn.'
          : error.message;
        return res.status(status).json({ error: message, code: error.code });
      }

      return res.status(error.status || 400).json({
        error: error.message || 'Upload file thất bại.',
      });
    });
  };
}

module.exports = {
  createFileFilter,
  handleMulterUpload,
  sanitizeUploadFilename,
};
