import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, Square, Send, AlertTriangle, Clock } from 'lucide-react';
import HeyGenLiveAvatar from '@shared/ui/HeyGenLiveAvatar';
import { aiTestApi } from '@shared/api/aiTestApi';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

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

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isAvatarLive3DType(type) {
  const normalized = String(type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized === 'avatar_live3d'
    || normalized === 'avatar_live2d'
    || normalized.includes('live3d')
    || normalized.includes('live2d');
}

const CandidateTestUI = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [test, setTest] = useState(null);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submissionId, setSubmissionId] = useState(null);
  
  // Anti-cheat state
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [suspiciousFlag, setSuspiciousFlag] = useState(false);
  
  // Answering state
  const [textAnswer, setTextAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  
  const speechRecognitionRef = useRef(null);
  const speechFinalTranscriptRef = useRef('');
  const recordingTextBaseRef = useRef('');
  const isRecordingRef = useRef(false);
  const hasFinishedRef = useRef(false);

  const handleFinishTest = useCallback(async () => {
    if (!submissionId || hasFinishedRef.current) return;

    hasFinishedRef.current = true;
    await aiTestApi.completeSubmission({ submission_id: submissionId });
    alert('Test Completed Successfully!');
    navigate('/profile');
  }, [navigate, submissionId]);

  useEffect(() => {
    // Prevent leaving
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Anti-cheat: tab focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setTabSwitchCount(prev => prev + 1);
        setSuspiciousFlag(true);
        alert('WARNING: Tab switching is recorded and flagged as suspicious activity.');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Prevent copy/paste/context menu
    const preventAction = (e) => e.preventDefault();
    document.addEventListener('contextmenu', preventAction);

    let active = true;

    aiTestApi.getTest(id)
      .then((data) => {
        if (!active) return null;

        setTest(data);
        setTimeLeft(data.duration * 60);
        return aiTestApi.startSubmission({ test_id: id });
      })
      .then((data) => {
        if (active && data) setSubmissionId(data.id);
      })
      .catch((err) => console.error(err));

    return () => {
      active = false;
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current = null;
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', preventAction);
    };
  }, [id]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft((current) => current - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (timeLeft === 0 && test) {
      handleFinishTest();
    }
  }, [handleFinishTest, timeLeft, test]);

  const startRecording = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setSpeechNotice('Trình duyệt này chưa hỗ trợ tự chuyển giọng nói thành chữ.');
      return;
    }

    speechFinalTranscriptRef.current = '';
    recordingTextBaseRef.current = textAnswer.trim();
    setSpeechNotice('');

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      speechFinalTranscriptRef.current = finalTranscript;
      const nextText = [recordingTextBaseRef.current, finalTranscript, interimTranscript]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ');

      setTextAnswer(nextText);
      setSpeechNotice(interimTranscript ? 'Đang nghe giọng nói...' : 'Đã chuyển giọng nói thành chữ');
    };

    recognition.onerror = (event) => {
      const needsPermission = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      setSpeechNotice(needsPermission
        ? 'Cần cấp quyền micro để dùng nhập liệu bằng giọng nói.'
        : 'Không nhận diện được giọng nói. Bạn có thể thử nói rõ hơn hoặc gõ trực tiếp.');
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (!isRecordingRef.current) {
        setIsRecording(false);
        return;
      }

      try {
        recognition.start();
      } catch {
        // Recognition can already be active in some browsers.
      }
    };

    speechRecognitionRef.current = recognition;
    isRecordingRef.current = true;
    setIsRecording(true);

    try {
      recognition.start();
      setSpeechNotice('Đang nghe giọng nói...');
    } catch (err) {
      isRecordingRef.current = false;
      setIsRecording(false);
      setSpeechNotice('Không thể bật nhận diện giọng nói. Bạn hãy thử lại hoặc gõ trực tiếp.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    isRecordingRef.current = false;
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onend = null;
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    if (speechFinalTranscriptRef.current) {
      const finalText = [recordingTextBaseRef.current, speechFinalTranscriptRef.current]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ');
      setTextAnswer(finalText);
      setSpeechNotice('Đã chuyển giọng nói thành chữ');
    }
    setIsRecording(false);
  };

  const handleSubmitAnswer = async () => {
    if (!submissionId) return;
    const currentQ = test.questions[currentQIdx];

    // Prefer the browser transcript already displayed in the textarea.
    const transcript = textAnswer.trim();

    try {
      await aiTestApi.submitAnswer({
        submission_id: submissionId,
        question_id: currentQ.id,
        text_answer: transcript || textAnswer,
        audio_url: '',
        transcript,
        suspicious_flag: suspiciousFlag,
        tab_switch_count: tabSwitchCount
      });

      // Reset state for next Q
      setTextAnswer('');
      setSpeechNotice('');
      setTabSwitchCount(0); // Reset count per question or keep cumulative (handled in backend)
      
      if (currentQIdx < test.questions.length - 1) {
        setCurrentQIdx(prev => prev + 1);
      } else {
        handleFinishTest();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!test) return <div className="h-screen flex items-center justify-center text-xl font-bold">Loading Test...</div>;
  if (!test.questions?.length) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-white text-xl font-bold">
        Bài test chưa có câu hỏi.
      </div>
    );
  }

  const currentQ = test.questions[currentQIdx];
  const currentOptions = parseQuestionOptions(currentQ?.options);
  const usesAvatarLive3D = isAvatarLive3DType(test.test_type);
  const progressPercent = Math.round(((currentQIdx + 1) / test.questions.length) * 100);

  return (
    <div className="h-screen w-full bg-[#070b18] text-white flex flex-col select-none overflow-hidden font-sans">
      {/* Test Header */}
      <div className="px-7 py-4 flex justify-between items-center z-10 bg-[#0b1024]/95 border-b border-white/10 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-cyan-500 flex items-center justify-center shadow-[0_0_18px_rgba(34,211,238,0.28)]">
            <Mic className="text-white" size={24} />
          </div>
          <div className="min-w-[280px]">
            <h1 className="text-xl font-bold text-white tracking-wide">{test.title}</h1>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-cyan-200/80">Câu {currentQIdx + 1} / {test.questions.length}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {suspiciousFlag && (
            <div className="flex items-center gap-2 text-red-300 font-bold bg-gradient-to-r from-rose-500 to-pink-500/10 border border-red-500/30 px-4 py-2 rounded-full animate-pulse">
              <AlertTriangle size={18} />
              Cảnh báo gian lận
            </div>
          )}
          <div className={`flex items-center gap-3 px-6 py-2 rounded-full border ${timeLeft < 60 ? 'bg-gradient-to-r from-rose-500 to-pink-500/20 border-red-500/50 text-red-300 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-cyan-400/10 border-cyan-200/20 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.1)]'}`}>
            <Clock size={20} />
            <span className="text-2xl font-mono font-bold tracking-wider">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden bg-[linear-gradient(180deg,#0b1024_0%,#090d1d_50%,#050712_100%)]">
        
        {/* Left Side: Media Display */}
        <div className="w-[55%] min-w-0 relative overflow-hidden rounded-lg border border-white/12 bg-black/45 shadow-[0_22px_56px_rgba(0,0,0,0.46)] flex flex-col group">
          <div className="flex-1 flex items-center justify-center relative w-full h-full">
            {usesAvatarLive3D ? (
              <HeyGenLiveAvatar
                questionText={currentQ?.content}
                speakKey={`${currentQIdx}`}
              />
            ) : test.test_type === 'video_ai' ? (
              currentQ?.video_url?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                <img 
                  src={currentQ.video_url} 
                  alt="Question media"
                  className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-700 "
                />
              ) : currentQ?.video_url?.includes('youtube.com/embed') ? (
                <iframe 
                  src={currentQ.video_url}
                  className="absolute inset-0 w-full h-full border-0 opacity-90 pointer-events-none"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <video 
                  src={currentQ?.video_url || "https://www.w3schools.com/html/mov_bbb.mp4"} 
                  controls={false}
                  autoPlay
                  loop
                  className="absolute inset-0 w-full h-full object-cover opacity-90"
                />
              )
            ) : currentQ?.type === 'mcq' ? (
              <div className="text-white/40 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full border-4 border-dashed border-cyan-500/30 flex items-center justify-center mb-6">
                  <Square size={40} className="text-cyan-400 opacity-60" />
                </div>
                <span className="text-xl tracking-widest font-light uppercase">Multiple Choice</span>
              </div>
            ) : (
              <div className="text-white/40 flex flex-col items-center">
                <Mic size={64} className="mb-6 opacity-30" />
                <span className="text-xl tracking-widest font-light uppercase">Audio Assessment</span>
              </div>
            )}

            {/* Premium Question Overlay */}
            <div className={`absolute bottom-0 left-0 right-0 z-30 bg-black/70 ${usesAvatarLive3D ? 'p-5' : 'p-8'}`}>
              <div className={`border border-white/15 bg-[#080d1d]/86 shadow-[0_18px_44px_rgba(0,0,0,0.34)] backdrop-blur-md transition-all duration-300 ${usesAvatarLive3D ? 'rounded-lg px-5 py-4' : 'rounded-lg p-6'}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-cyan-300 font-mono text-sm font-semibold tracking-wider">CÂU HỎI {currentQIdx + 1}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                    {currentQ?.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}
                  </span>
                </div>
                <h2 className={`font-bold text-white leading-relaxed ${usesAvatarLive3D ? 'text-xl max-h-32 overflow-y-auto pr-2' : 'text-2xl'}`}>{currentQ?.content}</h2>
                {currentQ?.type === 'mcq' && <p className="text-sm text-slate-400 mt-3 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>Chọn một đáp án bên phải</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Input Panel */}
        <div className="w-[45%] min-w-0 flex flex-col overflow-hidden rounded-lg border border-white/12 bg-[#0d1428]/95 shadow-[0_22px_56px_rgba(0,0,0,0.34)] relative">
          <div className="flex-1 p-7 overflow-y-auto relative z-10 flex flex-col">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-cyan-400/12 flex items-center justify-center text-cyan-200">
                  <Send size={17} />
                </span>
                Câu trả lời
              </h3>
              <span className="rounded-full border border-cyan-200/15 bg-cyan-300/8 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-200">
                {textAnswer.trim() ? 'Đã chọn' : 'Chưa chọn'}
              </span>
            </div>
            
            {currentQ?.type === 'mcq' ? (
              <div className="flex-1 flex flex-col gap-4">
                {MCQ_KEYS.map((key) => {
                  if (!currentOptions[key]) return null;
                  const isSelected = textAnswer === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setTextAnswer(key)}
                      className={`relative overflow-hidden group text-left w-full rounded-lg border px-5 py-5 transition-all duration-300 ${
                        isSelected 
                          ? 'bg-cyan-400/14 border-cyan-300/80 shadow-[0_0_24px_rgba(34,211,238,0.18)]'
                          : 'bg-[#131a2f] border-white/10 hover:bg-[#18213a] hover:border-white/25'
                      }`}
                    >
                      <div className={`absolute left-0 top-0 h-full w-1 transition ${isSelected ? 'bg-cyan-300' : 'bg-transparent group-hover:bg-white/20'}`} />
                      <div className="relative z-10 flex items-start gap-4">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-bold text-sm transition ${
                          isSelected ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-slate-500 text-slate-400 group-hover:border-white group-hover:text-white'
                        }`}>
                          {key}
                        </div>
                        <span className={`text-[17px] leading-relaxed ${isSelected ? 'text-white font-semibold' : 'text-slate-300'}`}>
                          {currentOptions[key]}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {/* Text Input */}
                <div className="relative group flex-1 flex flex-col">
                  <textarea 
                    className="relative flex-1 w-full bg-[#080d1c] border border-white/12 rounded-lg p-6 text-white text-lg placeholder-white/30 focus:outline-none focus:border-cyan-300/55 focus:ring-1 focus:ring-cyan-300/45 resize-none transition-all"
                    placeholder={isRecording ? 'Nói câu trả lời của bạn, nội dung sẽ hiện ở đây...' : 'Nhập câu trả lời của bạn...'}
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                  />
                </div>

                {/* Voice Input Section */}
                <div className="mt-6 bg-[#080d1c]/85 border border-white/10 rounded-lg p-5">
                  <h4 className="font-semibold text-slate-300 mb-5 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <Mic size={16} className="text-cyan-400" /> Ghi âm câu trả lời
                  </h4>
                  <div className="flex items-center gap-6">
                    {!isRecording ? (
                      <button 
                        onClick={startRecording}
                        className="group relative w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-transform "
                      >
                        <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Mic size={28} className="text-white" />
                      </button>
                    ) : (
                      <div className="relative">
                        <div className="absolute -inset-2 bg-gradient-to-r from-rose-500 to-pink-500/30 rounded-full blur-md animate-pulse"></div>
                        <button 
                          onClick={stopRecording}
                          className="relative w-16 h-16 rounded-full bg-red-600 border-2 border-red-400 text-white flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.8)]"
                        >
                          <Square size={24} fill="currentColor" />
                        </button>
                      </div>
                    )}
                    
                    <div className="flex-1">
                      {isRecording ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-red-400 font-bold tracking-widest animate-pulse">RECORDING</span>
                            <div className="flex gap-1 h-4 items-center">
                              <div className="w-1 h-2 bg-red-400 animate-bounce" style={{animationDelay: '0ms'}}></div>
                              <div className="w-1 h-4 bg-red-400 animate-bounce" style={{animationDelay: '100ms'}}></div>
                              <div className="w-1 h-3 bg-red-400 animate-bounce" style={{animationDelay: '200ms'}}></div>
                              <div className="w-1 h-5 bg-red-400 animate-bounce" style={{animationDelay: '300ms'}}></div>
                              <div className="w-1 h-2 bg-red-400 animate-bounce" style={{animationDelay: '400ms'}}></div>
                            </div>
                          </div>
                          {speechNotice ? <p className="text-xs text-cyan-200/80">{speechNotice}</p> : null}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="text-slate-400 text-sm">Bấm micro để nói, nội dung sẽ hiện trong ô trả lời.</p>
                          {speechNotice ? <p className="text-xs text-cyan-200/80">{speechNotice}</p> : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-5 bg-[#070b18]/95 border-t border-white/10 flex justify-end relative z-10">
            <button 
              onClick={handleSubmitAnswer}
              disabled={isRecording || !textAnswer.trim()}
              className="relative overflow-hidden group disabled:opacity-45 disabled:cursor-not-allowed bg-cyan-400 text-slate-950 px-9 py-4 rounded-lg font-bold flex items-center gap-3 text-lg transition-all hover:bg-cyan-200 hover:shadow-[0_0_24px_rgba(34,211,238,0.35)]"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <span className="relative z-10">{currentQIdx < test?.questions.length - 1 ? 'Câu tiếp theo' : 'Nộp bài'}</span>
              <Send size={22} className="relative z-10 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateTestUI;
