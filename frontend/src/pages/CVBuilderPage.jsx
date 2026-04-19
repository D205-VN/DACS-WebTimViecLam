import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Download, Loader2, User, Mail, Phone, Target, GraduationCap, Briefcase, Wrench, Award, Heart, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5001/api/cv';

export default function CVBuilderPage() {
  const { token, user } = useAuth();
  const [form, setForm] = useState({
    fullName: user?.full_name || '', email: user?.email || '', phone: '',
    role: '', objective: '', education: '', experience: '', skills: '', certifications: '', hobbies: '',
  });
  
  const [cvHtml, setCvHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cvRef = useRef(null);

  // Suggestions from Dataset
  const [kb, setKb] = useState({});
  const [availableRoles, setAvailableRoles] = useState([]);
  const [currentSuggestions, setCurrentSuggestions] = useState(null);

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

  const handleGenerate = async () => {
    setError(''); setLoading(true); setCvHtml('');
    try {
      const res = await fetch(`${API}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
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
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
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

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

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

            <button onClick={handleGenerate} disabled={loading} className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-semibold rounded-xl hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60">
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
                <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-navy-700 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors">
                  <Download className="w-4 h-4" /> Tải PDF
                </button>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
              {cvHtml ? (
                <div ref={cvRef} className="p-6 flex-1" dangerouslySetInnerHTML={{ __html: cvHtml }} />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-gray-400 p-8 text-center">
                  <Sparkles className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-sm font-medium text-gray-600 mb-2">Cách sử dụng tối ưu:</p>
                  <ul className="text-sm text-left list-disc list-inside space-y-1">
                    <li>Chọn <b>Vị trí ứng tuyển</b> ở form bên trái</li>
                    <li>Click vào các <b>Tag Gợi ý</b> để hệ thống tự điền dữ liệu chuẩn</li>
                    <li>Chỉnh sửa lại theo ý bạn</li>
                    <li>Bấm Tạo CV để AI định dạng và viết lại trau chuốt hơn</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
