import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CheckCircle2, Loader2, Mic, UserCheck, Users, Video } from 'lucide-react';
import API_BASE_URL from '@shared/api/baseUrl';

function formatDateTime(value) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function loadJitsiScript() {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-jitsi-api="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.dataset.jitsiApi = 'true';
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export default function InterviewRoomPage() {
  const { token } = useParams();
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState('candidate');
  const [error, setError] = useState('');
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [waiting, setWaiting] = useState(false);
  const [nextCandidate, setNextCandidate] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const initializeRoom = async () => {
      try {
        // Step 1: Fetch room data
        const roomRes = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}`);
        const roomData = await roomRes.json();
        
        if (!isMounted) return;
        if (!roomRes.ok) throw new Error(roomData.error || 'Không thể tải phòng phỏng vấn');
        
        setRoom(roomData.data.room);
        setRole(roomData.data.role);
        setRecordingStatus(roomData.data.room.recording_status || 'idle');
        
        // Step 2: Handle host flow
        if (roomData.data.role === 'host') {
          try {
            // Mark host joined and admit first candidate
            const hostRes = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}/host-start`, {
              method: 'PATCH',
            });
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
          } catch (err) {
            console.error('Mark host joined error:', err);
          }
          // Auto join jitsi for host
          if (isMounted) setJoining(true);
          return;
        }
        
        // Step 3: Handle candidate flow
        if (roomData.data.role === 'candidate') {
          try {
            // Auto-confirm candidate
            const confirmRes = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}/confirm`, {
              method: 'PATCH',
            });
            const confirmData = await confirmRes.json();
            if (confirmRes.ok && isMounted) {
              setRoom((prev) => ({ ...prev, ...confirmData.data }));
              setWaiting(
                confirmData.data.queue_status !== 'in_interview'
                && confirmData.data.queue_status !== 'completed'
              );
              // If can join immediately, auto join
              if (confirmData.data.can_join) {
                setJoining(true);
              }
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

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!joining || !room?.jitsi_room_id || !containerRef.current) return undefined;

    let disposed = false;

    loadJitsiScript()
      .then(() => {
        if (disposed || !containerRef.current || apiRef.current) return;

        apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName: room.jitsi_room_id,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName: role === 'host' ? 'HR' : room.candidate_name || 'Ứng viên',
          },
          configOverwrite: {
            prejoinPageEnabled: false,
            prejoinConfig: { enabled: false },
            disableDeepLinking: true,
            startWithAudioMuted: role !== 'host',
            startWithVideoMuted: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_BRAND_WATERMARK: false,
          },
        });

        const iframe = containerRef.current.querySelector('iframe');
        if (iframe) {
          Object.assign(iframe.style, {
            display: 'block',
            width: '100%',
            height: '100%',
            border: '0',
          });
        }

        apiRef.current.addListener('videoConferenceJoined', () => {
          // Host already marked as ready on page load
        });
      })
      .catch(() => setError('Không thể tải Jitsi SDK'));

    return () => {
      disposed = true;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [joining, room, role]);

  useEffect(() => {
    if (role !== 'candidate' || !waiting || joining) return undefined;

    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}`);
        const data = await res.json();
        if (res.ok) {
          setRoom(data.data.room);
          const shouldWait = Boolean(data.data.room.confirmed_at)
            && !data.data.room.can_join
            && data.data.room.queue_status !== 'completed';
          setWaiting(shouldWait);
          
          // Auto-join when candidate is admitted
          if (data.data.room.can_join && !joining) {
            setWaiting(false);
            setJoining(true);
          }
        }
      } catch (err) {
        console.error('Poll interview room status error:', err);
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [joining, role, token, waiting]);

  const handleJoin = () => {
    setJoining(true);
  };

  const handleRecording = async (nextStatus) => {
    if (!apiRef.current || role !== 'host') return;

    try {
      if (nextStatus === 'recording') {
        apiRef.current.executeCommand('startRecording', { mode: 'file' });
      } else {
        apiRef.current.executeCommand('stopRecording', { mode: 'file' });
      }
    } catch (err) {
      console.error('Jitsi recording command error:', err);
    }

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

    const res = await fetch(`${API_BASE_URL}/api/meeting-rooms/access/${token}/complete`, {
      method: 'PATCH',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Không thể hoàn tất lượt phỏng vấn');
      return;
    }

    if (apiRef.current) {
      apiRef.current.dispose();
      apiRef.current = null;
    }
    setJoining(false);
    const admittedCandidate = data.data?.next_candidate || null;
    setNextCandidate(admittedCandidate);
    setRoom((prev) => ({
      ...prev,
      queue_status: data.data?.room_status || (admittedCandidate ? 'in_interview' : 'completed'),
      candidate_name: admittedCandidate?.candidate_name || prev?.candidate_name,
      interview_at: admittedCandidate?.interview_at || prev?.interview_at,
      ended_at: data.data?.room_status === 'completed' ? new Date().toISOString() : prev?.ended_at,
    }));
  };

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
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/10 p-6 text-center">
          <p className="font-semibold">{error || 'Phòng phỏng vấn không tồn tại'}</p>
          <Link to="/" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">
            Quay lại
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className={`flex min-h-screen flex-col ${joining ? 'mx-0 px-0 py-0' : 'mx-auto max-w-7xl px-4 py-5'}`}>
        {!joining && (
          <header className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link to={role === 'host' ? '/employer/meeting-rooms' : '/seeker/applied-jobs'} className="mb-3 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
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

        {joining && (
          <header className="flex flex-col gap-4 border-b border-white/10 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
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

            {role === 'host' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRecording('recording')}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700"
                >
                  <Mic className="h-4 w-4" />
                  Ghi hình
                </button>
                <button
                  type="button"
                  onClick={() => handleRecording('stored')}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Dừng ghi
                </button>
                <span className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300">
                  {recordingStatus === 'recording' ? 'Đang ghi' : 'Sẵn sàng'}
                </span>
                <button
                  type="button"
                  onClick={handleCompleteInterview}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Hoàn tất lượt
                </button>
              </div>
            ) : null}
          </header>
        )}

        <main className={`flex flex-1 flex-col ${joining ? 'py-0' : 'py-5'}`}>
          {!joining ? (
            <div className="mx-auto flex w-full max-w-xl flex-1 items-center">
              <div className="w-full rounded-3xl border border-white/10 bg-white/10 p-7 shadow-2xl">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
                  <Video className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold">
                  {waiting ? 'Bạn đang ở phòng chờ' : nextCandidate ? 'Đã gọi ứng viên tiếp theo' : 'Phòng phỏng vấn trực tuyến'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {waiting
                    ? `Bạn đang xếp hàng chờ. Vị trí hiện tại: ${room.queue_position || 'đang cập nhật'}. Nhà tuyển dụng sẽ gọi bạn vào lượt.`
                    : nextCandidate
                      ? `${nextCandidate.candidate_name || 'Ứng viên tiếp theo'} đã được chuyển vào lượt phỏng vấn.`
                      : role === 'candidate'
                    ? 'Bạn đã được xác nhận. Chờ nhà tuyển dụng gọi vào.'
                    : 'Bạn đã vào phòng HR. Bắt đầu phỏng vấn khi sẵn sàng.'}
                </p>
                {waiting ? (
                  <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Trang sẽ tự cập nhật mỗi vài giây. Bạn có thể giữ tab này mở.</span>
                    </div>
                  </div>
                ) : nextCandidate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNextCandidate(null);
                      setJoining(true);
                    }}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                  >
                    <UserCheck className="h-4 w-4" />
                    Vào lượt tiếp theo
                  </button>
                ) : role === 'host' ? (
                  <button
                    type="button"
                    onClick={handleJoin}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                  >
                    <Video className="h-4 w-4" />
                    Vào phòng HR
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="h-[calc(100vh-86px)] w-full overflow-hidden bg-black">
              <div ref={containerRef} className="h-full w-full" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
