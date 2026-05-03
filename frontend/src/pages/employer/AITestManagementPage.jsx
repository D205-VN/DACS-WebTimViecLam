import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Link, Edit, Trash2 } from 'lucide-react';
import { aiTestApi } from '@shared/api/aiTestApi';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';

const AITestManagementPage = () => {
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
    navigator.clipboard.writeText(`${window.location.origin}/test/${testId}`);
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Quản lý Bài Test AI</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} />
          Tạo bài test mới
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-4 font-semibold text-gray-600">Tên bài test</th>
              <th className="p-4 font-semibold text-gray-600">Gắn với tin tuyển dụng</th>
              <th className="p-4 font-semibold text-gray-600">Loại bài test</th>
              <th className="p-4 font-semibold text-gray-600">Thời gian</th>
              <th className="p-4 font-semibold text-gray-600">Ngày tạo</th>
              <th className="p-4 font-semibold text-gray-600 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {tests.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">Chưa có bài test nào được tạo.</td>
              </tr>
            ) : (
              tests.map(test => {
                const linkedJob = jobs.find(j => String(j.id) === String(test.job_id));
                const linkedJobTitle = linkedJob?.title || linkedJob?.job_title || test.job_title;

                return (
                  <tr key={test.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4 font-medium text-navy-800">{test.title}</td>
                    <td className="p-4 text-sm text-gray-600">
                      {test.job_id ? linkedJobTitle || `Tin ID: ${test.job_id}` : <span className="text-gray-400 italic">Không gắn vào tin nào</span>}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        test.test_type === 'video_ai' ? 'bg-blue-100 text-blue-700' :
                        test.test_type === 'avatar_live2d' ? 'bg-purple-100 text-purple-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {test.test_type === 'normal' ? 'Trắc nghiệm' : test.test_type === 'video_ai' ? 'Video AI + Tự luận' : test.test_type === 'avatar_live2d' ? 'Avatar Live2D' : test.test_type}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{test.duration} phút</td>
                    <td className="p-4 text-gray-600">{new Date(test.created_at).toLocaleDateString('vi-VN')}</td>
                    <td className="p-4 flex justify-center gap-3">
                      <button onClick={() => navigate(`/employer/ai-tests/${test.id}/edit`)} className="text-gray-500 hover:text-blue-600" title="Sửa bài test & câu hỏi">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => navigate(`/employer/ai-tests/${test.id}/scores`)} className="text-gray-500 hover:text-green-600" title="Xem danh sách nộp bài">
                        <Play size={18} />
                      </button>
                      <button onClick={() => copyTestLink(test.id)}
                        className="text-gray-500 hover:text-blue-600" title="Copy link bài test">
                        <Link size={18} />
                      </button>
                      <button onClick={() => handleDeleteTest(test.id)}
                        className="text-gray-500 hover:text-red-600" title="Xóa bài test">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Tạo Bài Test AI</h2>
            <form onSubmit={handleCreateTest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên bài test</label>
                <input required type="text" className="w-full border rounded-lg p-2" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea className="w-full border rounded-lg p-2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn tin tuyển dụng (tùy chọn)</label>
                <select className="w-full border rounded-lg p-2" value={formData.job_id} onChange={e => setFormData({...formData, job_id: e.target.value})}>
                  <option value="">-- Không gắn vào tin nào --</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title || job.job_title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại bài test</label>
                  <select className="w-full border rounded-lg p-2" value={formData.test_type} onChange={e => setFormData({...formData, test_type: e.target.value})}>
                    <option value="normal">Trắc nghiệm (MCQ)</option>
                    <option value="video_ai">Video AI + Tự luận</option>
                    <option value="avatar_live2d">Avatar Live2D + Tự luận</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian (phút)</label>
                  <input required type="number" className="w-full border rounded-lg p-2" value={formData.duration} onChange={e => setFormData({...formData, duration: Number(e.target.value)})} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Tạo mới</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AITestManagementPage;
