// Khi build trên Vercel, VITE_API_URL sẽ được inject từ Environment Variables
// Khi dev local, fallback về '' (empty string) để Vite proxy xử lý
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default API_BASE_URL;
