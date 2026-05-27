// Khi dev local, fallback về '' để Vite proxy xử lý.
// Khi build production mà VITE_API_URL chưa được cấu hình, dùng backend Render
// để tránh gọi nhầm /api trên host frontend và nhận về index.html.
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const productionFallbackApiUrl = 'https://dacs-webtimvieclam.onrender.com';

const API_BASE_URL = (configuredApiUrl || (import.meta.env.PROD ? productionFallbackApiUrl : '')).replace(/\/+$/, '');

export default API_BASE_URL;
