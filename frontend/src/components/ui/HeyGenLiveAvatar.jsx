import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AgentEventsEnum,
  CommandEventsEnum,
  LiveAvatarSession,
  SessionEvent,
  SessionState,
} from '@heygen/liveavatar-web-sdk';
import { AlertTriangle, Loader2, Radio, Volume2 } from 'lucide-react';
import { aiTestApi } from '@services/ai-tests/aiTestApi';

function pickBrowserVoice(voices) {
  const list = Array.isArray(voices) ? voices : [];
  const femaleHints = ['hoai', 'hoài', 'linh', 'mai', 'my', 'thao', 'thảo', 'trang', 'female', 'woman', 'samantha', 'victoria'];
  const maleHints = ['namminh', 'nam minh', 'male', 'man'];

  return [...list]
    .sort((a, b) => {
      const score = (voice) => {
        const name = String(voice.name || '').toLowerCase();
        const lang = String(voice.lang || '').toLowerCase();
        if (maleHints.some((hint) => name.includes(hint))) return -100;

        let value = 0;
        if (lang.startsWith('vi')) value += 50;
        if (femaleHints.some((hint) => name.includes(hint))) value += 30;
        if (name.includes('google') || name.includes('microsoft') || name.includes('natural')) value += 12;
        return value;
      };

      return score(b) - score(a);
    })[0] || null;
}

function speakWithBrowserVoice(text, setSpeaking, onBlocked) {
  const content = String(text || '').trim();
  if (!content || typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    onBlocked?.();
    return () => {};
  }

  const synth = window.speechSynthesis;
  let blockedTimer = null;
  let resumeTimer = null;
  let voiceTimer = null;
  let cancelled = false;
  let removeVoiceListener = null;

  const start = () => {
    if (cancelled) return;

    synth.cancel();
    synth.resume();

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.92;
    utterance.pitch = 1.06;
    utterance.volume = 1;

    const voice = pickBrowserVoice(synth.getVoices());
    if (voice) utterance.voice = voice;

    let started = false;
    blockedTimer = window.setTimeout(() => {
      if (!started && !synth.speaking) onBlocked?.();
    }, 4200);

    resumeTimer = window.setInterval(() => {
      if (!cancelled) synth.resume();
    }, 350);

    utterance.onstart = () => {
      started = true;
      window.clearTimeout(blockedTimer);
      window.clearInterval(resumeTimer);
      setSpeaking(true);
    };
    utterance.onend = () => {
      window.clearTimeout(blockedTimer);
      window.clearInterval(resumeTimer);
      setSpeaking(false);
    };
    utterance.onerror = () => {
      window.clearTimeout(blockedTimer);
      window.clearInterval(resumeTimer);
      setSpeaking(false);
      onBlocked?.();
    };

    synth.speak(utterance);
    window.setTimeout(() => synth.resume(), 0);
    window.setTimeout(() => synth.resume(), 600);
    window.setTimeout(() => synth.resume(), 1400);
  };

  if (synth.getVoices().length) {
    start();
  } else {
    const handleVoicesChanged = () => {
      removeVoiceListener?.();
      start();
    };
    removeVoiceListener = () => synth.removeEventListener?.('voiceschanged', handleVoicesChanged);
    synth.addEventListener?.('voiceschanged', handleVoicesChanged);
    voiceTimer = window.setTimeout(handleVoicesChanged, 1200);
  }

  return () => {
    cancelled = true;
    removeVoiceListener?.();
    window.clearTimeout(blockedTimer);
    window.clearTimeout(voiceTimer);
    window.clearInterval(resumeTimer);
    synth.cancel();
    setSpeaking(false);
  };
}

function estimateSpeechDurationMs(text) {
  const wordCount = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.min(30000, Math.max(3500, wordCount * 430 + 1800));
}

const LIVEKIT_COMMAND_CHANNEL_TOPIC = 'agent-control';
const LIVEAVATAR_BROWSER_LOCK_KEY = 'webtimviec:liveavatar:active-session';
const LIVEAVATAR_BROWSER_LOCK_TTL_MS = 45000;

