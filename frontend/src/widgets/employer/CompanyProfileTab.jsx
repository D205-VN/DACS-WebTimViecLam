import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Image as ImageIcon, Save, Loader2, Info, CheckCircle2, Camera,
  Plus, Trash2, Video, Gift, Building2, Calendar, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';

const MAX_IMAGE_SOURCE_SIZE = 8 * 1024 * 1024;
const IMAGE_CONFIG = {
  cover: { maxWidth: 1600, maxHeight: 520, quality: 0.84 },
  avatar: { maxWidth: 640, maxHeight: 640, quality: 0.88 },
  gallery: { maxWidth: 1200, maxHeight: 900, quality: 0.82 },
};

const PRESET_PERKS = [
  { icon: '🏠', label: 'Remote / Hybrid' },
  { icon: '💰', label: 'Thưởng dự án' },
  { icon: '🎓', label: 'Học bổng đào tạo' },
  { icon: '🏥', label: 'Bảo hiểm sức khỏe' },
  { icon: '🎉', label: 'Team building' },
  { icon: '⏰', label: 'Giờ linh hoạt' },
  { icon: '🍱', label: 'Phụ cấp ăn trưa' },
  { icon: '🚗', label: 'Phụ cấp đi lại' },
  { icon: '💻', label: 'Hỗ trợ thiết bị' },
  { icon: '📈', label: 'Lộ trình thăng tiến' },
  { icon: '🏋️', label: 'Gym / thể thao' },
  { icon: '🌴', label: 'Du lịch hàng năm' },
];

const TABS = [
  { key: 'info', label: 'Thông tin cơ bản', icon: Building2 },
  { key: 'media', label: 'Ảnh & Video', icon: ImageIcon },
  { key: 'perks', label: 'Phúc lợi', icon: Gift },
];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
}

async function buildImageDataUrl(file, imageType) {
  if (!file.type?.startsWith('image/')) throw new Error('Vui lòng chọn đúng định dạng ảnh.');
  if (file.size > MAX_IMAGE_SOURCE_SIZE) throw new Error('Ảnh quá lớn. Tối đa 8MB.');
  const sourceDataUrl = await readFileAsDataUrl(file);
  const config = IMAGE_CONFIG[imageType] || IMAGE_CONFIG.avatar;
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, config.maxWidth / image.width, config.maxHeight / image.height);
      const w = Math.max(1, Math.round(image.width * scale));
      const h = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = w; canvas.height = h;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(image, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', config.quality));
    };
    image.onerror = () => reject(new Error('Ảnh không hợp lệ.'));
    image.src = sourceDataUrl;
  });
}

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/);
  return match ? match[1] : null;
}

