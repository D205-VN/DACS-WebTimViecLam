import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, Square, Send, AlertTriangle, Clock } from 'lucide-react';
import Live2DAvatar from '@shared/ui/Live2DAvatar';
import { aiTestApi } from '@shared/api/aiTestApi';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

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
  const [audioBlob, setAudioBlob] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access required!');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!submissionId) return;
    const currentQ = test.questions[currentQIdx];

    // Mock speech to text if audio exists
    let transcript = '';
    let audio_url = '';
    
    if (audioBlob) {
      // Mock uploading and transcribing
      audio_url = URL.createObjectURL(audioBlob); // Just mock URL for frontend
      try {
        const tData = await aiTestApi.speechToText();
        transcript = tData.transcript;
      } catch (e) {
        console.error(e);
      }
    }

    try {
      await aiTestApi.submitAnswer({
        submission_id: submissionId,
        question_id: currentQ.id,
        text_answer: textAnswer,
        audio_url,
        transcript,
        suspicious_flag: suspiciousFlag,
        tab_switch_count: tabSwitchCount
      });

      // Reset state for next Q
      setTextAnswer('');
      setAudioBlob(null);
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

  const currentQ = test.questions[currentQIdx];

  return (
    <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-indigo-950 to-black text-white flex flex-col select-none overflow-hidden font-sans">
      {/* Premium Header */}
      <div className="px-8 py-5 flex justify-between items-center z-10 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.5)]">
            <Mic className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">{test.title}</h1>
            <div className="flex items-center gap-2 text-sm text-cyan-200/80 mt-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              Question {currentQIdx + 1} of {test.questions.length}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {suspiciousFlag && (
            <div className="flex items-center gap-2 text-red-400 font-bold bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-full backdrop-blur-sm animate-pulse">
              <AlertTriangle size={18} />
              Cảnh báo gian lận
            </div>
          )}
          <div className={`flex items-center gap-3 px-6 py-2 rounded-full backdrop-blur-md border ${timeLeft < 60 ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-white/5 border-white/10 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)]'}`}>
            <Clock size={20} />
            <span className="text-2xl font-mono font-bold tracking-wider">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Main Layout - Floating Cards */}
      <div className="flex-1 flex gap-8 p-8 overflow-hidden">
        
        {/* Left Side: Media Display */}
        <div className="w-[55%] relative rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 bg-black/40 backdrop-blur-sm flex flex-col group">
          <div className="flex-1 flex items-center justify-center relative w-full h-full">
            {test.test_type === 'avatar_live2d' ? (
              <Live2DAvatar isSpeaking={true} />
            ) : test.test_type === 'video_ai' ? (
              currentQ?.video_url?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                <img 
                  src={currentQ.video_url} 
                  alt="Question media"
                  className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
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
            ) : (
              <div className="text-white/40 flex flex-col items-center">
                <Mic size={64} className="mb-6 opacity-30" />
                <span className="text-xl tracking-widest font-light uppercase">Audio Assessment</span>
              </div>
            )}

            {/* Premium Question Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl shadow-lg transform transition-all duration-300 hover:-translate-y-2">
                <div className="text-cyan-400 font-mono text-sm mb-2 font-semibold tracking-wider">QUESTION {currentQIdx + 1}</div>
                <h2 className="text-2xl font-bold text-white leading-relaxed">{currentQ?.content}</h2>
                {currentQ?.type === 'mcq' && <p className="text-sm text-gray-400 mt-3 flex items-center gap-2"><div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>Please provide your answer</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Input Panel */}
        <div className="w-[45%] flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
          
          {/* Subtle glow effect behind input */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex-1 p-8 overflow-y-auto relative z-10 flex flex-col">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                <Send size={16} />
              </span>
              Your Response
            </h3>
            
            {/* Text Input */}
            <div className="relative group flex-1 flex flex-col">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <textarea 
                className="relative flex-1 w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-white text-lg placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 resize-none transition-all"
                placeholder="Type your brilliant answer here..."
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                onCopy={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
              />
            </div>

            {/* Voice Input Section */}
            <div className="mt-8 bg-black/20 border border-white/5 rounded-2xl p-6">
              <h4 className="font-medium text-gray-300 mb-5 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Mic size={16} className="text-cyan-400" /> Voice Recording
              </h4>
              <div className="flex items-center gap-6">
                {!isRecording ? (
                  <button 
                    onClick={startRecording}
                    className="group relative w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-transform hover:scale-110"
                  >
                    <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <Mic size={28} className="text-white" />
                  </button>
                ) : (
                  <div className="relative">
                    <div className="absolute -inset-2 bg-red-500/30 rounded-full blur-md animate-pulse"></div>
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
                  ) : audioBlob ? (
                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-3 rounded-xl">
                      <audio controls src={URL.createObjectURL(audioBlob)} className="h-10 w-full max-w-[250px]" />
                      <button onClick={() => setAudioBlob(null)} className="text-red-400 text-sm font-semibold hover:text-red-300 transition-colors uppercase tracking-wider">Xóa</button>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Click the microphone to record your answer instead of typing.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-6 bg-black/40 border-t border-white/10 flex justify-end relative z-10">
            <button 
              onClick={handleSubmitAnswer}
              disabled={!textAnswer && !audioBlob}
              className="relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-10 py-4 rounded-xl font-bold flex items-center gap-3 text-lg transition-all hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] hover:scale-[1.02]"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <span className="relative z-10">{currentQIdx < test?.questions.length - 1 ? 'Next Question' : 'Submit Assessment'}</span>
              <Send size={22} className="relative z-10 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateTestUI;
