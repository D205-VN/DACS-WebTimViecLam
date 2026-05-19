function normalizeBaseUrl(value) {
  const baseUrl = String(value || 'http://127.0.0.1:1234/v1').trim().replace(/\/+$/, '');
  return baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
}

function parseNumberEnv(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isLmStudioEnabled() {
  const provider = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  return ['lmstudio', 'lm-studio', 'local', 'local-ai'].includes(provider);
}

function getLmStudioConfig() {
  return {
    baseUrl: normalizeBaseUrl(process.env.LMSTUDIO_BASE_URL),
    model: String(process.env.LMSTUDIO_MODEL || 'local-model').trim(),
    timeoutMs: parseNumberEnv(process.env.LMSTUDIO_TIMEOUT_MS, 120000, 5000, 300000),
    maxTokens: parseNumberEnv(process.env.LMSTUDIO_MAX_TOKENS, 4096, 512, 12000),
    temperature: parseNumberEnv(process.env.LMSTUDIO_TEMPERATURE, 0.35, 0, 2),
  };
}

async function generateTextWithLmStudio(prompt, {
  systemPrompt = 'Bạn là trợ lý AI chuyên nghiệp. Trả lời đúng định dạng người dùng yêu cầu.',
  temperature,
  maxTokens,
} = {}) {
  const config = getLmStudioConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: temperature ?? config.temperature,
        max_tokens: maxTokens ?? config.maxTokens,
        stream: false,
      }),
    });

    const rawText = await response.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message = data?.error?.message || data?.message || rawText || `HTTP ${response.status}`;
      throw new Error(`LM Studio error: ${message}`);
    }

    const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
    if (!content.trim()) {
      throw new Error('LM Studio không trả về nội dung.');
    }

    return content;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`LM Studio quá thời gian phản hồi sau ${config.timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  generateTextWithLmStudio,
  getLmStudioConfig,
  isLmStudioEnabled,
};
