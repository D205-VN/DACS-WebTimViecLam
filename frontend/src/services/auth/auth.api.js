import API_BASE_URL from '@services/http/baseUrl';

const AUTH_API_BASE_URL = `${API_BASE_URL}/api/auth`;

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng kiểm tra cấu hình API.');
  }
}

async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await readJson(response);

  if (!response.ok) {
    const error = new Error(data.error || data.message || `Request failed: ${response.status}`);
    Object.assign(error, data, { status: response.status });
    throw error;
  }

  return data;
}

export const authApi = {
  login: (payload) => request('/login', {
    method: 'POST',
    body: payload,
  }),
  googleLogin: (credential) => request('/google', {
    method: 'POST',
    body: { credential },
  }),
  register: (payload) => request('/register', {
    method: 'POST',
    body: payload,
  }),
  verifyOtp: (payload) => request('/verify-otp', {
    method: 'POST',
    body: payload,
  }),
  resendOtp: (email) => request('/resend-otp', {
    method: 'POST',
    body: { email },
  }),
  forgotPassword: (email) => request('/forgot-password', {
    method: 'POST',
    body: { email },
  }),
  verifyResetOtp: (payload) => request('/verify-reset-otp', {
    method: 'POST',
    body: payload,
  }),
  resetPassword: (payload) => request('/reset-password', {
    method: 'POST',
    body: payload,
  }),
  getMe: (token) => request('/me', { token }),
  updateProfile: (token, payload) => request('/profile', {
    method: 'PUT',
    token,
    body: payload,
  }),
  changePassword: (token, payload) => request('/change-password', {
    method: 'POST',
    token,
    body: payload,
  }),
};
