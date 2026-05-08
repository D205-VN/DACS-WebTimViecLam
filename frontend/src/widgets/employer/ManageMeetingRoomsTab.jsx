import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@features/auth/AuthContext';
import { Plus, Edit2, Trash2, Video, CheckCircle2, X, Link2, ExternalLink, Loader2, CalendarClock, UserRound, Users } from 'lucide-react';
import API_BASE_URL from '@shared/api/baseUrl';
import { cachedJsonFetch, clearRequestCache, readCachedJson } from '@shared/api/requestCache';

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getQueueStatus(room) {
  const candidates = Array.isArray(room.candidates) ? room.candidates : [];
  if (room.queue_status === 'completed' || (candidates.length > 0 && candidates.every((candidate) => candidate.queue_status === 'completed' || candidate.ended_at))) {
    return { label: 'Hoàn tất', className: 'bg-slate-100 text-slate-600' };
  }
  if (room.queue_status === 'in_interview') {
    return { label: 'Đang phỏng vấn', className: 'bg-emerald-50 text-emerald-700' };
  }
  if (room.queue_status === 'waiting') {
    return {
      label: room.queue_position ? `Đang chờ #${room.queue_position}` : 'Đang chờ',
      className: 'bg-cyan-50 text-cyan-700',
    };
  }
  if (room.application_id) {
    return { label: 'Chờ check-in', className: 'bg-amber-50 text-amber-700' };
  }
  return null;
}

function getCandidateQueueStatus(candidate) {
  if (candidate.queue_status === 'completed' || candidate.ended_at) {
    return { label: 'Đã phỏng vấn', className: 'bg-slate-100 text-slate-600' };
  }
  if (candidate.queue_status === 'in_interview') {
    return { label: 'Đang phỏng vấn', className: 'bg-emerald-50 text-emerald-700' };
  }
  if (candidate.queue_status === 'waiting') {
    return {
      label: candidate.queue_position ? `Đang chờ #${candidate.queue_position}` : 'Đang chờ',
      className: 'bg-cyan-50 text-cyan-700',
    };
  }
  return { label: 'Chưa vào chờ', className: 'bg-amber-50 text-amber-700' };
}

