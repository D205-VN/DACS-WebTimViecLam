require('dotenv').config();

function hasValue(name) {
  return String(process.env[name] || '').trim().length > 0;
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function parseNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function validateUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function addMissing(errors, name, message) {
  if (!hasValue(name)) {
    errors.push(`${name}: ${message}`);
  }
}

function validateEnvironment() {
  const errors = [];
  const warnings = [];

  addMissing(errors, 'DATABASE_URL', 'bắt buộc để kết nối PostgreSQL');
  addMissing(errors, 'JWT_SECRET', 'bắt buộc để ký/xác thực token đăng nhập');

  if (hasValue('JWT_SECRET') && String(process.env.JWT_SECRET).length < 32) {
    const message = 'JWT_SECRET nên dài ít nhất 32 ký tự để an toàn hơn';
    if (isProduction()) errors.push(`JWT_SECRET: ${message}`);
    else warnings.push(`JWT_SECRET: ${message}`);
  }

  if (hasValue('DATABASE_URL') && !validateUrl(process.env.DATABASE_URL)) {
    errors.push('DATABASE_URL: không đúng định dạng URL PostgreSQL');
  }

  if (isProduction() && !hasValue('FRONTEND_URL') && !hasValue('FRONTEND_URLS')) {
    errors.push('FRONTEND_URL/FRONTEND_URLS: nên cấu hình domain frontend khi chạy production');
  }

  const aiProvider = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  const cvReviewProvider = String(process.env.CV_REVIEW_PROVIDER || '').trim().toLowerCase();
  const cvGenerationProvider = String(process.env.CV_GENERATION_PROVIDER || '').trim().toLowerCase();
  const openAiCompatibleCvProviders = ['lmstudio', 'lm-studio', 'local', 'local-ai', 'aptcv', 'openai-compatible', 'openai-compatible-local'];
  const usesLmStudio = ['lmstudio', 'lm-studio', 'local', 'local-ai'].includes(aiProvider)
    || openAiCompatibleCvProviders.includes(cvReviewProvider)
    || openAiCompatibleCvProviders.includes(cvGenerationProvider);
  if (!hasValue('GEMINI_API_KEY') && !usesLmStudio && !hasValue('CUSTOM_AI_API_URL')) {
    warnings.push('Chưa cấu hình GEMINI_API_KEY, CUSTOM_AI_API_URL, CV_GENERATION_PROVIDER hoặc CV_REVIEW_PROVIDER; các tính năng AI sẽ bị hạn chế.');
  }

  if ((hasValue('SMTP_EMAIL') && !hasValue('SMTP_PASSWORD')) || (!hasValue('SMTP_EMAIL') && hasValue('SMTP_PASSWORD'))) {
    warnings.push('SMTP_EMAIL/SMTP_PASSWORD nên được cấu hình cùng nhau để gửi email ổn định.');
  }

  if (String(process.env.BLOCKCHAIN_ENABLED || '').toLowerCase() === 'true') {
    ['EVM_RPC_URL', 'EVM_PRIVATE_KEY', 'EVM_CHAIN_ID', 'EVM_ANCHOR_ADDRESS'].forEach((name) => {
      if (!hasValue(name)) errors.push(`${name}: bắt buộc khi BLOCKCHAIN_ENABLED=true`);
    });
  }

  [
    ['RATE_LIMIT_MAX', 20],
    ['AI_RATE_LIMIT_MAX', 5],
    ['UPLOAD_RATE_LIMIT_MAX', 3],
    ['PG_POOL_MAX', 1],
  ].forEach(([name, min]) => {
    if (hasValue(name) && parseNumber(name, min) < min) {
      warnings.push(`${name}: giá trị quá thấp, nên >= ${min}.`);
    }
  });

  return { errors, warnings };
}

function validateEnvironmentOrExit() {
  const result = validateEnvironment();

  result.warnings.forEach((warning) => {
    console.warn(`[env warning] ${warning}`);
  });

  if (result.errors.length) {
    console.error('Backend thiếu cấu hình bắt buộc:');
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  return result;
}

module.exports = {
  validateEnvironment,
  validateEnvironmentOrExit,
};
