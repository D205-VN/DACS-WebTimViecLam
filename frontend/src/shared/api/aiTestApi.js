import API_BASE_URL from '@shared/api/baseUrl';

const AI_TEST_BASE_URL = `${API_BASE_URL}/api/ai-tests`;

async function request(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  const response = await fetch(`${AI_TEST_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
  }

  return data;
}

export const aiTestApi = {
  getTests: () => request('/tests'),
  createTest: (payload) => request('/tests', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getTest: (id) => request(`/tests/${id}`),
  updateScoringConfig: (id, payload) => request(`/tests/${id}/scoring-config`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  generateVideo: (payload) => request('/generate-video', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  createQuestion: (payload) => request('/questions', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  addQuestionToTest: (testId, questionId, payload) => request(`/tests/${testId}/questions/${questionId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getSubmissions: (testId) => request(`/submissions?test_id=${encodeURIComponent(testId)}`),
  getSubmission: (submissionId) => request(`/submissions/${submissionId}`),
  updateManualScore: (answerId, payload) => request(`/answers/${answerId}/manual-score`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  startSubmission: (payload) => request('/start-submission', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  speechToText: () => request('/speech-to-text', { method: 'POST' }),
  submitAnswer: (payload) => request('/submit-answer', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  completeSubmission: (payload) => request('/complete-submission', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getTestByJobId: (jobId) => request(`/by-job/${encodeURIComponent(jobId)}`),
};
