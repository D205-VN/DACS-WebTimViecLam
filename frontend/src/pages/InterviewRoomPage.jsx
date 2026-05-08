import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CheckCircle2, Loader2, Mic, MicOff, Monitor, MonitorOff, UserCheck, Video, VideoOff, PhoneOff } from 'lucide-react';
import { io } from 'socket.io-client';
import API_BASE_URL from '@shared/api/baseUrl';

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

  // ── Cleanup helpers ──
  const cleanupPeer = useCallback(() => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
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
      console.log('ontrack fired, streams:', e.streams.length, 'track kind:', e.track.kind);
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
      console.log('ICE state:', pc.iceConnectionState);
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
            if (hostRes.ok && isMounted) {
              setRoom((prev) => ({
                ...prev,
                host_joined_at: hostData.data?.host_joined_at || prev?.host_joined_at,
                queue_status: hostData.data?.room_status || prev?.queue_status,
                current_candidate: hostData.data?.current_candidate || prev?.current_candidate,
                candidate_name: hostData.data?.current_candidate?.candidate_name || prev?.candidate_name,
                interview_at: hostData.data?.current_candidate?.interview_at || prev?.interview_at,
              }));
            }
          } catch (err) { console.error('Mark host joined error:', err); }
          if (isMounted) setJoining(true);
          return;
        }

        if (roomData.data.role === 'candidate') {
          try {
            const confirmRes = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}/confirm`, { method: 'PATCH' });
            const confirmData = await confirmRes.json();
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
          console.log('Found existing peer, creating offer to:', peerId);
          const pc = createPeer(sock, peerId);
          pc.createOffer().then((offer) => pc.setLocalDescription(offer)).then(() => {
            sock.emit('webrtc:offer', { to: peerId, offer: pc.localDescription });
          });
        }
      });

      // When a new peer joins (we are the existing peer → WAIT for their offer)
      sock.on('webrtc:peer-joined', ({ peerId }) => {
        console.log('New peer joined, waiting for their offer:', peerId);
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
        if (role === 'candidate') {
          cleanupPeer();
          cleanupMedia();
          setJoining(false);
          setWaiting(false);
          setPeerConnected(false);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          setRoom((prev) => prev ? ({ ...prev, queue_status: 'completed', ended_at: new Date().toISOString() }) : prev);
        }
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
    if (!res.ok) { setError(data.error || 'Không thể hoàn tất lượt phỏng vấn'); return; }
    handleLeave();
    const admittedCandidate = data.data?.next_candidate || null;
    setNextCandidate(admittedCandidate);
    setRoom((prev) => ({
      ...prev,
      queue_status: data.data?.room_status || (admittedCandidate ? 'in_interview' : 'completed'),
      candidate_name: admittedCandidate?.candidate_name || prev?.candidate_name,
      interview_at: admittedCandidate?.interview_at || prev?.interview_at,
      ended_at: data.data?.room_status === 'completed' ? new Date().toISOString() : prev?.ended_at,
    }));
    // Auto-rejoin if there's a next candidate
    if (admittedCandidate) {
      setTimeout(() => {
        setNextCandidate(null);
        setJoining(true);
      }, 1500);
    }
  };

  const interviewCompleted = room?.queue_status === 'completed' || Boolean(room?.ended_at);

  // ── Render ──
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="max-w-md rounded-lg border border-white/10 bg-white/10 p-6 text-center">
          <p className="font-semibold">{error || 'Phòng phỏng vấn không tồn tại'}</p>
          <Link to="/" className="mt-4 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900">
            Quay lại
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className={`flex min-h-screen flex-col ${joining ? 'mx-0 px-0 py-0' : 'mx-auto max-w-7xl px-4 py-5'}`}>
        {/* Header - not in call */}
        {!joining && (
          <header className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link to={role === 'host' ? '/employer/dashboard?tab=meeting-rooms' : '/seeker/applied-jobs'} className="mb-3 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </Link>
              <h1 className="text-2xl font-bold">{room.job_title || room.name}</h1>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4" />
                  {formatDateTime(room.interview_at || room.start_time)}
                </span>
                <span>{room.company_name || 'AptertekWork'}</span>
                {room.candidate_name ? <span>Ứng viên: {room.candidate_name}</span> : null}
              </div>
            </div>
          </header>
        )}

        {/* Header - in call */}
        {joining && (
          <header className="flex flex-col gap-4 border-b border-white/10 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-lg font-bold">{room.job_title || room.name}</h1>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDateTime(room.interview_at || room.start_time)}
                </span>
                <span>{room.company_name || 'AptertekWork'}</span>
                {room.candidate_name ? <span>Ứng viên: {room.candidate_name}</span> : null}
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${peerConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${peerConnected ? 'bg-emerald-400' : 'bg-yellow-400 animate-pulse'}`} />
                  {peerConnected ? 'Đã kết nối' : 'Chờ đối phương...'}
                </span>
              </div>
            </div>
            {role === 'host' && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleRecording('recording')} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-700">
                  <Mic className="h-3.5 w-3.5" /> Ghi hình
                </button>
                <button type="button" onClick={() => handleRecording('stored')} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                  Dừng ghi
                </button>
                <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300">
                  {recordingStatus === 'recording' ? 'Đang ghi' : 'Sẵn sàng'}
                </span>
                <button type="button" onClick={handleCompleteInterview} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Hoàn tất lượt
                </button>
              </div>
            )}
          </header>
        )}

        <main className={`flex flex-1 flex-col ${joining ? 'py-0' : 'py-5'}`}>
          {!joining ? (
            <div className="mx-auto flex w-full max-w-xl flex-1 items-center">
              <div className="w-full rounded-lg border border-white/10 bg-white/10 p-7 shadow-lg">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-cyan-400/20 text-cyan-200">
                  <Video className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold">
                  {interviewCompleted ? 'Lượt phỏng vấn đã hoàn tất' : waiting ? 'Bạn đang ở phòng chờ' : nextCandidate ? 'Đã gọi ứng viên tiếp theo' : 'Phòng phỏng vấn trực tuyến'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {interviewCompleted
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
                  <div className="mt-6 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Trang sẽ tự cập nhật mỗi vài giây. Bạn có thể giữ tab này mở.</span>
                    </div>
                  </div>
                ) : nextCandidate ? (
                  <button type="button" onClick={() => { setNextCandidate(null); setJoining(true); }} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300">
                    <UserCheck className="h-4 w-4" /> Vào lượt tiếp theo
                  </button>
                ) : role === 'host' ? (
                  <button type="button" onClick={handleJoin} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">
                    <Video className="h-4 w-4" /> Vào phòng HR
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            /* ── Video call UI ── */
            <div className="relative flex flex-1 flex-col">
              {/* Video area */}
              <div className="relative flex flex-1 items-center justify-center bg-slate-900 p-2">
                {/* Remote video (main) */}
                <div className="relative h-full w-full max-h-[calc(100vh-140px)] overflow-hidden rounded-lg bg-slate-800">
                  <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  {!peerConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800/90">
                      <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
                      <p className="text-sm text-slate-300">Đang chờ đối phương tham gia...</p>
                    </div>
                  )}
                </div>
                {/* Local video (picture-in-picture) */}
                <div className="absolute bottom-4 right-4 h-36 w-48 overflow-hidden rounded-lg border-2 border-white/20 bg-slate-800 shadow-lg">
                  <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  {!camOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                      <VideoOff className="h-6 w-6 text-slate-500" />
                    </div>
                  )}
                </div>
              </div>

              {/* Control bar */}
              <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-slate-950 px-4 py-3">
                <button type="button" onClick={toggleMic} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${micOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-600 hover:bg-gradient-to-r from-rose-500 to-pink-500'}`} title={micOn ? 'Tắt mic' : 'Bật mic'}>
                  {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>
                <button type="button" onClick={toggleCam} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${camOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-600 hover:bg-gradient-to-r from-rose-500 to-pink-500'}`} title={camOn ? 'Tắt camera' : 'Bật camera'}>
                  {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>
                <button type="button" onClick={toggleScreen} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${screenOn ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={screenOn ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}>
                  {screenOn ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                </button>
                <button type="button" onClick={handleLeave} className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 transition hover:bg-gradient-to-r from-rose-500 to-pink-500" title="Rời phòng">
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