function createLiveAvatarEventId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sendLiveAvatarDataCommand(session, command) {
  const publishData = session?.room?.localParticipant?.publishData;
  if (!publishData) return false;

  const payload = {
    ...command,
    ...(command.event_type === CommandEventsEnum.AVATAR_INTERRUPT ? {} : { event_id: createLiveAvatarEventId() }),
  };
  const data = new TextEncoder().encode(JSON.stringify(payload));
  publishData.call(session.room.localParticipant, data, {
    reliable: true,
    topic: LIVEKIT_COMMAND_CHANNEL_TOPIC,
  });
  return true;
}

function interruptLiveAvatar(session) {
  return sendLiveAvatarDataCommand(session, {
    event_type: CommandEventsEnum.AVATAR_INTERRUPT,
  });
}

function speakLiveAvatarText(session, text) {
  return sendLiveAvatarDataCommand(session, {
    event_type: CommandEventsEnum.AVATAR_SPEAK_TEXT,
    text,
  });
}

function speakLiveAvatarResponse(session, text) {
  return sendLiveAvatarDataCommand(session, {
    event_type: CommandEventsEnum.AVATAR_SPEAK_RESPONSE,
    text,
  });
}

function createBrowserSessionId() {
  return createLiveAvatarEventId();
}

function readLiveAvatarBrowserLock() {
  try {
    const value = window.localStorage.getItem(LIVEAVATAR_BROWSER_LOCK_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeLiveAvatarBrowserLock(ownerId) {
  try {
    window.localStorage.setItem(
      LIVEAVATAR_BROWSER_LOCK_KEY,
      JSON.stringify({ ownerId, updatedAt: Date.now() }),
    );
    return true;
  } catch {
    return true;
  }
}

function removeLiveAvatarBrowserLock(ownerId) {
  try {
    const currentLock = readLiveAvatarBrowserLock();
    if (!currentLock || currentLock.ownerId === ownerId) {
      window.localStorage.removeItem(LIVEAVATAR_BROWSER_LOCK_KEY);
    }
  } catch {
    // Ignore storage cleanup failures.
  }
}

function acquireLiveAvatarBrowserLock(ownerId) {
  const currentLock = readLiveAvatarBrowserLock();
  const isFreshLock = currentLock?.ownerId
    && currentLock.ownerId !== ownerId
    && Date.now() - Number(currentLock.updatedAt || 0) < LIVEAVATAR_BROWSER_LOCK_TTL_MS;

  if (isFreshLock) return false;
  return writeLiveAvatarBrowserLock(ownerId);
}

const LIVEAVATAR_STATUS = {
  [SessionState.INACTIVE]: 'Đang chuẩn bị LiveAvatar',
  [SessionState.CONNECTING]: 'Đang kết nối LiveAvatar',
  [SessionState.CONNECTED]: 'LiveAvatar đã sẵn sàng',
  [SessionState.DISCONNECTING]: 'Đang ngắt LiveAvatar',
  [SessionState.DISCONNECTED]: 'LiveAvatar đã ngắt',
};

const HeyGenLiveAvatar = ({ questionText, speakKey, onSpeakingChange }) => {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const mountedRef = useRef(false);
  const lastAvatarSpeakKeyRef = useRef('');
  const browserSpeechCleanupRef = useRef(null);
  const avatarSpeechStartedRef = useRef(false);
  const audioBlockedRef = useRef(false);
  const latestSpeechRef = useRef({ key: '', text: '' });
  const speakRequestIdRef = useRef(0);
  const avatarSpeakEndTimerRef = useRef(null);
  const avatarSpeakRetryTimerRef = useRef(null);
  const avatarSpeakAttemptRef = useRef(0);
  const pendingAvatarSpeakKeyRef = useRef('');
  const queueLiveAvatarSpeechRef = useRef(null);
  const browserSessionIdRef = useRef(createBrowserSessionId());

  const [sessionState, setSessionState] = useState(SessionState.INACTIVE);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [isBrowserSpeaking, setIsBrowserSpeaking] = useState(false);
  const [hasCheckedStreamAudio, setHasCheckedStreamAudio] = useState(false);
  const [hasUserAudioGesture, setHasUserAudioGesture] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [blockedSpeakKey, setBlockedSpeakKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [replayNonce, setReplayNonce] = useState(0);

  const normalizedQuestion = useMemo(() => String(questionText || '').trim(), [questionText]);
  const activeSpeakKey = `${speakKey}:${replayNonce}:${normalizedQuestion}`;

  const isSpeaking = isAvatarSpeaking || isBrowserSpeaking;
  const isBrowserFallbackPending = blockedSpeakKey === activeSpeakKey;
  const needsAudioGesture = !hasUserAudioGesture && (
    (hasCheckedStreamAudio && audioBlocked && !isAudioUnlocked)
    || (Boolean(errorMessage) && sessionState === SessionState.DISCONNECTED)
  );
  const statusText = isAvatarSpeaking
    ? 'LiveAvatar đang nói...'
    : isBrowserSpeaking
      ? 'Đang đọc câu hỏi...'
      : needsAudioGesture
        ? 'Bấm loa để bật tiếng'
        : LIVEAVATAR_STATUS[sessionState] || 'Đang kết nối LiveAvatar';

  const startBrowserFallback = useCallback((questionOverride, speakKeyOverride) => {
    const latestSpeech = latestSpeechRef.current;
    const content = String(questionOverride ?? latestSpeech.text ?? '').trim();
    const fallbackSpeakKey = String(speakKeyOverride ?? latestSpeech.key ?? '');

    if (!content) return;
    browserSpeechCleanupRef.current?.();
    browserSpeechCleanupRef.current = speakWithBrowserVoice(
      content,
      setIsBrowserSpeaking,
      () => setBlockedSpeakKey(fallbackSpeakKey),
    );
  }, []);

  useEffect(() => {
    latestSpeechRef.current = { key: activeSpeakKey, text: normalizedQuestion };
  }, [activeSpeakKey, normalizedQuestion]);

  useEffect(() => {
    audioBlockedRef.current = audioBlocked;
  }, [audioBlocked]);

  const clearAvatarSpeakTimer = useCallback(() => {
    window.clearTimeout(avatarSpeakEndTimerRef.current);
    avatarSpeakEndTimerRef.current = null;
  }, []);

  const clearAvatarSpeakRetryTimer = useCallback(() => {
    window.clearTimeout(avatarSpeakRetryTimerRef.current);
    avatarSpeakRetryTimerRef.current = null;
  }, []);

  const queueLiveAvatarSpeech = useCallback((text, speakKey, attempt = 0) => {
    const content = String(text || '').trim();
    const session = sessionRef.current;

    if (!content || !session || session.state !== SessionState.CONNECTED) return false;

    clearAvatarSpeakRetryTimer();
    pendingAvatarSpeakKeyRef.current = speakKey;
    avatarSpeakAttemptRef.current = attempt;

    if (attempt === 0) {
      interruptLiveAvatar(session);
      speakLiveAvatarText(session, content);
    } else if (attempt === 1) {
      speakLiveAvatarText(session, content);
      speakLiveAvatarResponse(session, content);
    } else {
      speakLiveAvatarResponse(session, content);
    }

    if (attempt < 2) {
      avatarSpeakRetryTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        if (pendingAvatarSpeakKeyRef.current !== speakKey) return;
        if (avatarSpeechStartedRef.current) return;

        queueLiveAvatarSpeechRef.current?.(content, speakKey, attempt + 1);
      }, attempt === 0 ? 1300 : 2200);
    }

    return true;
  }, [clearAvatarSpeakRetryTimer]);

  useEffect(() => {
    queueLiveAvatarSpeechRef.current = queueLiveAvatarSpeech;
  }, [queueLiveAvatarSpeech]);

  const enableVideoAudio = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return false;

    video.muted = false;
    video.volume = 1;

    try {
      await video.play();
      setIsVideoPlaying(true);
      audioBlockedRef.current = false;
      setIsAudioUnlocked(true);
      setAudioBlocked(false);
      return true;
    } catch {
      audioBlockedRef.current = true;
      setIsAudioUnlocked(false);
      setAudioBlocked(true);
      return false;
    }
  }, []);

  const playVideoMuted = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.volume = 0;
    try {
      await video.play();
      setIsVideoPlaying(true);
    } catch {
      setIsVideoPlaying(false);
    }
  }, []);

  useEffect(() => {
    onSpeakingChange?.(isSpeaking);
  }, [isSpeaking, onSpeakingChange]);

  useEffect(() => {
    const loadVoices = () => {
      window.speechSynthesis?.getVoices();
    };

    loadVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, []);

  useEffect(() => {
    const unlockAudio = async () => {
      const shouldReplayLiveAvatar = !hasUserAudioGesture
        && normalizedQuestion
        && isStreamReady
        && sessionState === SessionState.CONNECTED
        && (audioBlocked || !isAudioUnlocked);

      setHasUserAudioGesture(true);
      const audioStarted = await enableVideoAudio();
      if (!audioStarted) await playVideoMuted();
      window.speechSynthesis?.resume?.();

      if (isBrowserFallbackPending && (errorMessage || sessionState === SessionState.DISCONNECTED)) {
        startBrowserFallback();
        return;
      }

      if (shouldReplayLiveAvatar) {
        lastAvatarSpeakKeyRef.current = '';
        avatarSpeechStartedRef.current = false;
        setBlockedSpeakKey('');
        setReplayNonce((current) => current + 1);
      }
    };

    window.addEventListener('pointerdown', unlockAudio, { capture: true });
    window.addEventListener('keydown', unlockAudio, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio, { capture: true });
      window.removeEventListener('keydown', unlockAudio, { capture: true });
    };
  }, [
    audioBlocked,
    enableVideoAudio,
    errorMessage,
    hasUserAudioGesture,
    isAudioUnlocked,
    isBrowserFallbackPending,
    isStreamReady,
    normalizedQuestion,
    playVideoMuted,
    sessionState,
    startBrowserFallback,
  ]);

  useEffect(() => {
    if (!audioBlocked || !isStreamReady) return undefined;

    let attempts = 0;
    const retryTimer = window.setInterval(async () => {
      attempts += 1;
      const audioStarted = await enableVideoAudio();
      if (!audioStarted) await playVideoMuted();
      if (attempts >= 12) window.clearInterval(retryTimer);
    }, 850);

    return () => window.clearInterval(retryTimer);
  }, [audioBlocked, enableVideoAudio, isStreamReady, playVideoMuted]);

  useEffect(() => {
    if (!isStreamReady) return undefined;

    const resumeTimer = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video || (!video.paused && video.readyState >= 2)) return;

      const audioStarted = await enableVideoAudio();
      if (!audioStarted) await playVideoMuted();
    }, 1400);

    return () => window.clearInterval(resumeTimer);
  }, [enableVideoAudio, isStreamReady, playVideoMuted]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    let lockHeartbeatTimer = null;

    const releaseBrowserLock = () => {
      window.clearInterval(lockHeartbeatTimer);
      lockHeartbeatTimer = null;
      removeLiveAvatarBrowserLock(browserSessionIdRef.current);
    };

    const startBrowserLockHeartbeat = () => {
      releaseBrowserLock();
      writeLiveAvatarBrowserLock(browserSessionIdRef.current);
      lockHeartbeatTimer = window.setInterval(() => {
        writeLiveAvatarBrowserLock(browserSessionIdRef.current);
      }, 12000);
    };

    window.addEventListener('pagehide', releaseBrowserLock);
    window.addEventListener('beforeunload', releaseBrowserLock);

    const startLiveAvatar = async () => {
      try {
        setErrorMessage('');
        if (!acquireLiveAvatarBrowserLock(browserSessionIdRef.current)) {
          setSessionState(SessionState.DISCONNECTED);
          setErrorMessage('LiveAvatar đang mở ở tab khác. Hãy đóng tab test/avatar cũ rồi tải lại trang này.');
          return;
        }
        startBrowserLockHeartbeat();

        const { sessionToken, apiUrl } = await aiTestApi.createLiveAvatarSessionToken({
          mode: 'FULL',
          video_quality: 'low',
          video_encoding: 'VP8',
          disable_greeting: true,
        });
        if (cancelled || !sessionToken) return;

        const session = new LiveAvatarSession(sessionToken, {
          apiUrl,
          voiceChat: false,
        });

        sessionRef.current = session;

        session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
          if (!mountedRef.current) return;
          setSessionState(state);
        });

        session.on(SessionEvent.SESSION_STREAM_READY, async () => {
          if (!mountedRef.current || !videoRef.current) return;
          setIsStreamReady(true);
          session.attach(videoRef.current);

          const audioStarted = await enableVideoAudio();
          if (!audioStarted) await playVideoMuted();
          if (!mountedRef.current) return;
          setHasCheckedStreamAudio(true);
        });

        session.on(SessionEvent.SESSION_DISCONNECTED, () => {
          if (!mountedRef.current) return;
          setIsStreamReady(false);
          setIsVideoPlaying(false);
          setIsAvatarSpeaking(false);
          clearAvatarSpeakTimer();
          setHasCheckedStreamAudio(false);
          setIsAudioUnlocked(false);
          releaseBrowserLock();
        });

        session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
          if (!mountedRef.current) return;
          avatarSpeechStartedRef.current = true;
          pendingAvatarSpeakKeyRef.current = '';
          clearAvatarSpeakRetryTimer();
          setIsAvatarSpeaking(true);
          browserSpeechCleanupRef.current?.();
          browserSpeechCleanupRef.current = null;
          clearAvatarSpeakTimer();
          avatarSpeakEndTimerRef.current = window.setTimeout(() => {
            if (!mountedRef.current) return;
            setIsAvatarSpeaking(false);
          }, estimateSpeechDurationMs(latestSpeechRef.current.text));
        });

        session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
          if (!mountedRef.current) return;
          clearAvatarSpeakTimer();
          clearAvatarSpeakRetryTimer();
          setIsAvatarSpeaking(false);
        });

        await session.start();
        if (cancelled) {
          session.stop().catch(() => {});
          releaseBrowserLock();
        }
      } catch (err) {
        releaseBrowserLock();
        if (cancelled || !mountedRef.current) return;
        setErrorMessage(err.message || 'Không thể mở LiveAvatar.');
        setSessionState(SessionState.DISCONNECTED);
      }
    };

    startLiveAvatar();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.removeEventListener('pagehide', releaseBrowserLock);
      window.removeEventListener('beforeunload', releaseBrowserLock);
      releaseBrowserLock();
      clearAvatarSpeakTimer();
      clearAvatarSpeakRetryTimer();
      browserSpeechCleanupRef.current?.();
      browserSpeechCleanupRef.current = null;
      const currentSession = sessionRef.current;
      sessionRef.current = null;
      if (currentSession) currentSession.stop().catch(() => {});
    };
  }, [clearAvatarSpeakRetryTimer, clearAvatarSpeakTimer, enableVideoAudio, playVideoMuted]);

  useEffect(() => {
    if (
      !normalizedQuestion
      || lastAvatarSpeakKeyRef.current === activeSpeakKey
    ) {
      return undefined;
    }

    if (!isStreamReady || !hasCheckedStreamAudio || sessionState !== SessionState.CONNECTED) {
      if ((errorMessage || sessionState === SessionState.DISCONNECTED) && hasUserAudioGesture) {
        lastAvatarSpeakKeyRef.current = activeSpeakKey;
        avatarSpeechStartedRef.current = false;
        browserSpeechCleanupRef.current?.();
        browserSpeechCleanupRef.current = null;
        startBrowserFallback(normalizedQuestion, activeSpeakKey);
      }
      return undefined;
    }

    if (audioBlocked && !isAudioUnlocked && !hasUserAudioGesture) {
      return undefined;
    }

    lastAvatarSpeakKeyRef.current = activeSpeakKey;
    avatarSpeechStartedRef.current = false;
    browserSpeechCleanupRef.current?.();
    browserSpeechCleanupRef.current = null;

    const requestId = speakRequestIdRef.current + 1;
    speakRequestIdRef.current = requestId;
    let cancelled = false;

    const startFallbackForCurrentQuestion = () => {
      if (cancelled || speakRequestIdRef.current !== requestId) return;
      if (sessionRef.current?.state === SessionState.CONNECTED) return;
      startBrowserFallback(normalizedQuestion, activeSpeakKey);
    };

    try {
      if (!queueLiveAvatarSpeech(normalizedQuestion, activeSpeakKey)) {
        startFallbackForCurrentQuestion();
      }
    } catch {
      startFallbackForCurrentQuestion();
    }

    return () => {
      cancelled = true;
      if (pendingAvatarSpeakKeyRef.current === activeSpeakKey) {
        clearAvatarSpeakRetryTimer();
      }
    };
  }, [
    activeSpeakKey,
    audioBlocked,
    clearAvatarSpeakRetryTimer,
    errorMessage,
    hasCheckedStreamAudio,
    hasUserAudioGesture,
    isAudioUnlocked,
    isStreamReady,
    normalizedQuestion,
    queueLiveAvatarSpeech,
    sessionState,
    startBrowserFallback,
  ]);

  const handleReplay = async () => {
    if (!normalizedQuestion) return;

    setHasUserAudioGesture(true);
    lastAvatarSpeakKeyRef.current = '';
    avatarSpeechStartedRef.current = false;
    setBlockedSpeakKey('');
    await enableVideoAudio();
    setReplayNonce((current) => current + 1);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#071020]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.055)_1px,transparent_1px)] bg-[size:84px_84px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_42%,rgba(34,211,238,0.22),transparent_34%),linear-gradient(180deg,rgba(9,15,33,0.12),rgba(0,0,0,0.72))]" />

      <video
        ref={videoRef}
        className={`absolute inset-0 z-10 h-full w-full scale-[1.01] object-cover transition-opacity duration-500 [backface-visibility:hidden] [transform:translateZ(0)] ${
          isStreamReady && isVideoPlaying ? 'opacity-100' : 'opacity-0'
        }`}
        autoPlay
        playsInline
        preload="auto"
        disablePictureInPicture
        onPlaying={() => setIsVideoPlaying(true)}
        onPause={() => setIsVideoPlaying(false)}
        onStalled={() => playVideoMuted()}
        onWaiting={() => playVideoMuted()}
      />

      {(!isStreamReady || !isVideoPlaying) ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#071020]/92">
          <Loader2 className="mb-4 animate-spin text-cyan-300" size={38} />
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200">LiveAvatar WebRTC</p>
          <p className="mt-2 text-sm text-slate-300">{errorMessage || statusText}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="absolute left-5 right-5 top-20 z-30 flex items-center gap-3 rounded-lg border border-amber-300/35 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100 backdrop-blur-md">
          <AlertTriangle size={20} />
          {errorMessage}
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-5 top-5 z-30 flex items-center gap-2 rounded-full border border-white/16 bg-black/45 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md">
        <span className={`h-2 w-2 rounded-full ${isSpeaking ? 'bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)] animate-pulse' : 'bg-emerald-300'}`} />
        {statusText}
      </div>

      <button
        type="button"
        onClick={handleReplay}
        title="Bật âm thanh và đọc lại câu hỏi"
        className="absolute right-5 top-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-200/35 bg-black/45 text-cyan-100 backdrop-blur-md transition hover:border-cyan-100 hover:bg-cyan-400/15"
      >
        <Volume2 size={20} />
      </button>

      <div className="pointer-events-none absolute bottom-5 right-5 z-30 flex items-center gap-2 rounded-full border border-cyan-300/20 bg-black/45 px-3 py-2 text-xs font-semibold text-cyan-100 backdrop-blur-md">
        <Radio size={14} />
        LiveAvatar
      </div>
    </div>
  );
};

export default HeyGenLiveAvatar;
