import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { aiTestApi } from '@shared/api/aiTestApi';

const ScoreManagementPage = () => {
  const { id } = useParams(); // Test ID
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [manualScore, setManualScore] = useState({});

  useEffect(() => {
    let active = true;

    aiTestApi.getSubmissions(id)
      .then((data) => {
        if (active) setSubmissions(data || []);
      })
      .catch((err) => console.error(err));

    return () => {
      active = false;
    };
  }, [id]);

  const fetchSubmissionDetails = async (subId) => {
    try {
      const data = await aiTestApi.getSubmission(subId);
      setSelectedSub(data);
      const initialScores = {};
      data.answers.forEach(a => {
        const details = typeof a.scoring_details === 'string' ? JSON.parse(a.scoring_details) : (a.scoring_details || {});
        initialScores[a.id] = details.manual_score || 0;
      });
      setManualScore(initialScores);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustScore = async (answerId) => {
    try {
      await aiTestApi.updateManualScore(answerId, { manual_score: manualScore[answerId] });
      alert('Score adjusted successfully');
      fetchSubmissionDetails(selectedSub.id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 flex gap-6">
      {/* Sidebar - Submission List */}
      <div className="w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <button onClick={() => navigate('/employer/ai-tests')} className="text-gray-500 hover:text-blue-600 mb-4 flex items-center gap-2">
          <ArrowLeft size={16} /> Quay lại danh sách
        </button>
        <h2 className="text-lg font-bold mb-4">Danh sách nộp bài</h2>
        <div className="space-y-2">
          {submissions.length === 0 ? <p className="text-gray-500 text-sm">Chưa có bài nộp nào.</p> : null}
          {submissions.map(sub => (
            <div 
              key={sub.id} 
              onClick={() => fetchSubmissionDetails(sub.id)}
              className={`p-3 rounded-lg cursor-pointer border ${selectedSub?.id === sub.id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
            >
              <div className="font-medium text-navy-900 flex justify-between">
                <span>{sub.full_name}</span>
                <span className="text-blue-600 font-bold">{sub.total_score} điểm</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 flex justify-between">
                <span>{new Date(sub.completed_at).toLocaleString()}</span>
                {sub.suspicious_flag && <AlertTriangle size={14} className="text-red-500" title="Suspicious activity detected" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content - Submission Details */}
      <div className="w-2/3 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {!selectedSub ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            Select a submission to view details
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold text-navy-900">{selectedSub.full_name}</h2>
                <p className="text-gray-500">{selectedSub.email}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-blue-600">{selectedSub.total_score}</div>
                <div className="text-sm text-gray-500">Tổng điểm</div>
              </div>
            </div>

            {selectedSub.suspicious_flag && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3">
                <AlertTriangle className="mt-0.5" />
                <div>
                  <h4 className="font-bold">Cảnh báo gian lận</h4>
                  <p className="text-sm">Ứng viên đã chuyển tab {selectedSub.tab_switch_count} lần. Có thể đã rời khỏi cửa sổ bài test để tìm kiếm đáp án.</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <h3 className="text-lg font-bold text-navy-800">Câu trả lời</h3>
              {selectedSub.answers.map((ans, idx) => {
                const details = typeof ans.scoring_details === 'string' ? JSON.parse(ans.scoring_details) : (ans.scoring_details || {});
                return (
                  <div key={ans.id} className="border border-gray-200 rounded-xl p-5">
                    <h4 className="font-medium mb-2 text-gray-800">Q{idx + 1}: {ans.question_content}</h4>
                    <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
                      <p className="font-medium text-gray-500 mb-1">Đáp án mẫu:</p>
                      <p className="text-gray-700">{ans.expected_answer || 'Không có'}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded mb-4 text-sm">
                      <p className="font-medium text-blue-800 mb-1">Câu trả lời của ứng viên:</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{ans.text_answer || ans.transcript || 'Không có câu trả lời'}</p>
                      {ans.audio_url && (
                        <div className="mt-2">
                          <audio controls src={ans.audio_url} className="h-8" />
                        </div>
                      )}
                    </div>

                    {details.type === 'mcq' ? (
                      <div className={`mt-4 p-4 rounded-lg border flex justify-between items-center ${details.is_correct ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                        <div>
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Đã chọn: </span>
                              <span className="font-bold font-mono">{details.selected || 'Không chọn'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Đáp án đúng: </span>
                              <span className="font-bold font-mono">{details.correct}</span>
                            </div>
                          </div>
                          <p className={`font-bold mt-1 flex items-center gap-1 ${details.is_correct ? 'text-emerald-600' : 'text-red-600'}`}>
                            {details.is_correct ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                            {details.is_correct ? 'TRẢ LỜI ĐÚNG' : 'TRẢ LỜI SAI'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-gray-500 block mb-1">Điểm câu hỏi:</span>
                          <span className={`text-2xl font-black ${details.is_correct ? 'text-emerald-600' : 'text-red-600'}`}>
                            {Number(ans.final_score).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-4 mt-4 bg-gray-50 p-3 rounded-lg border">
                          <div className="text-center border-r">
                            <div className="text-xs text-gray-500">Chấm AI</div>
                            <div className="font-bold text-lg">{Number(details.semantic_score || 0).toFixed(1)}</div>
                          </div>
                          <div className="text-center border-r">
                            <div className="text-xs text-gray-500">Từ khóa</div>
                            <div className="font-bold text-lg">{Number(details.keyword_score || 0).toFixed(1)}</div>
                          </div>
                          <div className="text-center border-r">
                            <div className="text-xs text-gray-500">Giọng nói</div>
                            <div className="font-bold text-lg">{Number(details.voice_score || 0).toFixed(1)}</div>
                          </div>
                          <div className="text-center flex flex-col justify-center px-2">
                            <div className="text-xs text-gray-500 mb-1">Chấm thủ công (0-10)</div>
                            <div className="flex gap-2">
                              <input 
                                type="number" 
                                min="0" max="10" step="0.5"
                                className="w-full border rounded p-1 text-center text-sm"
                                value={manualScore[ans.id] || 0}
                                onChange={(e) => setManualScore({...manualScore, [ans.id]: e.target.value})}
                              />
                              <button 
                                onClick={() => handleAdjustScore(ans.id)}
                                className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700"
                              >
                                <CheckCircle size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 text-right">
                          <span className="text-sm text-gray-500">Điểm câu hỏi: </span>
                          <span className="font-bold text-blue-600">{Number(ans.final_score).toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoreManagementPage;
