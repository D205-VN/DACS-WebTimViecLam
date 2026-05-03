import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Video, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { aiTestApi } from '@shared/api/aiTestApi';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';

const AITestEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [jobs, setJobs] = useState([]);
  
  // New question form
  const [showQModal, setShowQModal] = useState(false);
  const defaultQForm = {
    content: '', type: 'mcq', difficulty: 'medium', expected_answer: '', keywords: '', video_url: '',
    correct_answer: '', options: { A: '', B: '', C: '', D: '' }
  };
  const [qForm, setQForm] = useState(defaultQForm);

  // Auto-generate state
  const [showGenModal, setShowGenModal] = useState(false);
  const [genForm, setGenForm] = useState({ job_id: '', topic: '', count: 10, mcq_ratio: 0.7 });
  const [genLoading, setGenLoading] = useState(false);

  // Scoring config form
  const [config, setConfig] = useState({ semantic_weight: 0.5, keyword_weight: 0.2, voice_weight: 0.2, manual_weight: 0.1 });

  const fetchTestDetails = useCallback(async () => {
    try {
      const data = await aiTestApi.getTest(id);
      setTest(data);
      setQuestions(data.questions || []);
      if (data.scoring_config) {
        setConfig({
          semantic_weight: parseFloat(data.scoring_config.semantic_weight),
          keyword_weight: parseFloat(data.scoring_config.keyword_weight),
          voice_weight: parseFloat(data.scoring_config.voice_weight),
          manual_weight: parseFloat(data.scoring_config.manual_weight)
        });
      }
      if (data.job_id) setGenForm(prev => ({ ...prev, job_id: String(data.job_id) }));
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => { fetchTestDetails(); }, [fetchTestDetails]);

  // Fetch employer jobs for auto-generate
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/employer/jobs`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.data) setJobs(data.data); })
      .catch(console.error);
  }, [token]);

  const handleSaveConfig = async () => {
    try {
      await aiTestApi.updateScoringConfig(id, config);
      alert('Đã lưu cấu hình!');
    } catch (err) { console.error(err); }
  };

  const handleGenerateVideo = async () => {
    if (!qForm.content) return alert('Nhập nội dung câu hỏi trước');
    try {
      const data = await aiTestApi.generateVideo({ text: qForm.content });
      if (data.success) {
        setQForm({ ...qForm, video_url: data.video_url });
        alert('Video generated (Mock)');
      }
    } catch (err) { console.error(err); }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...qForm };
      // For MCQ, send options + correct_answer
      if (qForm.type === 'mcq') {
        if (!qForm.correct_answer) return alert('Vui lòng chọn đáp án đúng');
        if (!qForm.options.A || !qForm.options.B) return alert('Cần ít nhất 2 đáp án');
      } else {
        payload.options = null;
        payload.correct_answer = null;
      }

      const dataQ = await aiTestApi.createQuestion(payload);
      await aiTestApi.addQuestionToTest(id, dataQ.id, { order_index: questions.length });

      setShowQModal(false);
      setQForm(defaultQForm);
      fetchTestDetails();
    } catch (err) { console.error(err); }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    try {
      await aiTestApi.deleteQuestion(id, questionId);
      fetchTestDetails();
    } catch (err) {
      console.error(err);
      alert('Không thể xóa câu hỏi');
    }
  };

  const handleGenerateQuestions = async (e) => {
    e.preventDefault();
    if (!genForm.job_id && !genForm.topic) return alert('Vui lòng chọn tin tuyển dụng hoặc nhập chủ đề');
    setGenLoading(true);
    try {
      const result = await aiTestApi.generateQuestions(id, genForm);
      alert(result.message || `Đã tạo ${result.questions?.length || 0} câu hỏi`);
      setShowGenModal(false);
      fetchTestDetails();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Lỗi khi tạo câu hỏi');
    } finally {
      setGenLoading(false);
    }
  };

  const formatTestType = (t) => t === 'normal' ? 'Trắc nghiệm' : t === 'video_ai' ? 'Video AI + Tự luận' : t === 'avatar_live2d' ? 'Avatar Live2D' : t;

  if (!test) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
      
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <button onClick={() => navigate('/employer/ai-tests')} className="text-gray-500 hover:text-blue-600 mb-2 flex items-center gap-2">
            <ArrowLeft size={16} /> Quay lại danh sách
          </button>
          <h1 className="text-2xl font-bold text-navy-900">Sửa bài test: {test.title}</h1>
          <p className="text-gray-500 text-sm mt-1">Loại: {formatTestType(test.test_type)} | Thời lượng: {test.duration} phút</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left Side: Questions */}
        <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-navy-800">Danh sách câu hỏi ({questions.length})</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowGenModal(true)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:shadow-lg transition-all text-sm"
              >
                <Sparkles size={16} /> Tạo tự động từ JD
              </button>
              <button 
                onClick={() => setShowQModal(true)}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-700"
              >
                <Plus size={18} /> Thêm câu hỏi
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {questions.length === 0 ? (
              <div className="text-center text-gray-500 py-8 border-2 border-dashed rounded-xl">
                Chưa có câu hỏi nào. Hãy thêm thủ công hoặc tạo tự động từ tin tuyển dụng.
              </div>
            ) : (
              questions.map((q, idx) => {
                const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                return (
                  <div key={q.id} className="p-4 border border-gray-200 rounded-xl hover:border-blue-600 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-800">Q{idx + 1}. {q.content}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${q.type === 'mcq' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${q.difficulty === 'easy' ? 'bg-green-50 text-green-600' : q.difficulty === 'hard' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
                          {q.difficulty === 'easy' ? 'Dễ' : q.difficulty === 'hard' ? 'Khó' : 'TB'}
                        </span>
                        <button onClick={() => handleDeleteQuestion(q.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="Xóa câu hỏi">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Show MCQ options */}
                    {q.type === 'mcq' && opts && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {['A', 'B', 'C', 'D'].map(key => opts[key] ? (
                          <div key={key} className={`text-sm px-3 py-2 rounded-lg border ${q.correct_answer === key ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                            <span className="font-bold mr-1">{key}.</span> {opts[key]}
                            {q.correct_answer === key && <span className="ml-1 text-emerald-600">✓</span>}
                          </div>
                        ) : null)}
                      </div>
                    )}

                    {q.video_url && (
                      <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                        <Video size={14} /> Đã đính kèm Video
                      </div>
                    )}
                    {q.keywords && (
                      <div className="mt-3 bg-gray-50 p-2 rounded text-sm text-gray-600">
                        <span className="font-semibold">Từ khóa: </span> {q.keywords}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Scoring Config */}
        <div className="w-80 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit sticky top-24">
          <h2 className="text-xl font-bold text-navy-800 mb-6 flex items-center gap-2">
            Cấu hình điểm số
          </h2>
          {test.test_type === 'normal' ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
              <p className="font-semibold mb-1">Bài test trắc nghiệm</p>
              <p>Chấm điểm tự động: Đúng = 10đ, Sai = 0đ. Không cần cấu hình trọng số.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trọng số AI chấm ý (Semantic)</label>
                <input type="number" step="0.1" max="1" className="w-full border rounded p-2" 
                  value={config.semantic_weight} onChange={e => setConfig({...config, semantic_weight: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trọng số Từ khóa (Keyword)</label>
                <input type="number" step="0.1" max="1" className="w-full border rounded p-2" 
                  value={config.keyword_weight} onChange={e => setConfig({...config, keyword_weight: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trọng số Giọng nói (Voice)</label>
                <input type="number" step="0.1" max="1" className="w-full border rounded p-2" 
                  value={config.voice_weight} onChange={e => setConfig({...config, voice_weight: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trọng số Thủ công (Manual)</label>
                <input type="number" step="0.1" max="1" className="w-full border rounded p-2" 
                  value={config.manual_weight} onChange={e => setConfig({...config, manual_weight: e.target.value})} />
              </div>
              <div className="text-xs text-gray-500 mb-4 bg-yellow-50 p-2 rounded">
                Tổng các trọng số nên bằng 1.0 (100%).
              </div>
              <button onClick={handleSaveConfig} className="w-full bg-navy-800 text-white py-2 rounded-lg hover:bg-navy-900 flex justify-center items-center gap-2">
                <Save size={18} /> Lưu cấu hình
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Question Modal */}
      {showQModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Thêm câu hỏi mới</h2>
            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nội dung câu hỏi</label>
                <textarea required className="w-full border rounded-lg p-2 h-20" value={qForm.content} onChange={e => setQForm({...qForm, content: e.target.value})}></textarea>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Loại</label>
                  <select className="w-full border rounded-lg p-2" value={qForm.type} onChange={e => setQForm({...qForm, type: e.target.value})}>
                    <option value="mcq">Trắc nghiệm (MCQ)</option>
                    <option value="essay">Tự luận / Giọng nói</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Độ khó</label>
                  <select className="w-full border rounded-lg p-2" value={qForm.difficulty} onChange={e => setQForm({...qForm, difficulty: e.target.value})}>
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
              </div>

              {/* MCQ Options */}
              {qForm.type === 'mcq' && (
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-800">Các lựa chọn trắc nghiệm</p>
                  {['A', 'B', 'C', 'D'].map(key => (
                    <div key={key} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct_answer"
                        value={key}
                        checked={qForm.correct_answer === key}
                        onChange={() => setQForm({...qForm, correct_answer: key})}
                        className="w-4 h-4 accent-emerald-600"
                      />
                      <span className="font-bold text-sm w-6">{key}.</span>
                      <input
                        type="text"
                        className="flex-1 border rounded-lg p-2 text-sm"
                        placeholder={`Đáp án ${key}`}
                        value={qForm.options[key]}
                        onChange={e => setQForm({...qForm, options: {...qForm.options, [key]: e.target.value}})}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-emerald-600 mt-1">Chọn radio button bên trái để đánh dấu đáp án đúng</p>
                </div>
              )}

              {test.test_type === 'video_ai' && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-blue-900 mb-1">Đường dẫn Video AI</label>
                    <input type="text" readOnly className="w-full border-blue-200 rounded-lg p-2 bg-white/50 text-xs" value={qForm.video_url || 'Chưa có video...'} />
                  </div>
                  <button type="button" onClick={handleGenerateVideo} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 whitespace-nowrap">
                    Tự động tạo Video AI
                  </button>
                </div>
              )}

              {qForm.type === 'essay' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Câu trả lời mẫu (Dùng để AI chấm điểm)</label>
                  <textarea className="w-full border rounded-lg p-2 h-20" placeholder="VD: Vòng đời component React bắt đầu với..." value={qForm.expected_answer} onChange={e => setQForm({...qForm, expected_answer: e.target.value})}></textarea>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Từ khóa (Cách nhau bằng dấu phẩy)</label>
                <input type="text" className="w-full border rounded-lg p-2" placeholder="react, hooks, state, useEffect" value={qForm.keywords} onChange={e => setQForm({...qForm, keywords: e.target.value})} />
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                <button type="button" onClick={() => setShowQModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Thêm vào bài test</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-Generate Questions Modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
              <Sparkles size={20} className="text-purple-600" /> Tạo câu hỏi tự động
            </h2>
            <p className="text-sm text-gray-500 mb-4">Phương pháp Hybrid: AI + NLP + HR Best Practices</p>
            <form onSubmit={handleGenerateQuestions} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Chủ đề / Kỹ năng cần kiểm tra</label>
                <input 
                  type="text" 
                  placeholder="VD: Công nghệ phần mềm, NodeJS, Xử lý tình huống..." 
                  className="w-full border rounded-lg p-2" 
                  value={genForm.topic} 
                  onChange={e => setGenForm({...genForm, topic: e.target.value})} 
                />
              </div>
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-medium tracking-widest">HOẶC DỰA TRÊN JD</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Chọn tin tuyển dụng</label>
                <select className={`w-full border rounded-lg p-2 ${genForm.topic ? 'bg-gray-100 text-gray-400' : ''}`} value={genForm.job_id} onChange={e => setGenForm({...genForm, job_id: e.target.value})} disabled={!!genForm.topic}>
                  <option value="">-- Chọn tin để phân tích JD --</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title || job.job_title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Số câu hỏi</label>
                  <input type="number" min="1" max="30" className="w-full border rounded-lg p-2" value={genForm.count} onChange={e => setGenForm({...genForm, count: parseInt(e.target.value) || 10})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tỉ lệ trắc nghiệm</label>
                  <select className="w-full border rounded-lg p-2" value={genForm.mcq_ratio} onChange={e => setGenForm({...genForm, mcq_ratio: parseFloat(e.target.value)})}>
                    <option value="1">100% trắc nghiệm</option>
                    <option value="0.7">70% trắc nghiệm + 30% tự luận</option>
                    <option value="0.5">50% trắc nghiệm + 50% tự luận</option>
                    <option value="0.3">30% trắc nghiệm + 70% tự luận</option>
                    <option value="0">100% tự luận</option>
                  </select>
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-800 space-y-1">
                <p><strong>AI</strong>: Gemini phân tích JD → trích xuất kỹ năng cần thiết</p>
                <p><strong>NLP</strong>: Xác định từ khóa quan trọng từ mô tả & yêu cầu</p>
                <p><strong>HR</strong>: Áp dụng STAR method, competency-based interviewing</p>
              </div>
              <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                <button type="button" onClick={() => setShowGenModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg" disabled={genLoading}>Hủy</button>
                <button type="submit" disabled={genLoading} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-60">
                  {genLoading ? <><Loader2 size={16} className="animate-spin" /> Đang tạo...</> : <><Sparkles size={16} /> Tạo câu hỏi</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AITestEditPage;
