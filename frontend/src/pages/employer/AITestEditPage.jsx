import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Video, Trash2, Sparkles, Loader2, X, CheckSquare, Bot } from 'lucide-react';
import { aiTestApi } from '@shared/api/aiTestApi';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';
import { getEmployerDashboardPath, getEmployerDashboardState } from '@shared/utils/employerDashboardRoutes';

const MCQ_KEYS = ['A', 'B', 'C', 'D'];

function parseQuestionOptions(options) {
  if (!options) return {};
  if (typeof options === 'string') {
    try {
      return JSON.parse(options);
    } catch {
      return {};
    }
  }
  return options;
}

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
        const normalizedOptions = MCQ_KEYS.reduce((acc, key) => {
          const value = String(qForm.options[key] || '').trim();
          if (value) acc[key] = value;
          return acc;
        }, {});
        const optionKeys = Object.keys(normalizedOptions);
        if (optionKeys.length < 2) return alert('Cần nhập ít nhất 2 đáp án có nội dung');
        if (!qForm.correct_answer || !normalizedOptions[qForm.correct_answer]) {
          return alert('Đáp án đúng phải là một lựa chọn đã có nội dung');
        }
        payload.options = normalizedOptions;
        payload.correct_answer = qForm.correct_answer;
      } else {
        payload.options = null;
        payload.correct_answer = null;
      }

      const dataQ = await aiTestApi.createQuestion(payload);
      await aiTestApi.addQuestionToTest(id, dataQ.id, { order_index: questions.length });

      setShowQModal(false);
      setQForm(defaultQForm);
      fetchTestDetails();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Không thể tạo câu hỏi');
    }
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

  const formatTestType = (t) => t === 'normal' ? 'Trắc nghiệm (MCQ)' : t === 'video_ai' ? 'Video AI + Tự luận' : ['avatar_live3d', 'avatar_live2d'].includes(t) ? 'Avatar Live3D + Tự luận' : t;
  const backToTests = () => navigate(getEmployerDashboardPath('ai-tests'), { state: getEmployerDashboardState('ai-tests') });

  const getTheme = (type) => {
    if (type === 'video_ai') return {
      accent: 'from-blue-500 via-cyan-500 to-teal-500',
      iconBg: 'from-blue-500 to-cyan-600',
      icon: Video,
      desc: 'Ứng viên xem video và trả lời câu hỏi tự luận bằng giọng nói hoặc văn bản',
      listAccent: 'from-blue-500 to-cyan-500',
      configAccent: 'from-cyan-500 to-teal-500',
    };
    if (['avatar_live3d', 'avatar_live2d'].includes(type)) return {
      accent: 'from-purple-500 via-pink-500 to-rose-500',
      iconBg: 'from-purple-500 to-pink-600',
      icon: Bot,
      desc: 'Avatar AI 3D phỏng vấn trực tiếp ứng viên với giọng nói tự nhiên',
      listAccent: 'from-purple-500 to-pink-500',
      configAccent: 'from-pink-500 to-rose-500',
    };
    return {
      accent: 'from-emerald-500 via-teal-500 to-cyan-500',
      iconBg: 'from-emerald-500 to-teal-600',
      icon: CheckSquare,
      desc: 'Bài trắc nghiệm chấm điểm tự động — Đúng/Sai',
      listAccent: 'from-emerald-500 to-teal-500',
      configAccent: 'from-teal-500 to-cyan-500',
    };
  };

  if (!test) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  const theme = getTheme(test.test_type);
  const ThemeIcon = theme.icon;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className={`absolute left-0 right-0 top-0 h-1.5 rounded-t-2xl bg-gradient-to-r ${theme.accent}`}></div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${theme.iconBg} flex items-center justify-center shadow-lg`}>
              <ThemeIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <button onClick={backToTests} className="text-xs text-gray-400 hover:text-indigo-600 mb-1 flex items-center gap-1 transition-colors">
                <ArrowLeft size={12} /> Quay lại danh sách
              </button>
              <h1 className="text-xl font-extrabold bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">Sửa bài test: {test.title}</h1>
              <p className="text-gray-500 text-xs mt-0.5">{formatTestType(test.test_type)} &middot; {test.duration} phút &middot; {theme.desc}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Left Side: Questions */}
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className={`absolute left-0 right-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${theme.listAccent}`}></div>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-gray-800">Danh sách câu hỏi ({questions.length})</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setShowGenModal(true)}
                className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-md shadow-violet-200 hover:shadow-lg transition-all text-sm font-semibold"
              >
                <Sparkles size={16} /> Tạo tự động từ JD
              </button>
              <button
                onClick={() => setShowQModal(true)}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-md shadow-indigo-200 hover:shadow-lg transition-all text-sm font-semibold"
              >
                <Plus size={18} /> Thêm câu hỏi
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {questions.length === 0 ? (
              <div className="text-center text-gray-500 py-12 border-2 border-dashed border-indigo-200/60 rounded-xl bg-indigo-50/20">
                <Sparkles className="w-8 h-8 text-indigo-200 mx-auto mb-3" />
                Chưa có câu hỏi nào. Hãy thêm thủ công hoặc tạo tự động từ tin tuyển dụng.
              </div>
            ) : (
              questions.map((q, idx) => {
                const opts = parseQuestionOptions(q.options);
                return (
                  <div key={q.id} className="p-4 border border-indigo-100/60 rounded-xl hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-50 transition-all duration-200 bg-white">
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
                        {MCQ_KEYS.map(key => opts[key] ? (
                          <div key={key} className={`text-sm px-3 py-2 rounded-lg border ${q.correct_answer === key ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-800' : 'bg-indigo-50/50 border-indigo-100/60 text-gray-700'}`}>
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
                      <div className="mt-3 bg-indigo-50/50 p-2 rounded text-sm text-gray-600">
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
        <div className="relative h-fit w-full overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 p-6 shadow-sm backdrop-blur-sm xl:sticky xl:top-24 xl:w-80">
          <div className={`absolute left-0 right-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${theme.configAccent}`}></div>
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Save className="w-4 h-4 text-violet-500" /> Cấu hình điểm số
          </h2>
          {test.test_type === 'normal' ? (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-xl p-4 text-sm text-emerald-800">
              <p className="font-semibold mb-1">Bài test trắc nghiệm</p>
              <p>Chấm điểm tự động: Đúng = 10đ, Sai = 0đ. Không cần cấu hình trọng số.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Trọng số AI chấm ý (Semantic)', key: 'semantic_weight' },
                { label: 'Trọng số Từ khóa (Keyword)', key: 'keyword_weight' },
                { label: 'Trọng số Giọng nói (Voice)', key: 'voice_weight' },
                { label: 'Trọng số Thủ công (Manual)', key: 'manual_weight' },
              ].map(item => (
                <div key={item.key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{item.label}</label>
                  <input type="number" step="0.1" max="1" className="w-full border border-indigo-100/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    value={config[item.key]} onChange={e => setConfig({...config, [item.key]: e.target.value})} />
                </div>
              ))}
              <div className="text-xs text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-3 rounded-xl">
                Tổng các trọng số nên bằng 1.0 (100%).
              </div>
              <button onClick={handleSaveConfig} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all flex justify-center items-center gap-2">
                <Save size={16} /> Lưu cấu hình
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Question Modal */}
      {showQModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-indigo-100/60 bg-white shadow-2xl shadow-indigo-100/40 animate-in zoom-in-95 duration-200">
            <div className="absolute left-0 right-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"></div>
            <div className="p-6 pt-7 border-b border-indigo-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Thêm câu hỏi mới</h2>
              <button onClick={() => setShowQModal(false)} className="p-2 hover:bg-indigo-50 rounded-full transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleAddQuestion} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nội dung câu hỏi</label>
                <textarea required className="w-full border border-indigo-100/60 rounded-xl px-4 py-3 h-20 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" value={qForm.content} onChange={e => setQForm({...qForm, content: e.target.value})}></textarea>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Loại</label>
                  <select className="w-full border border-indigo-100/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" value={qForm.type} onChange={e => setQForm({...qForm, type: e.target.value})}>
                    <option value="mcq">Trắc nghiệm (MCQ)</option>
                    <option value="essay">Tự luận / Giọng nói</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Độ khó</label>
                  <select className="w-full border border-indigo-100/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" value={qForm.difficulty} onChange={e => setQForm({...qForm, difficulty: e.target.value})}>
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
              </div>

              {/* MCQ Options */}
              {qForm.type === 'mcq' && (
                <div className="border border-emerald-200/60 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-800">Các lựa chọn trắc nghiệm</p>
                  {MCQ_KEYS.map(key => (
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
                        className="flex-1 border border-indigo-100/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
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
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200/60 flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-blue-900 mb-1">Đường dẫn Video AI</label>
                    <input type="text" readOnly className="w-full border-blue-200/60 rounded-xl p-2 bg-white/50 text-xs" value={qForm.video_url || 'Chưa có video...'} />
                  </div>
                  <button type="button" onClick={handleGenerateVideo} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md shadow-blue-200 hover:shadow-lg transition-all whitespace-nowrap">
                    Tự động tạo Video AI
                  </button>
                </div>
              )}

              {qForm.type === 'essay' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Câu trả lời mẫu (Dùng để AI chấm điểm)</label>
                  <textarea className="w-full border border-indigo-100/60 rounded-xl px-4 py-3 h-20 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" placeholder="VD: Vòng đời component React bắt đầu với..." value={qForm.expected_answer} onChange={e => setQForm({...qForm, expected_answer: e.target.value})}></textarea>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Từ khóa (Cách nhau bằng dấu phẩy)</label>
                <input type="text" className="w-full border border-indigo-100/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" placeholder="react, hooks, state, useEffect" value={qForm.keywords} onChange={e => setQForm({...qForm, keywords: e.target.value})} />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-indigo-50">
                <button type="button" onClick={() => setShowQModal(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-indigo-50 rounded-xl transition-colors">Hủy</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-indigo-200 hover:shadow-lg transition-all">Thêm vào bài test</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-Generate Questions Modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-indigo-100/60 bg-white shadow-2xl shadow-indigo-100/40 animate-in zoom-in-95 duration-200">
            <div className="absolute left-0 right-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500"></div>
            <div className="p-6 pt-7 border-b border-indigo-50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600" /> Tạo câu hỏi tự động
              </h2>
              <p className="text-sm text-gray-500 mt-1">Phương pháp Hybrid: AI + NLP + HR Best Practices</p>
            </div>
            <form onSubmit={handleGenerateQuestions} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Chủ đề / Kỹ năng cần kiểm tra</label>
                <input 
                  type="text" 
                  placeholder="VD: Công nghệ phần mềm, NodeJS, Xử lý tình huống..." 
                  className="w-full border border-indigo-100/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  value={genForm.topic} 
                  onChange={e => setGenForm({...genForm, topic: e.target.value})} 
                />
              </div>
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-indigo-100/60"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-medium tracking-widest">HOẶC DỰA TRÊN JD</span>
                <div className="flex-grow border-t border-indigo-100/60"></div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Chọn tin tuyển dụng</label>
                <select className={`w-full border border-indigo-100/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 ${genForm.topic ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-gray-400' : ''}`} value={genForm.job_id} onChange={e => setGenForm({...genForm, job_id: e.target.value})} disabled={!!genForm.topic}>
                  <option value="">-- Chọn tin để phân tích JD --</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title || job.job_title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Số câu hỏi</label>
                  <input type="number" min="1" max="30" className="w-full border border-indigo-100/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" value={genForm.count} onChange={e => setGenForm({...genForm, count: parseInt(e.target.value) || 10})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tỉ lệ trắc nghiệm</label>
                  <select className="w-full border border-indigo-100/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" value={genForm.mcq_ratio} onChange={e => setGenForm({...genForm, mcq_ratio: parseFloat(e.target.value)})}>
                    <option value="1">100% trắc nghiệm</option>
                    <option value="0.7">70% trắc nghiệm + 30% tự luận</option>
                    <option value="0.5">50% trắc nghiệm + 50% tự luận</option>
                    <option value="0.3">30% trắc nghiệm + 70% tự luận</option>
                    <option value="0">100% tự luận</option>
                  </select>
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200/60 rounded-xl p-3 text-xs text-purple-800 space-y-1">
                <p><strong>AI</strong>: Gemini phân tích JD → trích xuất kỹ năng cần thiết</p>
                <p><strong>NLP</strong>: Xác định từ khóa quan trọng từ mô tả & yêu cầu</p>
                <p><strong>HR</strong>: Áp dụng STAR method, competency-based interviewing</p>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-indigo-50">
                <button type="button" onClick={() => setShowGenModal(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-indigo-50 rounded-xl transition-colors" disabled={genLoading}>Hủy</button>
                <button type="submit" disabled={genLoading} className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-violet-200 hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-60">
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
