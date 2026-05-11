import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Award, Bot, CheckCircle, CheckSquare, Clock, Mic, Send, Square, Trophy, Video, XCircle } from 'lucide-react';
import HeyGenLiveAvatar from '@shared/ui/HeyGenLiveAvatar';
import { aiTestApi } from '@shared/api/aiTestApi';
import { getAiTestKind, getSeekerAiTestPath } from '@shared/utils/aiTestRoutes';

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

function getTestTypeMeta(type) {
  if (isAvatarLive3DType(type)) {
    return {
      label: 'Avatar Live3D',
      shortLabel: 'Avatar',
      icon: Bot,
      accent: 'from-violet-500 to-fuchsia-500',
      iconBg: 'from-violet-500 to-fuchsia-600',
      badge: 'border-violet-200 bg-violet-50 text-violet-700',
      darkBadge: 'border-violet-400/25 bg-violet-500/10 text-violet-200',
    };
  }

  if (type === 'video_ai') {
    return {
      label: 'VideoAI + Tự luận',
      shortLabel: 'VideoAI',
      icon: Video,
      accent: 'from-blue-500 to-cyan-500',
      iconBg: 'from-blue-500 to-cyan-600',
      badge: 'border-blue-200 bg-blue-50 text-blue-700',
      darkBadge: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200',
    };
  }

  return {
    label: 'Trắc nghiệm (MCQ)',
    shortLabel: 'Trắc nghiệm',
    icon: CheckSquare,
    accent: 'from-emerald-500 to-teal-500',
    iconBg: 'from-emerald-500 to-teal-600',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    darkBadge: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
  };
}

