import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, CalendarClock, CheckCircle2, ClipboardCheck, Loader2, Mic, MicOff, Monitor, MonitorOff, Save, Star, UserCheck, Video, VideoOff, PhoneOff } from 'lucide-react';
import { io } from 'socket.io-client';
import API_BASE_URL from '@services/http/baseUrl';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

function formatDateTime(value) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

const DEFAULT_RATINGS = {
  technical: 3,
  problem_solving: 3,
  communication: 3,
  culture_fit: 3,
};

const RATING_FIELDS = [
  { key: 'technical', label: 'Chuyên môn' },
  { key: 'problem_solving', label: 'Xử lý vấn đề' },
  { key: 'communication', label: 'Giao tiếp' },
  { key: 'culture_fit', label: 'Phù hợp văn hóa' },
];

const RECOMMENDATION_LABELS = {
  strong_yes: 'Rất nên tuyển',
  yes: 'Nên tuyển',
  consider: 'Cân nhắc thêm',
  no: 'Chưa phù hợp',
};

function getAverageRating(ratings = DEFAULT_RATINGS) {
  const values = RATING_FIELDS.map((field) => Number(ratings[field.key] || 0));
  return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '0.0';
}

function createDefaultEvaluationForm() {
  return {
    ratings: { ...DEFAULT_RATINGS },
    strengths: '',
    concerns: '',
    recommendation: 'consider',
    feedback_to_candidate: '',
  };
}

function RatingInput({ label, value, onChange }) {
  return (
    <label className="block rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-200">{label}</span>
        <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs font-black text-indigo-200">{value}/5</span>
      </span>
      <input
        type="range"
        min="1"
        max="5"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-indigo-500"
      />
    </label>
  );
}

