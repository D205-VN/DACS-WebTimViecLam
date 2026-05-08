import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Link, Edit, Trash2, Brain, Sparkles, Clock, FileText, X, Loader2 } from 'lucide-react';
import { aiTestApi } from '@shared/api/aiTestApi';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';

const AITestManagementContent = () => {
  const { token } = useAuth();
  const [tests, setTests] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '', job_id: '', description: '', duration: 60, test_type: 'normal'
  });
  const navigate = useNavigate();

  const fetchTests = useCallback(async () => {
    try {
      const data = await aiTestApi.getTests();
      setTests(data || []);
    } catch (err) {
      console.error('Failed to fetch tests', err);
    }
  }, []);

  useEffect(() => {
    let active = true;

    aiTestApi.getTests()
      .then((data) => {
        if (active) setTests(data || []);
      })
      .catch((err) => console.error('Failed to fetch tests', err));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (token) {
      fetch(`${API_BASE_URL}/api/employer/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(data => {
        if (data.data) setJobs(data.data);
      })
      .catch(console.error);
    }
  }, [token]);

  const handleCreateTest = async (e) => {
    e.preventDefault();
    try {
      await aiTestApi.createTest({ ...formData, job_id: formData.job_id || null });
      setShowCreateModal(false);
      fetchTests();
      setFormData({ title: '', job_id: '', description: '', duration: 60, test_type: 'normal' });
    } catch (err) {
      console.error(err);
    }
  };

  const copyTestLink = (testId) => {
    navigator.clipboard.writeText(`${window.location.origin}/seeker/ai-tests/${testId}`);
    alert('Đã copy link bài test!');
  };

  const handleDeleteTest = async (testId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài test này? Hành động này không thể hoàn tác.')) return;
    try {
      await aiTestApi.deleteTest(testId);
      fetchTests();
    } catch (err) {
      console.error(err);
      alert('Không thể xóa bài test');
    }
  };

  const getTestTypeMeta = (type) => {
    if (type === 'video_ai') return { label: 'Video AI + Tự luận', className: 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/60' };
    if (['avatar_live3d', 'avatar_live2d'].includes(type)) return { label: 'Avatar Live3D', className: 'bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border border-purple-200/60' };
    return { label: 'Trắc nghiệm', className: 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200/60' };
  };

  const inputClass = 'w-full px-4 py-3 bg-white border border-indigo-100/60 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-indigo-400 transition-all';
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5';

  return (
    <div className="space-y-6">
        {/* Page Header */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-t-2xl"></div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">Quản lý Bài Test AI</h1>
                <p className="text-sm text-gray-500 mt-0.5">Tạo và quản lý các bài kiểm tra năng lực ứng viên</p>
              </div>
            </div>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-semibold text-sm shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all"
            >
              <Plus size={18} />
              Tạo bài test mới
            </button>
          </div>
        </div>

        {/* Tests Grid */}
        {tests.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-indigo-200/60 bg-indigo-50/30 p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-indigo-300" />
            </div>
            <p className="text-gray-500 font-medium mb-2">Chưa có bài test nào được tạo.</p>
            <p className="text-sm text-gray-400">Bắt đầu bằng cách tạo bài test mới để đánh giá ứng viên.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tests.map(test => {
              const linkedJob = jobs.find(j => String(j.id) === String(test.job_id));
              const linkedJobTitle = linkedJob?.title || linkedJob?.job_title || test.job_title;
              const typeMeta = getTestTypeMeta(test.test_type);

              return (
                <div key={test.id} className="group relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300 hover:-translate-y-0.5">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-t-2xl"></div>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-gray-800 group-hover:text-indigo-700 transition-colors leading-tight">{test.title}</h3>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ml-2 ${typeMeta.className}`}>
                        {typeMeta.label}
                      </span>
                    </div>

                    {test.job_id ? (
                      <p className="text-xs text-indigo-600 font-medium mb-3 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {linkedJobTitle || `Tin ID: ${test.job_id}`}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic mb-3">Không gắn vào tin nào</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {test.duration} phút
                      </span>
                      <span>{new Date(test.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-indigo-50">
                      <button onClick={() => navigate(`/employer/ai-tests/${test.id}/edit`)} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors" title="Sửa bài test & câu hỏi">
                        <Edit size={14} /> Sửa
                      </button>
                      <button onClick={() => navigate(`/employer/ai-tests/${test.id}/scores`)} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors" title="Xem danh sách nộp bài">
                        <Play size={14} /> Nộp bài
                      </button>
                      <button onClick={() => copyTestLink(test.id)} className="py-2 px-3 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Copy link bài test">
                        <Link size={14} />
                      </button>
                      <button onClick={() => handleDeleteTest(test.id)} className="py-2 px-3 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Xóa bài test">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-indigo-100/60 bg-white shadow-2xl shadow-indigo-100/40 animate-in zoom-in-95 duration-200">
              <div className="absolute left-0 right-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"></div>
              <div className="p-6 pt-7 border-b border-indigo-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200/60">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">Tạo Bài Test AI</h2>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-indigo-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleCreateTest} className="p-6 space-y-4">
                <div>
                  <label className={labelClass}>Tên bài test</label>
                  <input required type="text" className={inputClass} placeholder="VD: Kiểm tra năng lực Frontend" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>Mô tả</label>
                  <textarea className={`${inputClass} min-h-[80px] resize-y`} placeholder="Mô tả ngắn gọn về bài test..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
                </div>
                <div>
                  <label className={labelClass}>Chọn tin tuyển dụng (tùy chọn)</label>
                  <select className={inputClass} value={formData.job_id} onChange={e => setFormData({...formData, job_id: e.target.value})}>
                    <option value="">-- Không gắn vào tin nào --</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>{job.title || job.job_title}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Loại bài test</label>
                    <select className={inputClass} value={formData.test_type} onChange={e => setFormData({...formData, test_type: e.target.value})}>
                      <option value="normal">Trắc nghiệm (MCQ)</option>
                      <option value="video_ai">Video AI + Tự luận</option>
                      <option value="avatar_live3d">Avatar Live3D + Tự luận</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Thời gian (phút)</label>
                    <input required type="number" className={inputClass} value={formData.duration} onChange={e => setFormData({...formData, duration: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-indigo-50">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-indigo-50 rounded-xl transition-colors">Hủy</button>
                  <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-200/60 hover:shadow-xl hover:shadow-indigo-300/60 transition-all">Tạo mới</button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
};

export default AITestManagementContent;
