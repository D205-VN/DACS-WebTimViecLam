import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Video } from 'lucide-react';
import { aiTestApi } from '@shared/api/aiTestApi';

const AITestEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  // New question form
  const [showQModal, setShowQModal] = useState(false);
  const [qForm, setQForm] = useState({
    content: '', type: 'essay', difficulty: 'medium', expected_answer: '', keywords: '', video_url: ''
  });

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
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => {
    let active = true;

    aiTestApi.getTest(id)
      .then((data) => {
        if (!active) return;

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
      })
      .catch((err) => console.error(err));

    return () => {
      active = false;
    };
  }, [id]);

  const handleSaveConfig = async () => {
    try {
      await aiTestApi.updateScoringConfig(id, config);
      alert('Scoring Config Saved!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateVideo = async () => {
    if (!qForm.content) return alert('Enter question content first');
    try {
      const data = await aiTestApi.generateVideo({ text: qForm.content });
      if (data.success) {
        setQForm({ ...qForm, video_url: data.video_url });
        alert('Video generated (Mock)');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    try {
      const dataQ = await aiTestApi.createQuestion(qForm);
      await aiTestApi.addQuestionToTest(id, dataQ.id, { order_index: questions.length });

      setShowQModal(false);
      setQForm({ content: '', type: 'essay', difficulty: 'medium', expected_answer: '', keywords: '', video_url: '' });
      fetchTestDetails();
    } catch (err) {
      console.error(err);
    }
  };

  if (!test) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
      
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <button onClick={() => navigate('/employer/ai-tests')} className="text-gray-500 hover:text-blue-600 mb-2 flex items-center gap-2">
            <ArrowLeft size={16} /> Quay lại danh sách
          </button>
          <h1 className="text-2xl font-bold text-navy-900">Sửa bài test: {test.title}</h1>
          <p className="text-gray-500 text-sm mt-1">Loại: {test.test_type} | Thời lượng: {test.duration} phút</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left Side: Questions */}
        <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-navy-800">Danh sách câu hỏi ({questions.length})</h2>
            <button 
              onClick={() => setShowQModal(true)}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-700"
            >
              <Plus size={18} /> Thêm câu hỏi
            </button>
          </div>

          <div className="space-y-4">
            {questions.length === 0 ? (
              <div className="text-center text-gray-500 py-8 border-2 border-dashed rounded-xl">
                Chưa có câu hỏi nào.
              </div>
            ) : (
              questions.map((q, idx) => (
                <div key={q.id} className="p-4 border border-gray-200 rounded-xl hover:border-blue-600 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-800">Q{idx + 1}. {q.content}</h3>
                    <span className="bg-gray-100 text-xs px-2 py-1 rounded text-gray-600">{q.type}</span>
                  </div>
                  {q.video_url && (
                    <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                      <Video size={14} /> Đã đính kèm Video
                    </div>
                  )}
                  <div className="mt-3 bg-gray-50 p-2 rounded text-sm text-gray-600">
                    <span className="font-semibold">Từ khóa: </span> {q.keywords || 'Không có'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Scoring Config */}
        <div className="w-80 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit sticky top-24">
          <h2 className="text-xl font-bold text-navy-800 mb-6 flex items-center gap-2">
            Cấu hình điểm số
          </h2>
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
                    <option value="essay">Tự luận / Giọng nói</option>
                    <option value="mcq">Trắc nghiệm</option>
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

              <div>
                <label className="block text-sm font-medium mb-1">Câu trả lời mẫu (Dùng để AI chấm điểm)</label>
                <textarea className="w-full border rounded-lg p-2 h-20" placeholder="VD: Vòng đời component React bắt đầu với..." value={qForm.expected_answer} onChange={e => setQForm({...qForm, expected_answer: e.target.value})}></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Từ khóa (Cách nhau bằng dấu phẩy, dùng để chấm điểm Keyword)</label>
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
    </div>
  );
};

export default AITestEditPage;