export default function ManageMeetingRoomsTab() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    capacity: '',
    meeting_link: '',
    description: '',
  });
  const selectedRoomId = searchParams.get('room');
  const visibleRooms = selectedRoomId
    ? [...rooms].sort((a, b) => (String(a.id) === selectedRoomId ? -1 : String(b.id) === selectedRoomId ? 1 : 0))
    : rooms;

  const fetchRooms = useCallback(async () => {
    try {
      const requestOptions = { headers: { Authorization: `Bearer ${token}` } };
      const cached = readCachedJson(`${API_BASE_URL}/api/meeting-rooms`, requestOptions);

      if (cached) {
        setRooms(Array.isArray(cached) ? cached : cached.data || []);
        setLoading(false);
        setError('');
      }

      const data = await cachedJsonFetch(`${API_BASE_URL}/api/meeting-rooms`, requestOptions, { ttlMs: 30 * 1000 });
      setRooms(Array.isArray(data) ? data : data.data || []);
      setError('');
    } catch (error) {
      console.error('Error fetching meeting rooms:', error);
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetchRooms();
  }, [token, fetchRooms]);

  const resetModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
    setFormData({
      name: '',
      location: '',
      capacity: '',
      meeting_link: '',
      description: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const method = editingRoom ? 'PUT' : 'POST';
      const url = editingRoom ? `${API_BASE_URL}/api/meeting-rooms/${editingRoom.id}` : `${API_BASE_URL}/api/meeting-rooms`;
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        clearRequestCache((key) => key.includes('/api/meeting-rooms') || key.includes('/api/employer'));
        await fetchRooms();
        resetModal();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || data.message || 'Có lỗi xảy ra khi lưu phòng Meet');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phòng này?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/meeting-rooms/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        clearRequestCache((key) => key.includes('/api/meeting-rooms') || key.includes('/api/employer'));
        await fetchRooms();
      }
    } catch (error) {
      console.error('Delete error', error);
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></div>;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm p-6">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-t-2xl"></div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200/60">
            <Video className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Quản lý phòng Meet</h2>
            <p className="text-xs text-gray-500">Phòng online được gộp theo cùng tin tuyển dụng và cùng ngày phỏng vấn.</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 bg-indigo-50/30 rounded-2xl border border-dashed border-indigo-100/60">
            <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Chưa có phòng Meet nào được tạo.</p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {visibleRooms.map((room) => {
              const isSelectedRoom = selectedRoomId && String(room.id) === selectedRoomId;
              const queueStatus = getQueueStatus(room);
              const candidates = Array.isArray(room.candidates) ? room.candidates : [];
              const activeCandidate = candidates.find((candidate) => candidate.queue_status === 'in_interview');
              const waitingCount = candidates.filter((candidate) => candidate.queue_status === 'waiting').length;
              const isAutoRoom = Boolean(room.job_id);

              return (
              <article
                key={room.id}
                className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-50 ${
                  isSelectedRoom ? 'border-indigo-300 ring-2 ring-violet-200' : 'border-indigo-100/60 hover:border-indigo-200'
                }`}
              >
                <div className={`absolute left-0 right-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${isSelectedRoom ? 'from-violet-500 to-purple-500' : 'from-indigo-400 to-violet-400'}`}></div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 leading-tight">{room.room_job_title || room.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{room.name}</p>
                      <p className="mt-1 text-xs font-semibold text-indigo-600">{room.location || 'Online'}</p>
                    </div>
                  </div>
                  
                  {!isAutoRoom ? (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => { setEditingRoom(room); setFormData(room); setIsModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(room.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 bg-gradient-to-r from-indigo-50 to-violet-50 text-gray-700 text-xs font-semibold rounded-full">
                      <Users className="mr-1 inline h-3.5 w-3.5" />
                      {candidates.length || room.candidate_count || 0} ứng viên
                    </span>
                    {isAutoRoom ? (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">
                        Gộp theo tin/ngày
                      </span>
                    ) : null}
                    {queueStatus ? (
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${queueStatus.className}`}>
                        {queueStatus.label}
                      </span>
                    ) : null}
                  </div>
                  {room.first_schedule_time || room.start_time ? (
                    <div className="mb-3 flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
                      <CalendarClock className="h-4 w-4" />
                      {formatDateTime(room.first_schedule_time || room.start_time)}
                    </div>
                  ) : null}
                  {activeCandidate ? (
                    <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <span className="font-semibold">Đang phỏng vấn:</span> {activeCandidate.candidate_name || 'Ứng viên'}
                    </div>
                  ) : waitingCount > 0 ? (
                    <div className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">
                      <span className="font-semibold">{waitingCount}</span> ứng viên đang ở phòng chờ.
                    </div>
                  ) : null}

                  {candidates.length > 0 ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-indigo-100/60">
                      <div className="grid grid-cols-[1fr_auto] bg-indigo-50/50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                        <span>Ứng viên</span>
                        <span>Trạng thái</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {candidates.map((candidate) => {
                          const status = getCandidateQueueStatus(candidate);
                          return (
                            <div key={candidate.schedule_id || candidate.application_id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-3">
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 truncate text-sm font-semibold text-gray-800">
                                  <UserRound className="h-4 w-4 shrink-0 text-gray-400" />
                                  {candidate.candidate_name || 'Ứng viên'}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-gray-500">
                                  {formatDateTime(candidate.interview_at || candidate.start_time)}
                                </p>
                              </div>
                              <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                                {status.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">{room.description}</p>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-indigo-50 pt-4">
                  <div className="text-xs text-gray-400">
                    Cập nhật lúc {formatDateTime(room.updated_at || room.created_at)}
                  </div>

                  {room.host_token || room.meeting_link ? (
                    <a
                      href={room.host_token ? `/interview-room/${room.host_token}` : room.meeting_link}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Vào phòng HR
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                      <Link2 className="w-4 h-4" />
                      Chưa có link
                    </span>
                  )}
                </div>
              </article>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl shadow-indigo-100/40 border border-indigo-100/60">
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-t-2xl"></div>
              <div className="flex items-center justify-between border-b border-indigo-50 px-6 py-5 pt-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {editingRoom ? 'Chỉnh sửa phòng Meet' : 'Tạo phòng Meet mới'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Quản lý thông tin phòng họp và link họp trực tuyến cho doanh nghiệp.
                </p>
              </div>
              <button onClick={resetModal} className="rounded-full p-2 text-gray-400 hover:bg-indigo-50 transition-colors">
                <X className="w-5 h-5" />
              </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Tên phòng</label>
                  <input type="text" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full rounded-xl border border-indigo-100/60 px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-200" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Địa điểm / Hình thức</label>
                  <input type="text" value={formData.location || ''} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full rounded-xl border border-indigo-100/60 px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-200" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Sức chứa</label>
                  <input type="number" value={formData.capacity || ''} onChange={(e) => setFormData({...formData, capacity: e.target.value})} className="w-full rounded-xl border border-indigo-100/60 px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-200" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Link meeting (Meet, Zoom, ...)</label>
                  <input type="text" value={formData.meeting_link || ''} onChange={(e) => setFormData({...formData, meeting_link: e.target.value})} className="w-full rounded-xl border border-indigo-100/60 px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-200" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Mô tả chi tiết</label>
                  <textarea value={formData.description || ''} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full rounded-xl border border-indigo-100/60 px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-200 min-h-[100px]" />
                </div>
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 border-t border-indigo-50 px-6 py-5">
              <button type="button" onClick={resetModal} className="rounded-xl border border-indigo-100/60 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-indigo-50 transition-colors">
                Hủy
              </button>
              <button type="submit" onClick={handleSubmit} disabled={actionLoading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all disabled:opacity-70">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {editingRoom ? 'Lưu thay đổi' : 'Tạo phòng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
