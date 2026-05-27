import API_BASE_URL from '@services/http/baseUrl';

const TALENT_INSIGHTS_BASE_URL = `${API_BASE_URL}/api/talent-insights`;

function getAuthToken() {
  try {
    return localStorage.getItem('token') || null;
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${TALENT_INSIGHTS_BASE_URL}${path}`, {
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

export const talentInsightsApi = {
  getMySkillPassport: () => request('/passport/me'),
  getPublicSkillPassport: (token) => request(`/passport/public/${encodeURIComponent(token)}`, {
    headers: {},
  }),
  getJobFit: (jobId) => request(`/jobs/${encodeURIComponent(jobId)}/fit`),
  getEmployerTrustForJob: (jobId) => request(`/jobs/${encodeURIComponent(jobId)}/trust`, {
    headers: {},
  }),
  getInterviewCopilotForJob: (jobId) => request(`/interview-copilot/jobs/${encodeURIComponent(jobId)}`),
  getEmployerInterviews: () => request('/employer/interviews'),
  saveInterviewEvaluation: (applicationId, payload) => request(`/employer/applications/${encodeURIComponent(applicationId)}/evaluation`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  getWorkSimulationForJob: (jobId) => request(`/work-simulations/jobs/${encodeURIComponent(jobId)}`),
  getLatestWorkSimulation: (jobId) => request(`/work-simulations/jobs/${encodeURIComponent(jobId)}/latest`),
  submitWorkSimulation: (jobId, payload) => request(`/work-simulations/jobs/${encodeURIComponent(jobId)}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};
