const verificationService = require('../services/verification.service');

function sendControllerError(res, err, fallbackMessage, logLabel) {
  if (err?.isOperational) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code });
  }

  console.error(logLabel, err);
  return res.status(500).json({ error: fallbackMessage });
}

async function getOverview(req, res) {
  try {
    res.json(await verificationService.getOverview(req.user));
  } catch (err) {
    sendControllerError(res, err, 'Không thể tải dữ liệu blockchain verification', 'Get blockchain verification overview error:');
  }
}

async function notarizeCv(req, res) {
  try {
    const result = await verificationService.notarizeCv(req.user, req.params.id);
    res.status(result.status).json(result.body);
  } catch (err) {
    sendControllerError(res, err, 'Không thể xác thực CV bằng blockchain', 'Notarize CV error:');
  }
}

async function createCertificate(req, res) {
  try {
    res.status(201).json(await verificationService.createCertificate(req.user, req.body));
  } catch (err) {
    sendControllerError(res, err, 'Không thể tạo chứng chỉ xác thực', 'Create certificate verification error:');
  }
}

async function getCertificates(req, res) {
  try {
    res.json(await verificationService.getCertificates(req.user));
  } catch (err) {
    sendControllerError(res, err, 'Không thể tải danh sách chứng chỉ xác thực', 'Get certificates verification error:');
  }
}

async function revokeCertificate(req, res) {
  try {
    res.json(await verificationService.revokeCertificate(req.user, req.params.id));
  } catch (err) {
    sendControllerError(res, err, 'Không thể thu hồi chứng chỉ xác thực', 'Revoke certificate verification error:');
  }
}

async function createWorkHistory(req, res) {
  try {
    res.status(201).json(await verificationService.createWorkHistory(req.user, req.body));
  } catch (err) {
    sendControllerError(res, err, 'Không thể tạo lịch sử làm việc xác thực', 'Create work history verification error:');
  }
}

async function getWorkHistories(req, res) {
  try {
    res.json(await verificationService.getWorkHistories(req.user));
  } catch (err) {
    sendControllerError(res, err, 'Không thể tải lịch sử làm việc xác thực', 'Get work histories verification error:');
  }
}

async function revokeWorkHistory(req, res) {
  try {
    res.json(await verificationService.revokeWorkHistory(req.user, req.params.id));
  } catch (err) {
    sendControllerError(res, err, 'Không thể thu hồi lịch sử làm việc xác thực', 'Revoke work history verification error:');
  }
}

async function getPublicVerification(req, res) {
  try {
    res.json(await verificationService.getPublicVerification(req.params.code));
  } catch (err) {
    sendControllerError(res, err, 'Không thể kiểm tra mã xác thực blockchain', 'Public blockchain verification error:');
  }
}

module.exports = {
  createCertificate,
  createWorkHistory,
  getCertificates,
  getOverview,
  getPublicVerification,
  getWorkHistories,
  notarizeCv,
  revokeCertificate,
  revokeWorkHistory,
};
