import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Download, Loader2, User, Mail, Phone, Target, GraduationCap, Briefcase, Wrench, Award, Heart, Plus, Save, CheckCircle, ImageUp, Trash2, ClipboardCheck, MapPin, LocateFixed } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import SeekerToolsNav from '@features/seeker-tools/SeekerToolsNav';
import CVReviewModal from '@features/seeker-tools/CVReviewModal';
import { getBackLabelByRole, getDefaultRouteByRole } from '@shared/utils/roleRedirect';
import API_BASE_URL from '@shared/api/baseUrl';
import { requestCurrentLocation } from '@shared/geo/currentLocation';

const API = `${API_BASE_URL}/api/cv`;

export default function CVBuilderPage() {
  const { token, user } = useAuth();
  const [form, setForm] = useState({
    fullName: user?.full_name || '', email: user?.email || '', phone: '',
    role: '', objective: '', education: '', experience: '', skills: '', certifications: '', hobbies: '', portraitDataUrl: '',
  });
  
  const [cvHtml, setCvHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewApplyingIndex, setReviewApplyingIndex] = useState(null);
  const [reviewApplyMessage, setReviewApplyMessage] = useState('');
  const [reviewApplyStates, setReviewApplyStates] = useState({});
  const [reviewApplyErrors, setReviewApplyErrors] = useState({});
  const [currentLocation, setCurrentLocation] = useState('');
  const [currentCoordinates, setCurrentCoordinates] = useState(null);
  const [locationNotice, setLocationNotice] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const cvRef = useRef(null);
  const portraitInputRef = useRef(null);

  // Suggestions from Dataset
  const [kb, setKb] = useState({});
  const [availableRoles, setAvailableRoles] = useState([]);
  const [currentSuggestions, setCurrentSuggestions] = useState(null);
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const backLabel = getBackLabelByRole(user?.role_code);

  useEffect(() => {
    // Fetch suggestions KB
    fetch(`${API}/suggestions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setKb(d.data);
          setAvailableRoles(Object.keys(d.data));
        }
      })
      .catch(e => console.error('Failed to load KB:', e));
  }, [token]);

  const handleChange = (field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    // If role changed, update suggestions
    if (field === 'role' && kb[value]) {
      setCurrentSuggestions(kb[value]);
    } else if (field === 'role') {
      setCurrentSuggestions(null);
    }
  };

  const appendToField = (field, text) => {
    setForm(p => {
      const current = p[field].trim();
      const separator = current ? (field === 'skills' ? ', ' : '\n- ') : (field === 'skills' ? '' : '- ');
      return { ...p, [field]: current + separator + text };
    });
  };

  const resizeImageToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 320;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Không xử lý được ảnh'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => reject(new Error('Ảnh không hợp lệ'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Không đọc được ảnh'));
    reader.readAsDataURL(file);
  });

  const handlePortraitChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');

    try {
      const portraitDataUrl = await resizeImageToDataUrl(file);
      setForm((prev) => ({ ...prev, portraitDataUrl }));
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = '';
    }
  };

  const hasCurrentLocation =
    Boolean(currentLocation) &&
    Number.isFinite(currentCoordinates?.lat) &&
    Number.isFinite(currentCoordinates?.lng);

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

  const handleGenerate = async () => {
    if (!hasCurrentLocation) {
      setError('Vui lòng lấy vị trí hiện tại trước khi tạo CV.');
      return;
    }

    setError('');
    setSaveMessage('');
    setLoading(true);
    setCvHtml('');
    try {
      const res = await fetch(`${API}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          currentLocation,
          currentLat: currentCoordinates.lat,
          currentLng: currentCoordinates.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCvHtml(data.cv);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleDownload = async () => {
    if (!cvRef.current) return;
    const html2pdf = (await import('html2pdf.js')).default;
    html2pdf().set({
      margin: 0, filename: `CV_${form.fullName.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(cvRef.current).save();
  };

  const handleSave = async () => {
    if (!cvHtml) return;
    if (!hasCurrentLocation) {
      setError('Vui lòng lấy vị trí hiện tại trước khi lưu CV.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `CV - ${form.role || 'Cơ bản'}`,
          target_role: form.role,
          html_content: cvHtml,
          currentLocation,
          currentLat: currentCoordinates.lat,
          currentLng: currentCoordinates.lng,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu CV');
      setSaveSuccess(true);
      setSaveMessage(
        data.is_primary
          ? 'CV đã lưu và đang là hồ sơ chính dùng để nộp hồ sơ.'
          : 'CV đã lưu. Bạn có thể vào Quản lý hồ sơ CV để chọn bản này làm CV chính.'
      );
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReviewCurrentCv = async () => {
    if (!cvHtml) return;
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewError('');
    setReviewApplyMessage('');
    setReviewApplyStates({});
    setReviewApplyErrors({});
    setReviewResult(null);

    try {
      const res = await fetch(`${API}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          html_content: cvHtml,
          target_role: form.role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể phân tích CV');
      setReviewResult(data.data || null);
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleApplyReviewSuggestion = async (suggestion, index) => {
    if (!cvHtml) return;
    setReviewApplyingIndex(index);
    setReviewError('');
    setReviewApplyMessage('');
    setReviewApplyStates((prev) => ({ ...prev, [index]: 'idle' }));
    setReviewApplyErrors((prev) => ({ ...prev, [index]: '' }));

    try {
      const res = await fetch(`${API}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          html_content: cvHtml,
          target_role: form.role,
          suggestions: [suggestion],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể sửa CV theo gợi ý');
      setCvHtml(data.cv || cvHtml);
      setReviewApplyStates((prev) => ({ ...prev, [index]: 'done' }));
      setReviewApplyMessage('Đã sửa bản xem trước CV. Bạn có thể xem lại bên ngoài modal hoặc bấm Gợi ý sửa để kiểm tra tiếp.');
    } catch (err) {
      setReviewApplyStates((prev) => ({ ...prev, [index]: 'error' }));
      setReviewApplyErrors((prev) => ({ ...prev, [index]: err.message || 'Không thể sửa CV theo gợi ý này' }));
    } finally {
      setReviewApplyingIndex(null);
    }
  };

  const inputClass = 'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all';
  const textareaClass = `${inputClass} resize-none`;

  const SuggestionPills = ({ items, field }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="text-xs text-gray-500 py-1 mr-1">Gợi ý:</span>
        {items.map((item, idx) => (
          <button 
            key={idx} 
            onClick={() => appendToField(field, item)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-navy-600 bg-navy-50 hover:bg-navy-100 rounded-lg transition-colors text-left max-w-full"
            title={item}
          >
            <Plus className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[200px]">{item}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to={backRoute} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tạo CV bằng AI</h1>
          <p className="text-sm text-gray-500">Được tối ưu hoá dựa trên dữ liệu hàng ngàn CV thực tế</p>
        </div>
      </div>

      <SeekerToolsNav />

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}
      {saveMessage && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{saveMessage}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-800 mb-5">Thông tin của bạn</h2>
            <div className="space-y-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5"><User className="w-4 h-4 text-gray-400" /> Họ và tên</label>
                  <input type="text" value={form.fullName} onChange={e => handleChange('fullName', e.target.value)} placeholder="Nguyễn Văn A" className={inputClass} />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5"><Briefcase className="w-4 h-4 text-gray-400" /> Vị trí ứng tuyển</label>
                  <select value={form.role} onChange={e => handleChange('role', e.target.value)} className={inputClass}>
                    <option value="">-- Chọn vị trí để AI gợi ý --</option>
                    {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5"><Mail className="w-4 h-4 text-gray-400" /> Email</label>
                  <input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} placeholder="email@example.com" className={inputClass} />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5"><Phone className="w-4 h-4 text-gray-400" /> Số điện thoại</label>
                  <input type="tel" value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="0912 345 678" className={inputClass} />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                  <MapPin className="w-4 h-4 text-gray-400" /> Vị trí hiện tại
                </label>
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
                    className="inline-flex min-w-[210px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-50 disabled:opacity-70"
                  >
                    {detectingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                    {detectingLocation ? 'Đang lấy vị trí...' : currentLocation ? 'Lấy lại vị trí' : 'Lấy vị trí hiện tại'}
                  </button>
                </div>
                {locationNotice ? (
                  <p className={`mt-2 text-xs ${locationNotice.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                    {locationNotice.message}
                  </p>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                    <ImageUp className="w-4 h-4 text-gray-400" /> Ảnh thẻ chân dung
                  </label>
                  {form.portraitDataUrl ? (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, portraitDataUrl: '' }))}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa ảnh
                    </button>
                  ) : null}
                </div>

                <input
                  ref={portraitInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePortraitChange}
                  className="hidden"
                />

                <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white border border-gray-200">
                    {form.portraitDataUrl ? (
                      <img src={form.portraitDataUrl} alt="Ảnh chân dung" className="h-full w-full object-cover" />
                    ) : (
                      <div className="px-3 text-center text-xs text-gray-400">
                        Ảnh sẽ hiển thị ở đây
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">
                      Tải ảnh chân dung nền sáng, nhìn thẳng, bố cục gọn nếu bạn muốn CV có ảnh.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Đây là tuỳ chọn. Nếu có ảnh, hệ thống sẽ chèn trực tiếp vào CV AI và giữ nguyên khi lưu hoặc tải PDF.
                    </p>
                    <button
                      type="button"
                      onClick={() => portraitInputRef.current?.click()}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 border border-gray-200 hover:bg-navy-50 hover:border-navy-200 transition-colors"
                    >
                      <ImageUp className="w-4 h-4" />
                      {form.portraitDataUrl ? 'Đổi ảnh chân dung' : 'Tải ảnh chân dung'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5"><Target className="w-4 h-4 text-gray-400" /> Mục tiêu nghề nghiệp</label>
                <textarea value={form.objective} onChange={e => handleChange('objective', e.target.value)} rows={2} className={textareaClass} />
                {currentSuggestions && <SuggestionPills items={currentSuggestions.objectives} field="objective" />}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5"><Wrench className="w-4 h-4 text-gray-400" /> Kỹ năng</label>
                <textarea value={form.skills} onChange={e => handleChange('skills', e.target.value)} rows={2} className={textareaClass} />
                {currentSuggestions && <SuggestionPills items={currentSuggestions.skills} field="skills" />}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5"><Briefcase className="w-4 h-4 text-gray-400" /> Kinh nghiệm làm việc</label>
                <textarea value={form.experience} onChange={e => handleChange('experience', e.target.value)} rows={3} className={textareaClass} />
                {currentSuggestions && <SuggestionPills items={currentSuggestions.responsibilities} field="experience" />}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5"><GraduationCap className="w-4 h-4 text-gray-400" /> Học vấn</label>
                <textarea value={form.education} onChange={e => handleChange('education', e.target.value)} rows={2} className={textareaClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5"><Award className="w-4 h-4 text-gray-400" /> Chứng chỉ</label>
                  <textarea value={form.certifications} onChange={e => handleChange('certifications', e.target.value)} rows={2} className={textareaClass} />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5"><Heart className="w-4 h-4 text-gray-400" /> Sở thích</label>
                  <textarea value={form.hobbies} onChange={e => handleChange('hobbies', e.target.value)} rows={2} className={textareaClass} />
                </div>
              </div>
            </div>

            <button onClick={handleGenerate} disabled={loading || detectingLocation || !hasCurrentLocation} className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-semibold rounded-xl hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo CV...</> : <><Sparkles className="w-5 h-5" /> Tạo CV bằng AI</>}
            </button>
          </div>
        </div>

        {/* CV Preview */}
        <div>
          <div className="sticky top-20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-800">Xem trước CV</h2>
              {cvHtml && (
                <div className="flex flex-wrap justify-end gap-2">
                  <button onClick={handleReviewCurrentCv} disabled={reviewLoading} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-70">
                    {reviewLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang phân tích...</> : <><ClipboardCheck className="w-4 h-4" /> Gợi ý sửa</>}
                  </button>
                  <button onClick={handleSave} disabled={saving || saveSuccess || !hasCurrentLocation} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-navy-600 rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-70">
                    {saveSuccess ? <><CheckCircle className="w-4 h-4" /> Đã lưu</> : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</> : <><Save className="w-4 h-4" /> Lưu hồ sơ</>}
                  </button>
                  <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-navy-700 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors">
                    <Download className="w-4 h-4" /> Tải PDF
                  </button>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto min-h-[600px] flex flex-col">
              {cvHtml ? (
                <div ref={cvRef} className="p-6 flex-1 min-w-[800px]" dangerouslySetInnerHTML={{ __html: cvHtml }} />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-gray-400 p-8 text-center">
                  <Sparkles className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-sm font-medium text-gray-600 mb-2">Cách sử dụng tối ưu:</p>
                  <ul className="text-sm text-left list-disc list-inside space-y-1">
                    <li>Chọn <b>Vị trí ứng tuyển</b> ở form bên trái</li>
                    <li>Click vào các <b>Tag Gợi ý</b> để hệ thống tự điền dữ liệu chuẩn</li>
                    <li>Chỉnh sửa lại theo ý bạn</li>
                    <li>Bấm Tạo CV để AI định dạng và viết lại trau chuốt hơn</li>
                    <li>Sau khi lưu, hãy chọn <b>1 CV chính</b> trong Quản lý hồ sơ CV để dùng khi nộp hồ sơ</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CVReviewModal
        open={reviewOpen}
        title={form.role ? `Gợi ý sửa CV ${form.role}` : 'Gợi ý sửa CV'}
        loading={reviewLoading}
        applyingIndex={reviewApplyingIndex}
        applyStates={reviewApplyStates}
        applyErrors={reviewApplyErrors}
        error={reviewError}
        applyMessage={reviewApplyMessage}
        review={reviewResult}
        onClose={() => setReviewOpen(false)}
        onApplySuggestion={handleApplyReviewSuggestion}
      />
    </div>
  );
}