function getYouTubeEmbedUrl(url) {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export default function CompanyProfileTab() {
  const { token, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  const [newPerk, setNewPerk] = useState({ icon: '⭐', title: '', description: '' });
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/employer/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setProfile({
          ...data.data,
          company_gallery: data.data?.company_gallery || [],
          company_perks: data.data?.company_perks || [],
          company_video_url: data.data?.company_video_url || '',
        });
      })
      .catch(() => setError('Không thể kết nối đến máy chủ'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    setSaving(true); setMessage(''); setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(prev => ({ ...prev, ...data.data }));
        updateUser(prev => prev ? { ...prev, company_name: data.data?.company_name ?? prev.company_name, avatar_url: data.data?.avatar_url ?? prev.avatar_url } : prev);
        setMessage('Cập nhật hồ sơ thành công!');
      } else {
        setError(data.error || 'Lỗi khi cập nhật');
      }
    } catch { setError('Lỗi kết nối mạng'); }
    finally { setSaving(false); }
  };

  const handleChange = e => setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleImageChange = async (event, fieldName, imageType) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageLoading(imageType); setError('');
    try {
      const dataUrl = await buildImageDataUrl(file, imageType);
      if (imageType === 'gallery') {
        setProfile(prev => ({
          ...prev,
          company_gallery: [...(prev.company_gallery || []), dataUrl].slice(0, 8),
        }));
      } else {
        setProfile(prev => ({ ...prev, [fieldName]: dataUrl }));
      }
    } catch (err) { setError(err.message); }
    finally { setImageLoading(''); }
  };

  const removeGalleryImage = idx => {
    setLightboxIdx(prev => {
      if (prev === null) return prev;
      if (prev === idx) return null;
      return prev > idx ? prev - 1 : prev;
    });
    setProfile(prev => ({ ...prev, company_gallery: (prev.company_gallery || []).filter((_, i) => i !== idx) }));
  };

  const addPerk = (icon, title) => {
    const t = (title || newPerk.title).trim();
    if (!t) return;
    const perk = { icon: icon || newPerk.icon, title: t, description: newPerk.description.trim() };
    setProfile(prev => ({ ...prev, company_perks: [...(prev.company_perks || []), perk].slice(0, 12) }));
    setNewPerk({ icon: '⭐', title: '', description: '' });
  };

  const removePerk = idx => {
    setProfile(prev => ({ ...prev, company_perks: (prev.company_perks || []).filter((_, i) => i !== idx) }));
  };

  const gallery = profile?.company_gallery || [];
  const lightboxImage = previewImage || (lightboxIdx !== null ? { src: gallery[lightboxIdx], alt: `Ảnh ${lightboxIdx + 1}` } : null);

  useEffect(() => {
    if (lightboxIdx === null && !previewImage) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLightboxIdx(null);
        setPreviewImage(null);
      }

      if (event.key === 'ArrowLeft' && lightboxIdx !== null) {
        setLightboxIdx(prev => {
          const count = profile?.company_gallery?.length || 0;
          return prev === null || count < 2 ? prev : (prev - 1 + count) % count;
        });
      }

      if (event.key === 'ArrowRight' && lightboxIdx !== null) {
        setLightboxIdx(prev => {
          const count = profile?.company_gallery?.length || 0;
          return prev === null || count < 2 ? prev : (prev + 1) % count;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIdx, previewImage, profile?.company_gallery?.length]);

  if (loading) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 text-navy-700 animate-spin mb-4" />
      <p className="text-gray-500 font-medium">Đang tải hồ sơ công ty...</p>
    </div>
  );

  const embedUrl = getYouTubeEmbedUrl(profile?.company_video_url);

  return (
    <div className="space-y-6">
      {/* Cover + Avatar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-64 sm:h-72 bg-gradient-to-r from-navy-800 to-navy-600 relative overflow-hidden">
          {profile?.company_cover_url && (
            <>
              <img src={profile.company_cover_url} alt="Ảnh bìa" className="absolute inset-0 h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setPreviewImage({ src: profile.company_cover_url, alt: 'Ảnh bìa' })}
                aria-label="Xem ảnh bìa"
                className="absolute inset-0 z-[1] cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/80"
              />
            </>
          )}
          <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/30 via-black/5 to-black/10" />
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => handleImageChange(e, 'company_cover_url', 'cover')} />
          <button type="button" onClick={() => coverInputRef.current?.click()} disabled={imageLoading === 'cover'}
            className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm text-sm font-medium flex items-center gap-2 transition-colors">
            {imageLoading === 'cover' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            Đổi ảnh bìa
          </button>
        </div>

        <div className="px-6 sm:px-10 pb-6 relative z-20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end -mt-16 mb-4 gap-4">
            <div className="flex items-end gap-5">
              <div className="relative z-20 w-32 h-32 bg-white p-2 rounded-2xl shadow-lg border-2 border-white group">
                {profile?.avatar_url
                  ? (
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ src: profile.avatar_url, alt: 'Logo công ty' })}
                      aria-label="Xem logo công ty"
                      className="block h-full w-full cursor-zoom-in overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-300"
                    >
                      <img src={profile.avatar_url} alt="Logo" className="w-full h-full object-cover" />
                    </button>
                  )
                  : <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center text-4xl text-gray-400 font-bold uppercase">
                      {profile?.company_name?.charAt(0) || 'C'}
                    </div>
                }
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleImageChange(e, 'avatar_url', 'avatar')} />
                <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={imageLoading === 'avatar'}
                  className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-center gap-1.5 rounded-lg bg-gray-900/75 px-2 py-1.5 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 backdrop-blur-sm transition-all">
                  {imageLoading === 'avatar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  Đổi logo
                </button>
              </div>
              <div className="mb-2">
                <h1 className="text-2xl font-bold text-gray-800">{profile?.company_name || 'Tên công ty'}</h1>
                <p className="text-gray-500 text-sm flex items-center gap-1.5 mt-0.5">
                  <Globe className="w-4 h-4" /> {profile?.company_website || 'Chưa có website'}
                </p>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-navy-700 hover:bg-navy-800 text-white rounded-xl font-semibold transition-colors flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu thay đổi
            </button>
          </div>

          {message && <div className="mb-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> {message}</div>}
          {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-2"><Info className="w-5 h-5" /> {error}</div>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === tab.key ? 'border-navy-700 text-navy-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 sm:p-8">
          {/* ===== TAB: THÔNG TIN CƠ BẢN ===== */}
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Giới thiệu công ty</label>
                  <textarea name="company_description" value={profile?.company_description || ''} onChange={handleChange}
                    className="w-full h-44 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-200 outline-none transition-all resize-none"
                    placeholder="Mô tả về công ty, văn hóa, sứ mệnh..." />
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Tên công ty', name: 'company_name' },
                  { label: 'Thành phố', name: 'company_city' },
                  { label: 'Ngành nghề', name: 'company_industry', placeholder: 'VD: Công nghệ thông tin' },
                  { label: 'Quy mô nhân sự', name: 'company_size', placeholder: 'VD: 100 - 500 nhân viên' },
                  { label: 'Năm thành lập', name: 'company_founded_year', placeholder: 'VD: 2015', icon: Calendar },
                  { label: 'Điện thoại', name: 'phone' },
                  { label: 'Website', name: 'company_website' },
                ].map(field => (
                  <div key={field.name}>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{field.label}</label>
                    <input name={field.name} value={profile?.[field.name] || ''} onChange={handleChange}
                      placeholder={field.placeholder}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-navy-200 outline-none" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== TAB: ẢNH & VIDEO ===== */}
          {activeTab === 'media' && (
            <div className="space-y-8">
              {/* Gallery */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-800">Thư viện ảnh văn phòng</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Tối đa 8 ảnh. Ảnh được nén tự động.</p>
                  </div>
                  {(profile?.company_gallery || []).length < 8 && (
                    <>
                      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden"
                        onChange={e => handleImageChange(e, 'company_gallery', 'gallery')} />
                      <button onClick={() => galleryInputRef.current?.click()} disabled={imageLoading === 'gallery'}
                        className="flex items-center gap-2 px-4 py-2 bg-navy-700 text-white rounded-xl text-sm font-semibold hover:bg-navy-800 transition-colors disabled:opacity-50">
                        {imageLoading === 'gallery' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Thêm ảnh
                      </button>
                    </>
                  )}
                </div>

                {gallery.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center cursor-pointer hover:border-navy-300 transition-colors"
                    onClick={() => galleryInputRef.current?.click()}>
                    <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">Chưa có ảnh nào. Nhấn để thêm ảnh văn phòng.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {gallery.map((url, idx) => (
                      <div key={idx} className="group relative aspect-video rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                        <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <button
                          type="button"
                          onClick={() => setLightboxIdx(idx)}
                          aria-label={`Phóng to ảnh ${idx + 1}`}
                          className="absolute inset-0 z-10 bg-black/0 transition-colors hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/80"
                        />
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); removeGalleryImage(idx); }}
                          aria-label={`Xóa ảnh ${idx + 1}`}
                          className="absolute top-2 right-2 z-20 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {gallery.length < 8 && (
                      <button onClick={() => galleryInputRef.current?.click()}
                        className="aspect-video rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 hover:border-navy-300 text-gray-400 hover:text-navy-600 transition-colors">
                        <Plus className="w-5 h-5" />
                        <span className="text-xs font-medium">Thêm ảnh</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Video */}
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-1">Video giới thiệu công ty</h3>
                <p className="text-sm text-gray-500 mb-4">Dán link YouTube (ví dụ: https://www.youtube.com/watch?v=...)</p>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Video className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input name="company_video_url" value={profile?.company_video_url || ''} onChange={handleChange}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-navy-200 outline-none" />
                  </div>
                </div>
                {embedUrl && (
                  <div className="mt-4 rounded-2xl overflow-hidden shadow-md aspect-video">
                    <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Company Video" />
                  </div>
                )}
                {profile?.company_video_url && !embedUrl && (
                  <p className="mt-2 text-sm text-amber-600">Link không hợp lệ. Vui lòng nhập đúng link YouTube.</p>
                )}
              </div>
            </div>
          )}

          {/* ===== TAB: PHÚC LỢI ===== */}
          {activeTab === 'perks' && (
            <div className="space-y-8">
              {/* Quick add presets */}
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-3">Chọn nhanh phúc lợi phổ biến</h3>
                <div className="flex flex-wrap gap-2">
                  {PRESET_PERKS.map(p => {
                    const already = (profile?.company_perks || []).some(perk => perk.title === p.label);
                    return (
                      <button key={p.label} onClick={() => !already && addPerk(p.icon, p.label)} disabled={already}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${already ? 'border-navy-200 bg-navy-50 text-navy-700 opacity-60 cursor-default' : 'border-gray-200 bg-white hover:border-navy-300 hover:bg-navy-50 text-gray-700'}`}>
                        <span>{p.icon}</span> {p.label}
                        {!already && <Plus className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom perk form */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Thêm phúc lợi tùy chỉnh</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Icon (emoji)</label>
                    <input value={newPerk.icon} onChange={e => setNewPerk(p => ({ ...p, icon: e.target.value }))}
                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-navy-200 outline-none" maxLength={5} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Tiêu đề *</label>
                    <input value={newPerk.title} onChange={e => setNewPerk(p => ({ ...p, title: e.target.value }))}
                      placeholder="VD: Thưởng KPI" maxLength={100}
                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-navy-200 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Mô tả ngắn</label>
                    <input value={newPerk.description} onChange={e => setNewPerk(p => ({ ...p, description: e.target.value }))}
                      placeholder="Chi tiết thêm..." maxLength={300}
                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-navy-200 outline-none" />
                  </div>
                </div>
                <button onClick={() => addPerk()} className="mt-3 flex items-center gap-2 px-4 py-2 bg-navy-700 text-white rounded-xl text-sm font-semibold hover:bg-navy-800 transition-colors">
                  <Plus className="w-4 h-4" /> Thêm phúc lợi
                </button>
              </div>

              {/* Perks list */}
              {(profile?.company_perks || []).length > 0 ? (
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Danh sách phúc lợi ({(profile.company_perks || []).length}/12)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(profile.company_perks || []).map((perk, idx) => (
                      <div key={idx} className="group flex items-start gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center text-xl shrink-0">{perk.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm">{perk.title}</p>
                          {perk.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{perk.description}</p>}
                        </div>
                        <button onClick={() => removePerk(idx)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-red-50 text-red-500 flex items-center justify-center transition-opacity shrink-0 hover:bg-red-100">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <Gift className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>Chưa có phúc lợi nào. Hãy thêm để thu hút ứng viên!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => { setLightboxIdx(null); setPreviewImage(null); }}
        >
          <button
            type="button"
            onClick={() => { setLightboxIdx(null); setPreviewImage(null); }}
            aria-label="Đóng ảnh"
            className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>

          {lightboxIdx !== null && gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIdx((lightboxIdx - 1 + gallery.length) % gallery.length);
                }}
                aria-label="Ảnh trước"
                className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIdx((lightboxIdx + 1) % gallery.length);
                }}
                aria-label="Ảnh sau"
                className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <img
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            className="max-h-[86vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
