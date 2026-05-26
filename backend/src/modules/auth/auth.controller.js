const authService = require('./auth.service');

function isEmailDeliveryError(err) {
  const code = String(err?.code || '');
  const message = String(err?.message || '').toLowerCase();

  return [
    'EAUTH',
    'ECONNECTION',
    'ETIMEDOUT',
    'ESOCKET',
    'ENOTFOUND',
  ].includes(code) ||
    message.includes('smtp_email') ||
    message.includes('smtp_password') ||
    message.includes('timed out') ||
    message.includes('invalid login') ||
    message.includes('authentication');
}

function sendControllerError(res, err, fallbackMessage, logLabel, fallbackStatus = 500) {
  if (err?.isOperational) {
    return res.status(err.status || 400).json({
      error: err.message,
      ...(err.details || {}),
      code: err.code,
    });
  }

  console.error(logLabel, err);
  if (isEmailDeliveryError(err)) {
    return res.status(502).json({
      error: 'Không thể gửi mã OTP qua email. Vui lòng kiểm tra cấu hình gửi email trên máy chủ.',
      debug_code: err?.code || 'N/A',
      debug_message: err?.message || 'N/A',
      debug_response: err?.response || err?.responseCode || 'N/A',
    });
  }

  return res.status(fallbackStatus).json({ error: fallbackMessage });
}

async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    res.status(result.status).json(result.body);
  } catch (err) {
    sendControllerError(res, err, 'Đã xảy ra lỗi khi đăng ký', 'Register error:');
  }
}

async function verifyOTP(req, res) {
  try {
    res.json(await authService.verifyOTP(req.body));
  } catch (err) {
    sendControllerError(res, err, 'Đã xảy ra lỗi khi xác thực', 'Verify OTP error:');
  }
}

async function resendOTP(req, res) {
  try {
    res.json(await authService.resendOTP(req.body));
  } catch (err) {
    sendControllerError(res, err, 'Đã xảy ra lỗi khi gửi lại OTP', 'Resend OTP error:');
  }
}

async function login(req, res) {
  try {
    res.json(await authService.login(req.body));
  } catch (err) {
    sendControllerError(res, err, 'Đã xảy ra lỗi khi đăng nhập', 'Login error:');
  }
}

async function googleAuth(req, res) {
  try {
    res.json(await authService.googleAuth(req.body));
  } catch (err) {
    sendControllerError(res, err, 'Xác thực Google thất bại', 'Google auth error:', 400);
  }
}

async function getMe(req, res) {
  try {
    res.json(await authService.getMe(req.user.id));
  } catch (err) {
    sendControllerError(res, err, 'Đã xảy ra lỗi', 'Get me error:');
  }
}

async function updateProfile(req, res) {
  try {
    res.json(await authService.updateProfile(req.user.id, req.body));
  } catch (err) {
    sendControllerError(res, err, 'Đã xảy ra lỗi khi cập nhật thông tin', 'Update profile error:');
  }
}

async function changePassword(req, res) {
  try {
    res.json(await authService.changePassword(req.user.id, req.body));
  } catch (err) {
    sendControllerError(res, err, 'Đã xảy ra lỗi khi đổi mật khẩu', 'Change password error:');
  }
}

async function forgotPassword(req, res) {
  try {
    res.json(await authService.forgotPassword(req.body));
  } catch (err) {
    sendControllerError(res, err, 'Đã xảy ra lỗi khi gửi mã xác thực', 'Forgot password error:');
  }
}

async function verifyResetOTP(req, res) {
  try {
    res.json(await authService.verifyResetOTP(req.body));
  } catch (err) {
    sendControllerError(res, err, 'Đã xảy ra lỗi khi xác thực mã OTP', 'Verify reset OTP error:');
  }
}

async function resetPassword(req, res) {
  try {
    res.json(await authService.resetPassword(req.body));
  } catch (err) {
    sendControllerError(res, err, 'Đã xảy ra lỗi khi đặt lại mật khẩu', 'Reset password error:');
  }
}

module.exports = {
  register,
  verifyOTP,
  resendOTP,
  login,
  googleAuth,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
};
