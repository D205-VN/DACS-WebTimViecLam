import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, MapPin, DollarSign, Clock, FileText, Users, Tag, Calendar, Loader2, CheckCircle2, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EmployerHeader from '../../components/employer/EmployerHeader';

const JOB_TYPES = ['Toàn thời gian', 'Bán thời gian', 'Thực tập', 'Freelance', 'Remote'];
const EXPERIENCE_LEVELS = ['Không yêu cầu', 'Dưới 1 năm', '1-2 năm', '2-3 năm', '3-5 năm', 'Trên 5 năm'];

export default function PostJob() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    benefits: '',
    location: '',
    salary_min: '',
    salary_max: '',
    job_type: 'Toàn thời gian',
    experience: 'Không yêu cầu',
    deadline: '',
    tags: '',
    positions: '1',
  });

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/employer/jobs', {
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đăng tin thất bại');
      setSuccess(true);
      setTimeout(() => navigate('/employer/dashboard'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all';
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5';
  const selectClass = 'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all appearance-none cursor-pointer';

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50/80">
        <EmployerHeader />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 mb-3">Đăng tin thành công! 🎉</h1>
          <p className="text-gray-500 mb-6">Tin tuyển dụng của bạn đã được tạo. Đang chuyển hướng về bảng điều khiển...</p>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-navy-700 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/80">
      <EmployerHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <button
          onClick={() => navigate('/employer/dashboard')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-navy-700 font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại bảng điều khiển
        </button>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">Đăng tin tuyển dụng</h1>
          <p className="text-gray-500">Điền thông tin chi tiết để tạo tin tuyển dụng mới</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Basic Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-navy-50 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-navy-600" />
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600" />
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
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="VD: TP. Hồ Chí Minh"
                  className={inputClass}
                />
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
              onClick={() => navigate('/employer/dashboard')}
              className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-navy-600 to-navy-800 text-white font-semibold text-sm rounded-xl hover:shadow-lg hover:shadow-navy-700/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Briefcase className="w-4 h-4" /><span>Đăng tin tuyển dụng</span></>}
            </button>
          </div>
        </form>
      </div>

      {/* Footer */}
      <footer className="bg-navy-900 text-navy-300 mt-16">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-navy-400">© 2026 AptertekWork — Bản quyền thuộc về D205-VN</p>
            <div className="flex gap-4">
              <a href="#" className="text-xs text-navy-400 hover:text-navy-200 transition-colors">Điều khoản</a>
              <a href="#" className="text-xs text-navy-400 hover:text-navy-200 transition-colors">Chính sách</a>
              <a href="#" className="text-xs text-navy-400 hover:text-navy-200 transition-colors">Trợ giúp</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
