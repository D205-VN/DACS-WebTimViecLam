import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, MapPin, DollarSign, Clock, FileText, Users, Tag, Calendar, Loader2, CheckCircle2, Building2, LocateFixed } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';
import EmployerHeader from '@widgets/employer/EmployerHeader';
import { clearRequestCache } from '@shared/api/requestCache';
import { requestCurrentLocation } from '@shared/geo/currentLocation';
import { locationCenters, normalizeProvinceName } from '@shared/geo/provinceCoordinates';
import { getEmployerDashboardPath, getEmployerDashboardState } from '@shared/utils/employerDashboardRoutes';
import { analyzeJobQuality, getTodayDateInputValue } from '@shared/utils/jobQuality';

const JOB_TYPES = ['Toàn thời gian', 'Bán thời gian', 'Thực tập', 'Freelance', 'Remote'];
const EXPERIENCE_LEVELS = ['Không yêu cầu', 'Dưới 1 năm', '1-2 năm', '2-3 năm', '3-5 năm', 'Trên 5 năm'];

export default function PostJob() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [currentCoordinates, setCurrentCoordinates] = useState(null);
  const [locationNotice, setLocationNotice] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    benefits: '',
    salary_min: '',
    salary_max: '',
    job_type: 'Toàn thời gian',
    experience: 'Không yêu cầu',
    deadline: '',
    tags: '',
    positions: '1',
  });

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const hasCurrentLocation =
    Boolean(currentLocation) &&
    Number.isFinite(currentCoordinates?.lat) &&
    Number.isFinite(currentCoordinates?.lng);
  const jobQuality = analyzeJobQuality({ ...formData, currentLocation });
  const todayInputValue = getTodayDateInputValue();

  const handleDetectCurrentLocation = async () => {
    setDetectingLocation(true);
    setError('');
    setLocationNotice(null);

    try {
      const result = await requestCurrentLocation();
      setCurrentLocation(result.location);
      setCurrentCoordinates(result.coords);
      setLocationNotice({
        type: 'success',
        message: `Đã lấy vị trí hiện tại tại ${result.location}${result.accuracy ? ` (sai số khoảng ${result.accuracy}m)` : ''}.`,
      });
    } catch (err) {
      setCurrentLocation('');
      setCurrentCoordinates(null);
      setLocationNotice({
        type: 'error',
        message: err.message || 'Không thể lấy vị trí hiện tại.',
      });
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleManualInput = (value) => {
    setManualInput(value);
    if (value.trim().length >= 1) {
      const normalizedInput = value.trim().toLowerCase();
      const matched = locationCenters
        .filter(loc => {
          const name = normalizeProvinceName(loc.name).toLowerCase();
          return name.includes(normalizedInput) || normalizedInput.includes(name);
        })
        .slice(0, 6);
      setSuggestions(matched);
    } else {
      setSuggestions([]);
    }
  };

  const selectManualLocation = (loc) => {
    const name = normalizeProvinceName(loc.name);
    setCurrentLocation(name);
    setCurrentCoordinates({ lat: loc.lat, lng: loc.lng });
    setManualInput(name);
    setSuggestions([]);
    setLocationNotice({ type: 'success', message: `Đã chọn vị trí: ${name}` });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasCurrentLocation) {
      setError('Vui lòng lấy vị trí hiện tại trước khi đăng tin.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
          salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
          positions: parseInt(formData.positions) || 1,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
          currentLocation,
          currentLat: currentCoordinates.lat,
          currentLng: currentCoordinates.lng,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đăng tin thất bại');
      clearRequestCache((key) => key.includes('/api/employer'));
      setSuccess(true);
      setTimeout(() => navigate(getEmployerDashboardPath('jobs'), { state: getEmployerDashboardState('jobs') }), 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 bg-white border border-indigo-100/60 rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-indigo-400 transition-all';
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5';
  const selectClass = 'w-full px-4 py-3 bg-white border border-indigo-100/60 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-indigo-400 transition-all appearance-none cursor-pointer';

  if (success) {
    return (
      <div className="aw-page">
        <EmployerHeader />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-200">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent mb-3">Đã gửi tin chờ duyệt</h1>
          <p className="text-gray-500 mb-6">Tin tuyển dụng của bạn đang chờ admin chấp nhận hoặc từ chối. Đang chuyển hướng về bảng điều khiển...</p>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="aw-page">
      <EmployerHeader />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back button */}
        <button
          onClick={() => navigate(getEmployerDashboardPath('dashboard'), { state: getEmployerDashboardState('dashboard') })}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-700 font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại bảng điều khiển
        </button>

        {/* Page Header */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm mb-5 p-5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-t-2xl"></div>
          <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent mb-2">Đăng tin tuyển dụng</h1>
          <p className="text-gray-500">Điền thông tin chi tiết để tạo tin tuyển dụng mới</p>
          <div className="mt-4 inline-flex max-w-full rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 text-sm text-amber-700">
            Sau khi gửi, tin sẽ ở trạng thái chờ duyệt cho đến khi admin chấp nhận hoặc từ chối.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="aw-surface mb-5 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Chất lượng tin</p>
              <h2 className="mt-2 text-xl font-extrabold text-gray-800">{jobQuality.score}/100 - {jobQuality.label}</h2>
              <p className="mt-1 text-sm text-gray-500">Gợi ý được tính theo nội dung bạn đang nhập và ngày hiện tại.</p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 md:w-64">
              <div
                className={`h-full rounded-full ${
                  jobQuality.tone === 'emerald' ? 'bg-emerald-500' : jobQuality.tone === 'amber' ? 'bg-amber-500' : 'bg-gradient-to-r from-rose-500 to-pink-500'
                }`}
                style={{ width: `${jobQuality.score}%` }}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {jobQuality.suggestions.slice(0, 4).map((item) => (
              <div key={item.text} className="rounded-lg bg-indigo-50/50 px-4 py-3 text-sm text-gray-600">
                {item.text}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Basic Info */}
          <div className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200/60">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Thông tin cơ bản</h2>
                <p className="text-xs text-gray-400">Tiêu đề và mô tả công việc</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className={labelClass}>Tiêu đề công việc <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="VD: Frontend Developer (ReactJS)"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Mô tả công việc <span className="text-red-400">*</span></label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Mô tả chi tiết về công việc, trách nhiệm, nhiệm vụ hàng ngày..."
                  className={`${inputClass} min-h-[140px] resize-y`}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Yêu cầu ứng viên</label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => handleChange('requirements', e.target.value)}
                  placeholder="Kinh nghiệm, kỹ năng, bằng cấp cần thiết..."
                  className={`${inputClass} min-h-[120px] resize-y`}
                />
              </div>

              <div>
                <label className={labelClass}>Quyền lợi</label>
                <textarea
                  value={formData.benefits}
                  onChange={(e) => handleChange('benefits', e.target.value)}
                  placeholder="Lương thưởng, bảo hiểm, chế độ đãi ngộ..."
                  className={`${inputClass} min-h-[100px] resize-y`}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Details */}
          <div className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Chi tiết tuyển dụng</h2>
                <p className="text-xs text-gray-400">Địa điểm, lương, hình thức làm việc</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Địa điểm làm việc</span>
                </label>
                <div className="space-y-2">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={currentLocation}
                      readOnly
                      placeholder="Bắt buộc lấy vị trí hiện tại"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={handleDetectCurrentLocation}
                      disabled={detectingLocation}
                      className="inline-flex min-w-[210px] items-center justify-center gap-2 rounded-lg border border-indigo-100/60 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-70"
                    >
                      {detectingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                      {detectingLocation ? 'Đang lấy vị trí...' : currentLocation ? 'Lấy lại vị trí' : 'Lấy vị trí hiện tại'}
                    </button>
                  </div>
                  {locationNotice ? (
                    <p className={`text-xs ${locationNotice.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                      {locationNotice.message}
                    </p>
                  ) : null}
                  {(locationNotice?.type === 'error' || manualMode) && (
                    <div className="relative mt-1">
                      <input
                        type="text"
                        value={manualInput}
                        onChange={(e) => handleManualInput(e.target.value)}
                        placeholder="Nhập tên tỉnh/thành phố..."
                        className={inputClass}
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-indigo-100/60 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {suggestions.map((loc) => (
                            <button
                              key={loc.name}
                              type="button"
                              onClick={() => selectManualLocation(loc)}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                            >
                              {normalizeProvinceName(loc.name)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {!manualMode && !locationNotice?.type && (
                    <button
                      type="button"
                      onClick={() => setManualMode(true)}
                      className="text-xs text-indigo-600 hover:underline mt-1"
                    >
                      Nhập địa chỉ thủ công
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Hình thức</span>
                </label>
                <select
                  value={formData.job_type}
                  onChange={(e) => handleChange('job_type', e.target.value)}
                  className={selectClass}
                >
                  {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Mức lương tối thiểu (VNĐ)</span>
                </label>
                <input
                  type="number"
                  value={formData.salary_min}
                  onChange={(e) => handleChange('salary_min', e.target.value)}
                  placeholder="VD: 15000000"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Mức lương tối đa (VNĐ)</span>
                </label>
                <input
                  type="number"
                  value={formData.salary_max}
                  onChange={(e) => handleChange('salary_max', e.target.value)}
                  placeholder="VD: 25000000"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Kinh nghiệm</span>
                </label>
                <select
                  value={formData.experience}
                  onChange={(e) => handleChange('experience', e.target.value)}
                  className={selectClass}
                >
                  {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Số lượng tuyển</span>
                </label>
                <input
                  type="number"
                  value={formData.positions}
                  onChange={(e) => handleChange('positions', e.target.value)}
                  min="1"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Hạn nộp hồ sơ</span>
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  min={todayInputValue}
                  onChange={(e) => handleChange('deadline', e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Tags (phân cách bởi dấu phẩy)</span>
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                  placeholder="VD: React, JavaScript, Remote"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate(getEmployerDashboardPath('dashboard'), { state: getEmployerDashboardState('dashboard') })}
              className="px-6 py-3 bg-white border border-indigo-100/60 rounded-lg text-sm font-semibold text-gray-700 hover:bg-indigo-50/30 hover:border-gray-300 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || detectingLocation || !hasCurrentLocation}
              className="aw-btn-primary px-8 py-3 text-sm disabled:opacity-60 shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Briefcase className="w-4 h-4" /><span>Gửi tin chờ duyệt</span></>}
            </button>
          </div>
        </form>
      </div>

      {/* Footer */}
      <footer className="mt-12 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500"></div>
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-slate-500">© 2026 AptertekWork - Bản quyền thuộc về D205-VN</p>
            <div className="flex gap-5">
              <a href="#" className="text-xs text-slate-400 transition-colors hover:text-white">Điều khoản</a>
              <a href="#" className="text-xs text-slate-400 transition-colors hover:text-white">Chính sách</a>
              <a href="#" className="text-xs text-slate-400 transition-colors hover:text-white">Trợ giúp</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