const CandidateTestUI = () => {
  const { id, testKind } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [test, setTest] = useState(null);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submissionId, setSubmissionId] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
    setIsSubmitting(true);
    try {
      const data = await aiTestApi.completeSubmission({ submission_id: submissionId });
      if (data?.result) {
        setTestResult(data.result);
      } else {
        // Fallback if backend doesn't return result
        setTestResult({ percentage: 0, total_score: 0, max_score: 0, total_questions: test?.questions?.length || 0, answered_questions: 0, correct_count: 0, test_title: test?.title, answers: [] });
      }
    } catch (err) {
      console.error(err);
      setTestResult({ percentage: 0, total_score: 0, max_score: 0, total_questions: test?.questions?.length || 0, answered_questions: 0, correct_count: 0, test_title: test?.title, answers: [] });
    } finally {
      setIsSubmitting(false);
    }
  }, [submissionId, test]);

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
      .then(async (data) => {
        if (!active) return;

        const expectedKind = getAiTestKind(data.test_type);
        const canonicalPath = getSeekerAiTestPath(id, data.test_type);
        if (testKind !== expectedKind || location.pathname !== canonicalPath) {
          navigate(canonicalPath, { replace: true });
          return;
        }

        setTest(data);
        setTimeLeft(data.duration * 60);
        const submission = await aiTestApi.startSubmission({ test_id: id });
        if (active && submission) setSubmissionId(submission.id);
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
  }, [id, location.pathname, navigate, testKind]);

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

  // ============ SUBMITTING OVERLAY ============
  if (isSubmitting) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0e1a] via-[#0d1225] to-[#080c18] text-white select-none font-sans">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/[0.08] rounded-full blur-[150px]" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 animate-pulse">
            <Award size={40} className="text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight mb-3">Đang chấm điểm...</h2>
            <p className="text-slate-400 text-lg">AI đang phân tích câu trả lời của bạn</p>
          </div>
          <div className="flex gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-3 h-3 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============ RESULT SCREEN ============
  if (testResult) {
    const pct = testResult.percentage || 0;
    const grade = pct >= 90 ? { label: 'Xuất sắc', color: 'from-emerald-400 to-green-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', emoji: '🏆' }
      : pct >= 70 ? { label: 'Tốt', color: 'from-blue-400 to-cyan-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', emoji: '⭐' }
      : pct >= 50 ? { label: 'Trung bình', color: 'from-amber-400 to-orange-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', emoji: '📝' }
      : { label: 'Cần cải thiện', color: 'from-rose-400 to-pink-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', emoji: '💪' };

    const circumference = 2 * Math.PI * 80;
    const strokeOffset = circumference - (pct / 100) * circumference;

    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#0a0e1a] via-[#0d1225] to-[#080c18] text-white select-none font-sans overflow-y-auto">
        {/* Ambient effects */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/[0.06] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/[0.04] rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/[0.03] rounded-full blur-[200px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2 text-sm font-medium text-slate-400 mb-6 backdrop-blur-sm">
              <Trophy size={16} className="text-amber-400" />
              Kết quả bài test
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-3 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              {testResult.test_title || test?.title || 'Bài test'}
            </h1>
            <p className="text-slate-500 text-lg">Đã hoàn thành lúc {testResult.completed_at ? new Date(testResult.completed_at).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN')}</p>
          </div>

          {/* Score Card */}
          <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-10 mb-10 overflow-hidden">
            <div className={`absolute inset-0 ${grade.bg} opacity-30`} />
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
              {/* Circular Score */}
              <div className="relative flex-shrink-0">
                <svg width="200" height="200" className="-rotate-90">
                  <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <circle
                    cx="100" cy="100" r="80" fill="none"
                    stroke="url(#scoreGradient)" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={strokeOffset}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={pct >= 70 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171'} />
                      <stop offset="100%" stopColor={pct >= 70 ? '#06b6d4' : pct >= 50 ? '#f97316' : '#ec4899'} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black tracking-tight">{pct}</span>
                  <span className="text-sm font-bold text-slate-400 -mt-1">/ 100 điểm</span>
                </div>
              </div>

              {/* Score Details */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center gap-3 justify-center md:justify-start mb-4">
                  <span className="text-4xl">{grade.emoji}</span>
                  <span className={`text-3xl font-black bg-gradient-to-r ${grade.color} bg-clip-text text-transparent`}>{grade.label}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                    <p className="text-2xl font-black text-white">{testResult.total_score?.toFixed(1)}</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">Tổng điểm</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                    <p className="text-2xl font-black text-white">{testResult.max_score}</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">Điểm tối đa</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                    <p className="text-2xl font-black text-emerald-400">{testResult.correct_count}</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">Câu đúng</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                    <p className="text-2xl font-black text-white">{testResult.answered_questions}/{testResult.total_questions}</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">Đã trả lời</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Per-question breakdown */}
          {testResult.answers?.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xl font-black tracking-tight mb-6 flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-300">
                  <CheckSquare size={18} />
                </span>
                Chi tiết từng câu
              </h3>
              <div className="space-y-4">
                {testResult.answers.map((answer, index) => {
                  const score = answer.final_score;
                  const isCorrect = score >= 10;
                  const isMcq = answer.question_type === 'mcq';
                  const details = answer.scoring_details || {};
                  return (
                    <div
                      key={answer.question_id || index}
                      className={`rounded-2xl border p-5 transition-all ${
                        isCorrect
                          ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                          : score > 0
                            ? 'border-amber-500/20 bg-amber-500/[0.04]'
                            : 'border-rose-500/20 bg-rose-500/[0.04]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0 flex-1">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                            isCorrect ? 'bg-emerald-500/20 text-emerald-400' : score > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white/90 font-semibold leading-relaxed mb-2">{answer.question_content}</p>
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                              <span className="text-slate-500">Đáp án: <span className="text-white/80 font-medium">{answer.text_answer || '—'}</span></span>
                              {isMcq && answer.correct_answer && (
                                <span className="text-slate-500">Đáp án đúng: <span className="text-emerald-400 font-bold">{answer.correct_answer}</span></span>
                              )}
                              <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                                isMcq ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                              }`}>
                                {isMcq ? 'Trắc nghiệm' : 'Tự luận'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className={`text-xl font-black ${isCorrect ? 'text-emerald-400' : score > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                              {score.toFixed(1)}
                            </p>
                            <p className="text-xs text-slate-500">/ 10</p>
                          </div>
                          {isCorrect ? (
                            <CheckCircle size={24} className="text-emerald-400" />
                          ) : (
                            <XCircle size={24} className={score > 0 ? 'text-amber-400' : 'text-rose-400'} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 pb-8">
            <button
              onClick={() => navigate('/seeker/my-scores')}
              className="group inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-indigo-500/20 transition-all hover:shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              Về bảng điểm
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = test.questions[currentQIdx];
  const currentOptions = parseQuestionOptions(currentQ?.options);
  const usesAvatarLive3D = isAvatarLive3DType(test.test_type);
  const typeMeta = getTestTypeMeta(test.test_type);
  const TypeIcon = typeMeta.icon;
  const progressPercent = Math.round(((currentQIdx + 1) / test.questions.length) * 100);
  const isVideoAiTest = test.test_type === 'video_ai';
  const isMultipleChoiceTest = currentQ?.type === 'mcq' && !usesAvatarLive3D && !isVideoAiTest;

  if (isMultipleChoiceTest) {
    return (
      <div className="h-screen w-full overflow-hidden bg-[#f3f6fb] text-slate-950 select-none font-sans">
        <div className="flex h-full flex-col">
          <header className="relative overflow-hidden border-b border-slate-200 bg-white px-8 py-5 shadow-sm">
            <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${typeMeta.accent}`} />
            <div className="flex items-center justify-between gap-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${typeMeta.iconBg} text-white shadow-lg shadow-emerald-200/70`}>
                  <TypeIcon size={25} />
                </div>
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${typeMeta.badge}`}>
                      {typeMeta.label}
                    </span>
                    {suspiciousFlag && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                        <AlertTriangle size={13} />
                        Cảnh báo gian lận
                      </span>
                    )}
                  </div>
                  <h1 className="truncate text-2xl font-black tracking-tight text-slate-950">{test.title}</h1>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden min-w-[260px] sm:block">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Câu {currentQIdx + 1} / {test.questions.length}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${typeMeta.accent} transition-all duration-700`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <div className={`flex items-center gap-2.5 rounded-2xl border px-5 py-3 shadow-sm ${timeLeft < 60 ? 'border-rose-200 bg-rose-50 text-rose-700 animate-pulse' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                  <Clock size={18} className={timeLeft < 60 ? 'text-rose-500' : 'text-emerald-600'} />
                  <span className="font-mono text-2xl font-black tracking-wider">{formatTime(timeLeft)}</span>
                </div>
              </div>
            </div>
          </header>

          <main className="grid min-h-0 flex-1 gap-5 p-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(430px,0.78fr)]">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Câu hỏi {currentQIdx + 1}</p>
                    <p className="mt-1 text-sm font-medium text-slate-500">Một lựa chọn đúng</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                    {typeMeta.shortLabel}
                  </span>
                </div>
                <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-950">
                  {currentQ?.content}
                </h2>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Loại bài</p>
                    <p className="mt-2 text-lg font-black text-emerald-950">Trắc nghiệm</p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Chấm điểm</p>
                    <p className="mt-2 text-lg font-black text-blue-950">Tự động</p>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Tiến độ</p>
                    <p className="mt-2 text-lg font-black text-violet-950">{currentQIdx + 1}/{test.questions.length}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-700">Tiến độ câu hỏi</p>
                    <p className="text-xs font-semibold text-slate-500">{progressPercent}% hoàn thành</p>
                  </div>
                  <div className="grid grid-cols-10 gap-2">
                    {test.questions.map((question, index) => {
                      const isCurrent = index === currentQIdx;
                      const isDone = index < currentQIdx;
                      return (
                        <div
                          key={question.id || index}
                          className={`flex aspect-square items-center justify-center rounded-xl text-xs font-black transition-all ${
                            isCurrent
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                              : isDone
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-white text-slate-400 ring-1 ring-slate-200'
                          }`}
                        >
                          {index + 1}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <Send size={18} />
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Chọn đáp án</h3>
                    <p className="text-sm font-medium text-slate-500">A, B, C hoặc D</p>
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${textAnswer.trim() ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                  {textAnswer.trim() ? `Đã chọn ${textAnswer}` : 'Chưa chọn'}
                </span>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                {MCQ_KEYS.map((key) => {
                  if (!currentOptions[key]) return null;
                  const isSelected = textAnswer === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTextAnswer(key)}
                      className={`group relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50 shadow-lg shadow-emerald-100'
                          : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
                      }`}
                    >
                      <div className={`absolute left-0 top-0 h-full w-1 transition-colors ${isSelected ? 'bg-emerald-500' : 'bg-transparent group-hover:bg-emerald-200'}`} />
                      <div className="flex items-start gap-4">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-base font-black transition-all ${
                          isSelected ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-500 group-hover:border-emerald-200 group-hover:text-emerald-700'
                        }`}>
                          {key}
                        </div>
                        <p className={`pt-2 text-base font-semibold leading-relaxed ${isSelected ? 'text-emerald-950' : 'text-slate-700'}`}>
                          {currentOptions[key]}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50 p-5">
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={!textAnswer.trim()}
                  className="inline-flex min-w-44 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-7 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5 hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                >
                  {currentQIdx < test?.questions.length - 1 ? 'Câu tiếp theo' : 'Nộp bài'}
                  <Send size={17} />
                </button>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  if (isVideoAiTest) {
    return (
      <div className="h-screen w-full overflow-hidden bg-[#edf7ff] text-slate-950 select-none font-sans">
        <div className="flex h-full flex-col">
          <header className="relative overflow-hidden border-b border-sky-100 bg-white px-8 py-5 shadow-sm">
            <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${typeMeta.accent}`} />
            <div className="flex items-center justify-between gap-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${typeMeta.iconBg} text-white shadow-lg shadow-sky-200`}>
                  <TypeIcon size={25} />
                </div>
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${typeMeta.badge}`}>
                      {typeMeta.label}
                    </span>
                    <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                      Câu {currentQIdx + 1} / {test.questions.length}
                    </span>
                    {suspiciousFlag && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                        <AlertTriangle size={13} />
                        Cảnh báo gian lận
                      </span>
                    )}
                  </div>
                  <h1 className="truncate text-2xl font-black tracking-tight text-slate-950">{test.title}</h1>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden min-w-[280px] sm:block">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Tiến độ</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${typeMeta.accent} transition-all duration-700`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <div className={`flex items-center gap-2.5 rounded-2xl border px-5 py-3 shadow-sm ${timeLeft < 60 ? 'border-rose-200 bg-rose-50 text-rose-700 animate-pulse' : 'border-sky-100 bg-sky-50 text-slate-700'}`}>
                  <Clock size={18} className={timeLeft < 60 ? 'text-rose-500' : 'text-sky-600'} />
                  <span className="font-mono text-2xl font-black tracking-wider">{formatTime(timeLeft)}</span>
                </div>
              </div>
            </div>
          </header>

          <main className="grid min-h-0 flex-1 gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(430px,0.58fr)]">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-sky-50 p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-sky-600">Video tình huống</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Xem nội dung trước khi trả lời tự luận</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                  Tự luận
                </span>
              </div>

              <div className="min-h-0 flex-1 p-5">
                <div className="relative h-full min-h-[360px] overflow-hidden rounded-3xl bg-slate-950 shadow-2xl shadow-sky-950/15">
                  {currentQ?.video_url?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                    <img
                      src={currentQ.video_url}
                      alt="Nội dung câu hỏi"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : currentQ?.video_url?.includes('youtube.com/embed') ? (
                    <iframe
                      src={currentQ.video_url}
                      className="absolute inset-0 h-full w-full border-0"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  ) : (
                    <video
                      src={currentQ?.video_url || 'https://www.w3schools.com/html/mov_bbb.mp4'}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-6 pt-24">
                    <div className="max-w-4xl rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="font-mono text-xs font-black uppercase tracking-widest text-sky-200">
                          Câu hỏi {currentQIdx + 1}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white/75">
                          VideoAI
                        </span>
                      </div>
                      <h2 className="text-2xl font-black leading-snug tracking-tight text-white">
                        {currentQ?.content}
                      </h2>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-sky-50 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <Send size={18} />
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Câu trả lời</h3>
                    <p className="text-sm font-medium text-slate-500">Tự luận bằng văn bản hoặc giọng nói</p>
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${textAnswer.trim() ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                  {textAnswer.trim() ? 'Đã trả lời' : 'Chưa trả lời'}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
                <textarea
                  className="min-h-[300px] flex-1 resize-none rounded-2xl border border-sky-100 bg-sky-50/50 p-5 text-base font-medium leading-relaxed text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  placeholder={isRecording ? 'Đang nghe giọng nói, nội dung sẽ hiện ở đây...' : 'Nhập câu trả lời của bạn...'}
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                      <Mic size={14} className="text-sky-600" />
                      Ghi âm câu trả lời
                    </h4>
                    {speechNotice ? <span className="text-xs font-bold text-sky-700">{speechNotice}</span> : null}
                  </div>

                  <div className="flex items-center gap-4">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-200 transition hover:-translate-y-0.5 hover:shadow-sky-300"
                      >
                        <Mic size={28} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="flex h-16 w-16 shrink-0 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-200"
                      >
                        <Square size={25} fill="currentColor" />
                      </button>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-base font-black text-slate-900">
                        {isRecording ? 'Đang ghi âm' : 'Trả lời bằng giọng nói'}
                      </p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">
                        {isRecording
                          ? 'Bấm nút dừng khi bạn nói xong.'
                          : 'Bấm micro để nói, hệ thống sẽ tự điền nội dung vào ô trả lời.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-5">
                  <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Tiến độ câu hỏi</span>
                    <span>{currentQIdx + 1}/{test.questions.length}</span>
                  </div>
                  <div className="grid grid-cols-10 gap-2">
                    {test.questions.map((question, index) => {
                      const isCurrent = index === currentQIdx;
                      const isDone = index < currentQIdx;
                      return (
                        <div
                          key={question.id || index}
                          className={`flex aspect-square items-center justify-center rounded-xl text-xs font-black transition-all ${
                            isCurrent
                              ? 'bg-sky-600 text-white shadow-md shadow-sky-200'
                              : isDone
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-white text-slate-400 ring-1 ring-slate-200'
                          }`}
                        >
                          {index + 1}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-sky-50 bg-slate-50 p-5">
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={isRecording || !textAnswer.trim()}
                  className="inline-flex min-w-44 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-7 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-200 transition-all hover:-translate-y-0.5 hover:from-sky-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                >
                  {currentQIdx < test?.questions.length - 1 ? 'Câu tiếp theo' : 'Nộp bài'}
                  <Send size={17} />
                </button>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gradient-to-br from-[#0a0e1a] via-[#0d1225] to-[#080c18] text-white flex flex-col select-none overflow-hidden font-sans">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/[0.07] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/[0.05] rounded-full blur-[100px]" />
      </div>

      {/* Test Header */}
      <div className="relative z-10 px-8 py-4 flex justify-between items-center backdrop-blur-xl bg-white/[0.03] border-b border-white/[0.06]">
        <div className="flex items-center gap-5">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeMeta.iconBg} flex items-center justify-center shadow-lg shadow-indigo-500/20`}>
            <TypeIcon className="text-white" size={22} />
          </div>
          <div className="min-w-[280px]">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-white/95 tracking-tight">{test.title}</h1>
              <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${typeMeta.darkBadge}`}>
                {typeMeta.label}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="h-1 w-44 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${typeMeta.accent} transition-all duration-700 ease-out`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-400">Câu {currentQIdx + 1} / {test.questions.length}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {suspiciousFlag && (
            <div className="flex items-center gap-2 text-rose-300 text-sm font-semibold bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl animate-pulse">
              <AlertTriangle size={16} />
              Cảnh báo gian lận
            </div>
          )}
          <div className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border backdrop-blur-sm ${timeLeft < 60 ? 'bg-rose-500/10 border-rose-400/25 text-rose-300 animate-pulse' : 'bg-white/[0.04] border-white/[0.08] text-slate-300'}`}>
            <Clock size={16} className={timeLeft < 60 ? 'text-rose-400' : 'text-indigo-400'} />
            <span className="text-xl font-mono font-bold tracking-wider">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="relative z-10 flex-1 flex gap-5 p-5 overflow-hidden">
        
        {/* Left Side: Media Display */}
        <div className="w-[55%] min-w-0 relative overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30 backdrop-blur-sm shadow-2xl flex flex-col group">
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
            <div className={`absolute bottom-0 left-0 right-0 z-30 ${usesAvatarLive3D ? 'p-4' : 'p-6'}`}>
              <div className={`border border-white/[0.08] bg-black/60 backdrop-blur-xl transition-all duration-300 ${usesAvatarLive3D ? 'rounded-xl px-5 py-4' : 'rounded-xl p-6'}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-indigo-300 font-mono text-xs font-semibold tracking-widest uppercase">Câu hỏi {currentQIdx + 1}</span>
                  <span className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-400">
                    {currentQ?.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}
                  </span>
                </div>
                <h2 className={`font-semibold text-white/95 leading-relaxed ${usesAvatarLive3D ? 'text-lg max-h-32 overflow-y-auto pr-2' : 'text-xl'}`}>{currentQ?.content}</h2>
                {currentQ?.type === 'mcq' && <p className="text-sm text-slate-500 mt-3 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>Chọn một đáp án bên phải</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Input Panel */}
        <div className="w-[45%] min-w-0 flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm shadow-2xl relative">
          <div className="flex-1 p-6 overflow-y-auto relative z-10 flex flex-col">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-white/90 flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-300">
                  <Send size={16} />
                </span>
                Câu trả lời
              </h3>
              <span className={`rounded-lg px-3 py-1 text-xs font-medium ${textAnswer.trim() ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' : 'bg-white/[0.04] text-slate-500 border border-white/[0.06]'}`}>
                {textAnswer.trim() ? '✓ Đã chọn' : 'Chưa chọn'}
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
                      className={`relative overflow-hidden group text-left w-full rounded-xl border px-5 py-4 transition-all duration-300 ${
                        isSelected 
                          ? 'bg-indigo-500/10 border-indigo-400/40 shadow-lg shadow-indigo-500/10'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]'
                      }`}
                    >
                      <div className={`absolute left-0 top-0 h-full w-0.5 rounded-r transition-all ${isSelected ? 'bg-gradient-to-b from-indigo-400 to-purple-400' : 'bg-transparent group-hover:bg-white/10'}`} />
                      <div className="relative z-10 flex items-start gap-4">
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold transition ${
                          isSelected ? 'border-indigo-400 bg-gradient-to-br from-indigo-500 to-purple-500 text-white' : 'border-white/10 text-slate-500 group-hover:border-white/20 group-hover:text-slate-300'
                        }`}>
                          {key}
                        </div>
                        <span className={`text-[15px] leading-relaxed ${isSelected ? 'text-white font-medium' : 'text-slate-400'}`}>
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
                    className="relative flex-1 w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 text-white/90 text-base placeholder-white/20 focus:outline-none focus:border-indigo-400/40 focus:ring-1 focus:ring-indigo-400/20 resize-none transition-all"
                    placeholder={isRecording ? 'Nói câu trả lời của bạn, nội dung sẽ hiện ở đây...' : 'Nhập câu trả lời của bạn...'}
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                  />
                </div>

                {/* Voice Input Section */}
                <div className="mt-5 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                  <h4 className="font-medium text-slate-400 mb-4 flex items-center gap-2 text-xs uppercase tracking-widest">
                    <Mic size={14} className="text-indigo-400" /> Ghi âm câu trả lời
                  </h4>
                  <div className="flex items-center gap-5">
                    {!isRecording ? (
                      <button 
                        onClick={startRecording}
                        className="group relative w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/25 transition-all hover:shadow-rose-500/40 hover:scale-105"
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
          <div className="p-5 border-t border-white/[0.06] flex justify-end relative z-10">
            <button 
              onClick={handleSubmitAnswer}
              disabled={isRecording || !textAnswer.trim()}
              className="group disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-8 py-3.5 rounded-xl font-semibold flex items-center gap-3 text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/25 hover:from-indigo-400 hover:to-purple-400"
            >
              <span>{currentQIdx < test?.questions.length - 1 ? 'Câu tiếp theo' : 'Nộp bài'}</span>
              <Send size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateTestUI;
