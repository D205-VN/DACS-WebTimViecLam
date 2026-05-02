import { useState, useEffect } from 'react';
import { useAuth } from '@features/auth/AuthContext';
import { Plus, Edit2, Trash2, Video, CheckCircle2, X, Link2, ExternalLink, Loader2 } from 'lucide-react';
import API_BASE_URL from '@shared/api/baseUrl';

export default function ManageMeetingRoomsTab() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/meeting-rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (error) {
      console.error('Error fetching meeting rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [token]);

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
        await fetchRooms();
        resetModal();
      } else {
        alert('Có lỗi xảy ra khi lưu phòng meeting');
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
        await fetchRooms();
      }
    } catch (error) {
      console.error('Delete error', error);
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-navy-600" /></div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Quản lý phòng meeting</h2>
          <p className="text-sm text-gray-500 mt-1">Quản lý danh sách phòng họp và liên kết cuộc họp trực tuyến.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-navy-600 to-navy-800 text-white px-4 py-2 rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Tạo phòng mới
        </button>
      </div>

      <div className="mt-6">
        {rooms.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Chưa có phòng meeting nào được tạo.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <article key={room.id} className="group relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-navy-100 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-600">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 leading-tight">{room.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{room.location}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { setEditingRoom(room); setFormData(room); setIsModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(room.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                      Sức chứa: {room.capacity} người
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4">{room.description}</p>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-400">
                    Cập nhật lúc {new Date(room.created_at || room.updated_at).toLocaleString('vi-VN')}
                  </div>

                  {room.meeting_link ? (
                    <a
                      href={room.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Tham gia họp
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                      <Link2 className="w-4 h-4" />
                      Chưa có link
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-6 py-5">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {editingRoom ? 'Chỉnh sửa phòng meeting' : 'Tạo phòng meeting mới'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Quản lý thông tin phòng họp và link họp trực tuyến cho doanh nghiệp.
                </p>
              </div>
              <button onClick={resetModal} className="rounded-full p-2 text-gray-400 hover:bg-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Tên phòng</label>
                  <input type="text" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-navy-100" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Địa điểm / Hình thức</label>
                  <input type="text" value={formData.location || ''} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-navy-100" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Sức chứa</label>
                  <input type="number" value={formData.capacity || ''} onChange={(e) => setFormData({...formData, capacity: e.target.value})} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-navy-100" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Link meeting (Meet, Zoom, ...)</label>
                  <input type="text" value={formData.meeting_link || ''} onChange={(e) => setFormData({...formData, meeting_link: e.target.value})} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-navy-100" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Mô tả chi tiết</label>
                  <textarea value={formData.description || ''} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-navy-100 min-h-[100px]" />
                </div>
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-5">
              <button type="button" onClick={resetModal} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-gray-50">
                Hủy
              </button>
              <button type="submit" onClick={handleSubmit} disabled={actionLoading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-navy-600 to-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-70">
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
