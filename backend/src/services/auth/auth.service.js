const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const AppError = require('../../core/errors/AppError');
const { sendOTPEmail, sendPasswordResetOTPEmail } = require('../email/email.service');
const { ensureUserAccountStatusSchema } = require('../../models/auth/auth.model');
const repository = require('../../repositories/auth/auth.repository');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const OTP_TTL_MS = 5 * 60 * 1000;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role_code: user.role_code, role_name: user.role_name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function getPublicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role_code: user.role_code,
    role_name: user.role_name,
    avatar_url: user.avatar_url,
  };
}

async function createAndSendOtp(email, sendEmail = sendOTPEmail, otpEmail = email) {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await repository.replaceOtp(otpEmail, otp, expiresAt);
  await sendEmail(email, otp);
}

async function register(body = {}) {
  const { fullName, email, phone, password, role_code, companyName, companyEmail, companyCity, companyWard } = body;
  const existing = await repository.findUserByEmail(email, 'id, is_verified');

  if (existing) {
    if (existing.is_verified) throw new AppError('Email này đã được đăng ký', 400, 'EMAIL_EXISTS');
    await repository.deleteUser(existing.id);
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const roleId = role_code === 'employer' ? 2 : 3;
  const user = await repository.createUser({
    fullName,
    email,
    phone,
    passwordHash,
    roleId,
    companyName,
    companyEmail,
    companyCity,
    companyWard,
  });

  await createAndSendOtp(email);

  return {
    status: 201,
    body: {
      message: 'Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP.',
      email: user.email,
    },
  };
}

async function verifyOTP(body = {}) {
  const { email, otp } = body;
  await ensureUserAccountStatusSchema();

  const validOtp = await repository.findValidOtp(email, otp);
  if (!validOtp) throw new AppError('Mã OTP không hợp lệ hoặc đã hết hạn', 400, 'INVALID_OTP');

  await repository.markUserVerified(email);
  await repository.deleteOtps(email);

  const user = await repository.findUserWithRoleByEmail(email);
  if (user?.is_suspended) {
    throw new AppError('Tài khoản của bạn đã bị tạm dừng bởi quản trị viên.', 403, 'ACCOUNT_SUSPENDED', { suspended: true });
  }

  return {
    message: 'Xác thực thành công!',
    token: createToken(user),
    user,
  };
}

async function resendOTP(body = {}) {
  const { email } = body;
  const user = await repository.findUserByEmail(email, 'id, is_verified');
  if (!user) throw new AppError('Email không tồn tại', 404, 'EMAIL_NOT_FOUND');
  if (user.is_verified) throw new AppError('Tài khoản đã được xác thực', 400, 'ALREADY_VERIFIED');

  await createAndSendOtp(email);
  return { message: 'Đã gửi lại mã OTP. Vui lòng kiểm tra email.' };
}

async function login(body = {}) {
  const { email, password } = body;
  await ensureUserAccountStatusSchema();

  const user = await repository.findUserWithRoleByEmail(email, true);
  if (!user) throw new AppError('Email hoặc mật khẩu không đúng', 401, 'INVALID_CREDENTIALS');
  if (!user.password_hash) {
    throw new AppError('Tài khoản này được đăng ký qua Google. Vui lòng đăng nhập bằng Google.', 400, 'GOOGLE_ACCOUNT');
  }
  if (!user.is_verified) {
    throw new AppError('Tài khoản chưa được xác thực email', 403, 'EMAIL_NOT_VERIFIED', { needVerify: true, email: user.email });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) throw new AppError('Email hoặc mật khẩu không đúng', 401, 'INVALID_CREDENTIALS');
  if (user.is_suspended) {
    throw new AppError('Tài khoản của bạn đã bị tạm dừng bởi quản trị viên. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.', 403, 'ACCOUNT_SUSPENDED', { suspended: true });
  }

  return {
    message: 'Đăng nhập thành công!',
    token: createToken(user),
    user: getPublicUser(user),
  };
}

async function googleAuth(body = {}) {
  await ensureUserAccountStatusSchema();

  const ticket = await googleClient.verifyIdToken({
    idToken: body.credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  const { sub: googleId, email, name, picture } = payload;
  let user = await repository.findUserWithRoleByEmail(email, true);

  if (!user) {
    await repository.createGoogleUser({ name, email, googleId, picture });
  } else if (!user.google_id) {
    await repository.attachGoogleInfo({ googleId, picture, email });
  }

  user = await repository.findUserWithRoleByEmail(email);
  if (user.is_suspended) {
    throw new AppError('Tài khoản của bạn đã bị tạm dừng bởi quản trị viên. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.', 403, 'ACCOUNT_SUSPENDED', { suspended: true });
  }

  return {
    message: 'Đăng nhập Google thành công!',
    token: createToken(user),
    user,
  };
}

async function getMe(userId) {
  const user = await repository.findMe(userId);
  if (!user) throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
  if (user.is_suspended) {
    throw new AppError('Tài khoản của bạn đã bị tạm dừng bởi quản trị viên.', 403, 'ACCOUNT_SUSPENDED', { suspended: true });
  }

  return { user };
}

function resolveNextValue(incomingValue, currentValue) {
  if (incomingValue === undefined) return currentValue;
  const trimmed = String(incomingValue).trim();
  return trimmed || null;
}

async function updateProfile(userId, body = {}) {
  const currentUser = await repository.findRawUserById(userId);
  if (!currentUser) throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');

  const nextFullName = String(body.fullName ?? currentUser.full_name ?? '').trim();
  if (!nextFullName) throw new AppError('Họ và tên không được để trống', 400, 'FULL_NAME_REQUIRED');

  const user = await repository.updateProfile(userId, {
    fullName: nextFullName,
    phone: resolveNextValue(body.phone, currentUser.phone),
    avatarUrl: resolveNextValue(body.avatarUrl ?? body.avatar_url, currentUser.avatar_url),
    companyName: resolveNextValue(body.companyName, currentUser.company_name),
    companyEmail: resolveNextValue(body.companyEmail, currentUser.company_email),
    companyCity: resolveNextValue(body.companyCity, currentUser.company_city),
    companyWard: resolveNextValue(body.companyWard, currentUser.company_ward),
  });

  return {
    message: 'Cập nhật thông tin thành công',
    user,
  };
}

async function changePassword(userId, body = {}) {
  const user = await repository.findRawUserById(userId);
  if (!user) throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
  if (!user.password_hash) throw new AppError('Tài khoản đăng ký qua Google không có mật khẩu để đổi', 400, 'GOOGLE_ACCOUNT');

  const isMatch = await bcrypt.compare(body.currentPassword, user.password_hash);
  if (!isMatch) throw new AppError('Mật khẩu hiện tại không đúng', 401, 'INVALID_CURRENT_PASSWORD');

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(body.newPassword, salt);
  await repository.updatePasswordById(userId, newHash);

  return { message: 'Đổi mật khẩu thành công!' };
}

async function forgotPassword(body = {}) {
  const email = body.email;
  if (!email?.trim()) throw new AppError('Vui lòng nhập email', 400, 'EMAIL_REQUIRED');

  const user = await repository.findUserByEmail(email, 'id, is_verified, password_hash');
  if (!user) throw new AppError('Email không tồn tại trong hệ thống', 404, 'EMAIL_NOT_FOUND');
  if (!user.is_verified) throw new AppError('Tài khoản chưa được xác thực email. Vui lòng đăng ký lại.', 400, 'EMAIL_NOT_VERIFIED');
  if (!user.password_hash) throw new AppError('Tài khoản này được đăng ký qua Google. Vui lòng đăng nhập bằng Google.', 400, 'GOOGLE_ACCOUNT');

  await createAndSendOtp(email, sendPasswordResetOTPEmail, `reset:${email}`);
  return { message: 'Mã xác thực đã được gửi đến email của bạn.', email };
}

async function verifyResetOTP(body = {}) {
  const { email, otp } = body;
  if (!email || !otp) throw new AppError('Vui lòng nhập đầy đủ email và mã OTP', 400, 'RESET_OTP_REQUIRED');

  const resetEmail = `reset:${email}`;
  const validOtp = await repository.findValidOtp(resetEmail, otp);
  if (!validOtp) throw new AppError('Mã OTP không hợp lệ hoặc đã hết hạn', 400, 'INVALID_OTP');

  const resetToken = jwt.sign(
    { email, purpose: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
  await repository.deleteOtps(resetEmail);

  return { message: 'Xác thực thành công! Bạn có thể đặt lại mật khẩu.', resetToken };
}

async function resetPassword(body = {}) {
  const { resetToken, newPassword } = body;
  if (!resetToken || !newPassword) throw new AppError('Thiếu thông tin cần thiết', 400, 'RESET_PASSWORD_REQUIRED');
  if (newPassword.length < 8) throw new AppError('Mật khẩu mới phải có ít nhất 8 ký tự', 400, 'PASSWORD_TOO_SHORT');

  let decoded;
  try {
    decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thử lại.', 400, 'RESET_TOKEN_EXPIRED');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AppError('Token không hợp lệ', 400, 'INVALID_RESET_TOKEN');
    }
    throw err;
  }

  if (decoded.purpose !== 'password_reset') throw new AppError('Token không hợp lệ', 400, 'INVALID_RESET_TOKEN');

  const user = await repository.findUserByEmail(decoded.email, 'id');
  if (!user) throw new AppError('Không tìm thấy tài khoản', 404, 'USER_NOT_FOUND');

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);
  await repository.updatePasswordByEmail(decoded.email, newHash);

  return { message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.' };
}

module.exports = {
  changePassword,
  forgotPassword,
  getMe,
  googleAuth,
  login,
  register,
  resendOTP,
  resetPassword,
  updateProfile,
  verifyOTP,
  verifyResetOTP,
};