function FloatingEvaluationWidget({ room, form, setForm, onSave, saving, notice }) {
  const candidateName = room?.current_candidate?.candidate_name || room?.candidate_name || 'Ứng viên hiện tại';
  const quickNotes = [
    'Câu trả lời có ví dụ cụ thể',
    'Cần hỏi thêm về kinh nghiệm thực tế',
    'Giao tiếp rõ, biết lắng nghe',
  ];
  const [open, setOpen] = useState(true);
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 24, y: 120 };
    return {
      x: Math.max(16, window.innerWidth - 96),
      y: Math.max(96, Math.min(window.innerHeight - 176, 180)),
    };
  });
  const dragRef = useRef(null);

  const clampPosition = useCallback((x, y) => {
    if (typeof window === 'undefined') return { x, y };
    const size = 64;
    const margin = 12;
    return {
      x: Math.min(Math.max(x, margin), window.innerWidth - size - margin),
      y: Math.min(Math.max(y, 76), window.innerHeight - size - margin),
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setPosition((current) => clampPosition(current.x, current.y));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  const appendConcern = (note) => {
    setForm((prev) => ({
      ...prev,
      concerns: prev.concerns ? `${prev.concerns}\n- ${note}` : `- ${note}`,
    }));
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) drag.moved = true;
    setPosition(clampPosition(drag.originX + deltaX, drag.originY + deltaY));
  };

  const handlePointerEnd = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!drag.moved) setOpen((current) => !current);
    dragRef.current = null;
  };

  const isLeftSide = typeof window !== 'undefined' ? position.x < window.innerWidth / 2 : true;
  const openBelow = typeof window !== 'undefined' ? position.y < window.innerHeight / 2 : true;
  const panelMaxHeight = openBelow
    ? `calc(100vh - ${Math.round(position.y + 88)}px)`
    : `${Math.max(280, Math.round(position.y - 24))}px`;

  return (
    <div className="fixed z-[90]" style={{ left: `${position.x}px`, top: `${position.y}px` }}>
      {open ? (
        <aside
          className={`absolute ${isLeftSide ? 'left-0' : 'right-0'} ${openBelow ? 'top-[76px]' : 'bottom-[76px]'} flex w-[calc(100vw-32px)] max-w-[390px] flex-col overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#101528]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl`}
          style={{ maxHeight: panelMaxHeight }}
        >
          <div className="flex items-start gap-3 border-b border-white/[0.06] pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-200">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">Trợ lý phỏng vấn</p>
              <p className="mt-1 truncate text-xs text-slate-400">{candidateName}</p>
            </div>
            <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-black text-indigo-100">
              {getAverageRating(form.ratings)}/5
            </span>
          </div>

          <div className="mt-4 rounded-2xl rounded-tl-sm bg-indigo-500/15 px-4 py-3 text-sm leading-6 text-indigo-100">
            Ghi chú nội bộ cho lượt phỏng vấn này.
          </div>

          <div className="mt-4 grid gap-3">
            {RATING_FIELDS.map((field) => (
              <RatingInput
                key={field.key}
                label={field.label}
                value={form.ratings[field.key]}
                onChange={(value) => setForm((prev) => ({ ...prev, ratings: { ...prev.ratings, [field.key]: value } }))}
              />
            ))}
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Ghi chú nhanh</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickNotes.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => appendConcern(note)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.1]"
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-200">Điểm mạnh</span>
            <textarea
              value={form.strengths}
              onChange={(event) => setForm((prev) => ({ ...prev, strengths: event.target.value }))}
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Ghi điểm mạnh trong lúc trao đổi..."
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-200">Điểm cần làm rõ</span>
            <textarea
              value={form.concerns}
              onChange={(event) => setForm((prev) => ({ ...prev, concerns: event.target.value }))}
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Ghi rủi ro hoặc câu cần hỏi thêm..."
            />
          </label>

          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-200">Kết luận tạm</span>
              <select
                value={form.recommendation}
                onChange={(event) => setForm((prev) => ({ ...prev, recommendation: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/[0.1] bg-[#101528] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              >
                {Object.entries(RECOMMENDATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="bg-[#101528] text-white">{label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Lưu đánh giá
            </button>
          </div>

          {notice ? <p className="mt-3 text-xs text-emerald-200">{notice}</p> : null}
        </aside>
      ) : null}

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="relative flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border border-indigo-200/30 bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-2xl shadow-indigo-900/40 transition hover:scale-105 cursor-grab active:cursor-grabbing"
        title="Kéo để di chuyển, bấm để mở hoặc đóng trợ lý phỏng vấn"
        aria-label="Trợ lý phỏng vấn"
      >
        <Bot className="h-7 w-7" />
        <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-[#101528] px-2 py-0.5 text-[11px] font-black text-indigo-100">
          {getAverageRating(form.ratings)}
        </span>
      </button>
    </div>
  );
}

export default function InterviewRoomPage() {
  const { token } = useParams();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState('candidate');
  const [error, setError] = useState('');
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [waiting, setWaiting] = useState(false);
  const [nextCandidate, setNextCandidate] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [completedCandidate, setCompletedCandidate] = useState(null);
  const [evaluationForm, setEvaluationForm] = useState(createDefaultEvaluationForm);
  const [evaluationSaving, setEvaluationSaving] = useState(false);
  const [evaluationNotice, setEvaluationNotice] = useState('');

  // ── Cleanup helpers ──
  const cleanupPeer = useCallback(() => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    remoteStreamRef.current = null;
    setPeerConnected(false);
  }, []);

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
  }, []);

  // ── Attach remote stream to video element ──
  const attachRemoteStream = useCallback((stream) => {
    remoteStreamRef.current = stream;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
    setPeerConnected(true);
  }, []);

  // ── Create RTCPeerConnection ──
  const createPeer = useCallback((socketInstance, targetPeerId) => {
    // Close existing connection if any
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketInstance.emit('webrtc:ice-candidate', { to: targetPeerId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        attachRemoteStream(e.streams[0]);
      } else {
        // Fallback: create a new stream from the track
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(e.track);
        attachRemoteStream(remoteStreamRef.current);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setPeerConnected(true);
      }
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setPeerConnected(false);
      }
    };

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pcRef.current = pc;
    return pc;
  }, [attachRemoteStream]);

  // ── Step 1: Fetch room data ──
  useEffect(() => {
    let isMounted = true;
    const initializeRoom = async () => {
      try {
        const roomRes = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}`);
        const roomData = await roomRes.json();
        if (!isMounted) return;
        if (!roomRes.ok) throw new Error(roomData.error || 'Không thể tải phòng phỏng vấn');

        setRoom(roomData.data.room);
        setRole(roomData.data.role);
        setRecordingStatus(roomData.data.room.recording_status || 'idle');

        if (roomData.data.role === 'host') {
          try {
            const hostRes = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}/host-start`, { method: 'PATCH' });
            const hostData = await hostRes.json();
            if (!hostRes.ok) throw new Error(hostData.error || 'Không thể mở phòng HR');
            if (hostRes.ok && isMounted) {
              setRoom((prev) => ({
                ...prev,
                host_joined_at: hostData.data?.host_joined_at || prev?.host_joined_at,
                queue_status: hostData.data?.room_status || prev?.queue_status,
                current_candidate: hostData.data?.current_candidate || prev?.current_candidate,
                application_id: hostData.data?.current_candidate?.application_id || prev?.application_id,
                candidate_name: hostData.data?.current_candidate?.candidate_name || prev?.candidate_name,
                interview_at: hostData.data?.current_candidate?.interview_at || prev?.interview_at,
              }));
            }
          } catch (err) {
            console.error('Mark host joined error:', err);
            if (isMounted) {
              setError(err.message || 'Không thể mở phòng HR');
              setJoining(false);
            }
            return;
          }
          if (isMounted) setJoining(true);
          return;
        }

        if (roomData.data.role === 'candidate') {
          try {
            const confirmRes = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}/confirm`, { method: 'PATCH' });
            const confirmData = await confirmRes.json();
            if (!confirmRes.ok) {
              if (confirmRes.status === 410 && isMounted) {
                setRoom((prev) => prev ? ({ ...prev, queue_status: 'completed', ended_at: new Date().toISOString() }) : prev);
                setWaiting(false);
                setJoining(false);
                return;
              }
              throw new Error(confirmData.error || 'Không thể xác nhận tham gia phỏng vấn');
            }
            if (confirmRes.ok && isMounted) {
              setRoom((prev) => ({ ...prev, ...confirmData.data }));
              setWaiting(confirmData.data.queue_status !== 'in_interview' && confirmData.data.queue_status !== 'completed');
              if (confirmData.data.can_join) setJoining(true);
            }
          } catch (err) {
            console.error('Auto-confirm candidate error:', err);
            setError('Không thể xác nhận tham gia phỏng vấn');
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Không thể tải phòng phỏng vấn');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    initializeRoom();
    return () => { isMounted = false; };
  }, [token]);

  // ── Step 2: WebRTC join ──
  useEffect(() => {
    if (!joining || !room?.id) return undefined;

    let disposed = false;

    const startCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (disposed) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.error('getUserMedia error:', err);
        // Try audio only
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          if (disposed) { stream.getTracks().forEach((t) => t.stop()); return; }
          localStreamRef.current = stream;
          setCamOn(false);
        } catch {
          if (!disposed) setError('Không thể truy cập camera/microphone. Hãy cho phép quyền truy cập.');
          return;
        }
      }

      const socketUrl = import.meta.env.DEV ? 'http://localhost:5001' : (API_BASE_URL.replace(/\/api$/, '') || window.location.origin);
      const sock = io(socketUrl, { withCredentials: true, transports: ['websocket', 'polling'] });
      socketRef.current = sock;

      sock.on('connect', () => {
        sock.emit('webrtc:join-room', room.id);
      });

      // When existing peers are found (we are the late joiner → WE create the offer)
      sock.on('webrtc:existing-peers', ({ peers }) => {
        if (peers.length > 0) {
          const peerId = peers[0];
          const pc = createPeer(sock, peerId);
          pc.createOffer().then((offer) => pc.setLocalDescription(offer)).then(() => {
            sock.emit('webrtc:offer', { to: peerId, offer: pc.localDescription });
          });
        }
      });

      // When a new peer joins (we are the existing peer → WAIT for their offer)
      sock.on('webrtc:peer-joined', () => {
        // Don't create offer here - the new peer will send us one
      });

      sock.on('webrtc:offer', async ({ from, offer }) => {
        const pc = createPeer(sock, from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sock.emit('webrtc:answer', { to: from, answer: pc.localDescription });
      });

      sock.on('webrtc:answer', async ({ answer }) => {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      sock.on('webrtc:ice-candidate', async ({ candidate }) => {
        if (pcRef.current) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
        }
      });

      sock.on('webrtc:peer-left', () => {
        cleanupPeer();
        setPeerConnected(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      });

      sock.on('webrtc:interview-completed', () => {
        cleanupPeer();
        cleanupMedia();
        setJoining(false);
        setWaiting(false);
        setPeerConnected(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setRoom((prev) => prev ? ({ ...prev, queue_status: 'completed', ended_at: new Date().toISOString() }) : prev);
      });
    };

    startCall();

    return () => {
      disposed = true;
      if (socketRef.current) {
        socketRef.current.emit('webrtc:leave-room', room?.id);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      cleanupPeer();
      cleanupMedia();
      setPeerConnected(false);
    };
  }, [joining, room?.id, role, createPeer, cleanupPeer, cleanupMedia]);

  // ── Candidate polling ──
  useEffect(() => {
    if (role !== 'candidate' || !waiting || joining) return undefined;
    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}`);
        const data = await res.json();
        if (res.ok) {
          setRoom(data.data.room);
          const shouldWait = Boolean(data.data.room.confirmed_at) && !data.data.room.can_join && data.data.room.queue_status !== 'completed';
          setWaiting(shouldWait);
          if (data.data.room.can_join && !joining) { setWaiting(false); setJoining(true); }
        } else if (res.status === 410) {
          setWaiting(false);
          setJoining(false);
          setRoom((prev) => prev ? ({ ...prev, queue_status: 'completed', ended_at: new Date().toISOString() }) : prev);
        }
      } catch (err) { console.error('Poll error:', err); }
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [joining, role, token, waiting]);

  // ── Controls ──
  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setMicOn(audioTrack.enabled); }
  };

  const toggleCam = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) { videoTrack.enabled = !videoTrack.enabled; setCamOn(videoTrack.enabled); }
  };

  const toggleScreen = async () => {
    if (screenOn) {
      // Stop screen share, restore camera
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack && pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camTrack);
      }
      setScreenOn(false);
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screen;
      const screenTrack = screen.getVideoTracks()[0];
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = screen;
      screenTrack.onended = () => {
        toggleScreen(); // recursive call to restore camera
      };
      setScreenOn(true);
    } catch (err) { console.error('Screen share error:', err); }
  };

  const handleLeave = () => {
    if (socketRef.current) {
      socketRef.current.emit('webrtc:leave-room', room?.id);
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    cleanupPeer();
    cleanupMedia();
    setJoining(false);
    setPeerConnected(false);
  };

  const handleJoin = () => { setJoining(true); };

  const handleRecording = async (nextStatus) => {
    const res = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}/recording`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recording_status: nextStatus }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setRecordingStatus(data.data?.recording_status || nextStatus);
  };

  const handleCompleteInterview = async () => {
    if (role !== 'host') return;
    const res = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}/complete`, { method: 'PATCH' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 410) {
        handleLeave();
        setNextCandidate(null);
        setRoom((prev) => prev ? ({ ...prev, queue_status: 'completed', ended_at: new Date().toISOString() }) : prev);
        return;
      }
      setError(data.error || 'Không thể hoàn tất lượt phỏng vấn');
      return;
    }
    handleLeave();
    const finishedCandidate = data.data?.completed_candidate || null;
    setCompletedCandidate(finishedCandidate?.application_id ? finishedCandidate : null);
    setEvaluationNotice('');
    setNextCandidate(null);
    setRoom((prev) => ({
      ...prev,
      queue_status: data.data?.room_status || 'completed',
      ended_at: new Date().toISOString(),
    }));
  };

  const handleSaveEvaluation = async () => {
    const applicationId = completedCandidate?.application_id || room?.current_candidate?.application_id || room?.application_id;
    if (!applicationId || evaluationSaving) return;
    setEvaluationSaving(true);
    setEvaluationNotice('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}/applications/${applicationId}/evaluation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evaluationForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu đánh giá phỏng vấn');
      setEvaluationNotice('Đã lưu đánh giá phỏng vấn.');
      setCompletedCandidate((prev) => prev ? ({ ...prev, evaluation_id: data.id, evaluated_at: data.updated_at }) : prev);
    } catch (err) {
      setEvaluationNotice(err.message || 'Không thể lưu đánh giá phỏng vấn');
    } finally {
      setEvaluationSaving(false);
    }
  };

  const interviewCompleted = room?.queue_status === 'completed' || Boolean(room?.ended_at);

  // ── Render ──
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a0e1a] via-[#0d1225] to-[#080c18] text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-400 font-medium">Đang tải phòng phỏng vấn...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a0e1a] via-[#0d1225] to-[#080c18] px-4 text-white">
        <div className="max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center"><VideoOff className="h-6 w-6 text-rose-400" /></div>
          <p className="font-semibold text-white/90">{error || 'Phòng phỏng vấn không tồn tại'}</p>
          <Link to="/" className="mt-5 inline-flex rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all">
            Quay lại
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-[#0a0e1a] via-[#0d1225] to-[#080c18] text-white relative">
      <div className="fixed inset-0 pointer-events-none z-0"><div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/[0.06] rounded-full blur-[120px]" /><div className="absolute bottom-0 right-1/3 w-80 h-80 bg-purple-500/[0.04] rounded-full blur-[100px]" /></div>
      <div className={`relative z-10 flex min-h-screen flex-col overflow-x-hidden ${joining ? 'mx-0 px-0 py-0' : 'mx-auto max-w-7xl px-4 py-6'}`}>
        {/* Header - not in call */}
        {!joining && (
          <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link to={role === 'host' ? '/employer/dashboard?tab=meeting-rooms' : '/seeker/applied-jobs'} className="mb-3 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </Link>
              <h1 className="text-2xl font-bold text-white/95 tracking-tight">{room.job_title || room.name}</h1>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-indigo-400" />
                  {formatDateTime(room.interview_at || room.start_time)}
                </span>
                <span className="text-slate-500">•</span>
                <span>{room.company_name || 'AptertekWork'}</span>
                {room.candidate_name ? <><span className="text-slate-500">•</span><span>Ứng viên: {room.candidate_name}</span></> : null}
              </div>
            </div>
          </header>
        )}

        {joining && (
          <header className="border-b border-white/[0.06] backdrop-blur-xl bg-white/[0.02] px-5 py-3">
            {/* Row 1: Room info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
                  <Video className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-white/95 truncate">{room.job_title || room.name}</h1>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <CalendarClock className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{formatDateTime(room.interview_at || room.start_time)}</span>
                    {room.company_name && <><span className="text-slate-600">•</span><span className="truncate">{room.company_name}</span></>}
                    {room.candidate_name && <><span className="text-slate-600">•</span><span className="truncate text-slate-300">UV: {room.candidate_name}</span></>}
                  </div>
                </div>
              </div>
              <span className={`ml-3 flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border ${
                peerConnected
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/20'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${peerConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                {peerConnected ? 'Đã kết nối' : 'Chờ đối phương...'}
              </span>
            </div>
            {/* Row 2: Host controls */}
            {role === 'host' && (
              <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-white/[0.05]">
                <button type="button" onClick={() => handleRecording('recording')} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 border border-rose-500/25 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition-all">
                  <Mic className="h-3 w-3" /> Ghi hình
                </button>
                <button type="button" onClick={() => handleRecording('stored')} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1] px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/[0.1] transition-all">
                  Dừng ghi
                </button>
                <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  recordingStatus === 'recording'
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    : 'border-white/[0.08] bg-white/[0.04] text-slate-500'
                }`}>
                  {recordingStatus === 'recording' && <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />}
                  {recordingStatus === 'recording' ? 'Đang ghi' : 'Sẵn sàng'}
                </span>
                <div className="flex-1" />
                <button type="button" onClick={handleCompleteInterview} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 text-xs font-semibold text-white hover:shadow-lg hover:shadow-emerald-500/20 transition-all">
                  <CheckCircle2 className="h-3 w-3" /> Kết thúc & đóng phòng
                </button>
              </div>
            )}
          </header>
        )}

        <main className={`flex flex-1 flex-col ${joining ? 'py-0' : 'py-5'}`}>
          {!joining ? (
            <div className={`mx-auto flex w-full flex-1 items-center ${completedCandidate ? 'max-w-4xl' : 'max-w-xl'}`}>
              <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-8 shadow-2xl">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/20">
                  <Video className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-white/95">
                  {completedCandidate ? 'Đánh giá ứng viên vừa phỏng vấn' : interviewCompleted ? 'Lượt phỏng vấn đã hoàn tất' : waiting ? 'Bạn đang ở phòng chờ' : nextCandidate ? 'Đã gọi ứng viên tiếp theo' : 'Phòng phỏng vấn trực tuyến'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {completedCandidate
                    ? 'Lưu phiếu đánh giá ngay tại đây. Phòng đã được đóng, link tham gia không còn hiệu lực.'
                    : interviewCompleted
                    ? 'Cảm ơn bạn đã tham gia. Camera và microphone đã được tắt cho lượt phỏng vấn này.'
                    : waiting
                    ? `Bạn đang xếp hàng chờ. Vị trí hiện tại: ${room.queue_position || 'đang cập nhật'}. Nhà tuyển dụng sẽ gọi bạn vào lượt.`
                    : nextCandidate
                      ? `${nextCandidate.candidate_name || 'Ứng viên tiếp theo'} đã được chuyển vào lượt phỏng vấn.`
                      : role === 'candidate'
                    ? 'Bạn đã được xác nhận. Chờ nhà tuyển dụng gọi vào.'
                    : 'Bạn đã vào phòng HR. Bắt đầu phỏng vấn khi sẵn sàng.'}
                </p>
                {waiting ? (
                  <div className="mt-6 rounded-xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-3 text-sm text-indigo-200">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                      <span>Trang sẽ tự cập nhật mỗi vài giây. Bạn có thể giữ tab này mở.</span>
                    </div>
                  </div>
                ) : nextCandidate && !completedCandidate && !interviewCompleted ? (
                  <button type="button" onClick={() => { setCompletedCandidate(null); setNextCandidate(null); setEvaluationForm(createDefaultEvaluationForm()); setEvaluationNotice(''); setJoining(true); }} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-emerald-500/25">
                    <UserCheck className="h-4 w-4" /> Vào lượt tiếp theo
                  </button>
                ) : role === 'host' && !interviewCompleted ? (
                  <button type="button" onClick={handleJoin} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-indigo-500/25">
                    <Video className="h-4 w-4" /> Vào phòng HR
                  </button>
                ) : null}

                {role === 'host' && completedCandidate?.application_id ? (
                  <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
                          <ClipboardCheck className="h-4 w-4" /> Phiếu đánh giá sau phỏng vấn
                        </div>
                        <h3 className="mt-3 text-xl font-black text-white">{completedCandidate.candidate_name || 'Ứng viên vừa phỏng vấn'}</h3>
                        <p className="mt-1 text-sm text-slate-300">{completedCandidate.job_title || room.job_title || room.name}</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-3 py-2 text-sm font-bold text-indigo-100">
                        <Star className="h-4 w-4 text-indigo-300" />
                        {getAverageRating(evaluationForm.ratings)}/5
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {RATING_FIELDS.map((field) => (
                        <RatingInput
                          key={field.key}
                          label={field.label}
                          value={evaluationForm.ratings[field.key]}
                          onChange={(value) => setEvaluationForm((prev) => ({ ...prev, ratings: { ...prev.ratings, [field.key]: value } }))}
                        />
                      ))}
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-200">Điểm mạnh nội bộ</span>
                        <textarea
                          value={evaluationForm.strengths}
                          onChange={(event) => setEvaluationForm((prev) => ({ ...prev, strengths: event.target.value }))}
                          rows={4}
                          className="mt-2 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="Ví dụ: nắm quy trình test, giao tiếp rõ..."
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-200">Rủi ro cần làm rõ</span>
                        <textarea
                          value={evaluationForm.concerns}
                          onChange={(event) => setEvaluationForm((prev) => ({ ...prev, concerns: event.target.value }))}
                          rows={4}
                          className="mt-2 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="Ví dụ: cần kiểm tra thêm kinh nghiệm thực tế..."
                        />
                      </label>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-200">Kết luận</span>
                        <select
                          value={evaluationForm.recommendation}
                          onChange={(event) => setEvaluationForm((prev) => ({ ...prev, recommendation: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-white/[0.1] bg-[#101528] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                        >
                          {Object.entries(RECOMMENDATION_LABELS).map(([value, label]) => (
                            <option key={value} value={value} className="bg-[#101528] text-white">{label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-200">Phản hồi gửi ứng viên</span>
                        <textarea
                          value={evaluationForm.feedback_to_candidate}
                          onChange={(event) => setEvaluationForm((prev) => ({ ...prev, feedback_to_candidate: event.target.value }))}
                          rows={3}
                          className="mt-2 w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="Nội dung có thể gửi cho ứng viên sau phỏng vấn..."
                        />
                      </label>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className={`text-sm ${evaluationNotice.startsWith('Đã') ? 'text-emerald-200' : 'text-amber-200'}`}>
                        {evaluationNotice || 'Lưu phiếu này để hoàn tất ghi chú nội bộ sau phỏng vấn.'}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        {nextCandidate && !interviewCompleted ? (
                          <button type="button" onClick={() => { setCompletedCandidate(null); setNextCandidate(null); setEvaluationForm(createDefaultEvaluationForm()); setEvaluationNotice(''); setJoining(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.08] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.14]">
                            <UserCheck className="h-4 w-4" /> Vào lượt tiếp theo
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleSaveEvaluation}
                          disabled={evaluationSaving}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-bold text-white transition hover:shadow-lg hover:shadow-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {evaluationSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Lưu đánh giá
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            /* ── Video call UI ── */
            <div className="relative flex flex-1 flex-col">
              <div className="relative flex flex-1 items-center justify-center bg-black/20 p-3">
                <div className="relative flex h-full w-full items-center justify-center">
                  <div className="relative h-full w-full max-h-[calc(100vh-140px)] overflow-hidden rounded-2xl bg-[#0d1225] border border-white/[0.06]">
                    <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                    {!peerConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#0d1225]/95">
                      {/* Animated pulse rings */}
                      <div className="relative flex items-center justify-center">
                        <div className="absolute h-20 w-20 rounded-full bg-indigo-500/10 animate-ping" />
                        <div className="absolute h-14 w-14 rounded-full bg-indigo-500/15 animate-ping" style={{ animationDelay: '0.3s' }} />
                        <div className="h-12 w-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-semibold text-white/80">Đang chờ đối phương tham gia</p>
                        <p className="mt-1 text-xs text-slate-500">Micro và camera của bạn đang bật — đối phương sẽ kết nối tự động</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs text-amber-300 font-medium">Giữ tab này mở để kết nối ngay khi đối phương vào</span>
                      </div>
                    </div>
                  )}
                  </div>
                  <div className="absolute bottom-6 right-6 h-36 w-48 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d1225] shadow-2xl">
                    <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                    {!camOn && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#0d1225]">
                        <VideoOff className="h-6 w-6 text-slate-600" />
                      </div>
                    )}
                    <div className="absolute bottom-1.5 left-2 text-[10px] text-white/50 font-medium">Bạn</div>
                  </div>
                </div>
                {role === 'host' ? (
                  <FloatingEvaluationWidget
                    room={room}
                    form={evaluationForm}
                    setForm={setEvaluationForm}
                    onSave={handleSaveEvaluation}
                    saving={evaluationSaving}
                    notice={evaluationNotice}
                  />
                ) : null}
              </div>

              <div className="flex items-center justify-center gap-3 border-t border-white/[0.06] backdrop-blur-xl bg-white/[0.02] px-4 py-4">
                <button type="button" onClick={toggleMic} className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${micOn ? 'bg-white/[0.08] border border-white/[0.1] hover:bg-white/[0.12]' : 'bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30'}`} title={micOn ? 'Tắt mic' : 'Bật mic'}>
                  {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>
                <button type="button" onClick={toggleCam} className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${camOn ? 'bg-white/[0.08] border border-white/[0.1] hover:bg-white/[0.12]' : 'bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30'}`} title={camOn ? 'Tắt camera' : 'Bật camera'}>
                  {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>
                <button type="button" onClick={toggleScreen} className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${screenOn ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30' : 'bg-white/[0.08] border border-white/[0.1] hover:bg-white/[0.12]'}`} title={screenOn ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}>
                  {screenOn ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                </button>
                <div className="w-px h-8 bg-white/[0.08] mx-1" />
                <button type="button" onClick={role === 'host' ? handleCompleteInterview : handleLeave} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 transition-all hover:shadow-lg hover:shadow-rose-500/25 hover:scale-105" title={role === 'host' ? 'Kết thúc và đóng phòng' : 'Rời phòng'}>
                  <PhoneOff className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
