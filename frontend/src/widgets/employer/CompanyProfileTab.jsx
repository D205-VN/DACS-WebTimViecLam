import React, { useState, useEffect, useRef } from 'react';
import { Globe, Image as ImageIcon, Save, Loader2, Info, CheckCircle2, Camera } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';

const MAX_IMAGE_SOURCE_SIZE = 8 * 1024 * 1024;
const IMAGE_CONFIG = {
  cover: { maxWidth: 1600, maxHeight: 520, quality: 0.84 },
  avatar: { maxWidth: 640, maxHeight: 640, quality: 0.88 },
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được ảnh. Vui lòng chọn ảnh khác.'));
    reader.readAsDataURL(file);
  });
}

async function buildProfileImageDataUrl(file, imageType) {
  if (!file.type?.startsWith('image/')) {
    throw new Error('Vui lòng chọn đúng định dạng ảnh.');
  }

  if (file.size > MAX_IMAGE_SOURCE_SIZE) {
    throw new Error('Ảnh quá lớn. Vui lòng chọn ảnh dưới 8MB.');
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const config = IMAGE_CONFIG[imageType] || IMAGE_CONFIG.avatar;

  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, config.maxWidth / image.width, config.maxHeight / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', config.quality));
    };
    image.onerror = () => reject(new Error('Ảnh không hợp lệ. Vui lòng chọn ảnh khác.'));
    image.src = sourceDataUrl;
  });
}

export default function CompanyProfileTab() {
  const { token, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/employer/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setProfile(data.data);
        } else {
          setError(data.error || 'Lỗi khi tải hồ sơ');
        }
      } catch (err) {
        console.error('Fetch profile error:', err);
        setError('Không thể kết nối đến máy chủ');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchProfile();
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (res.ok) {
        const updatedProfile = data.data || {};
        setProfile(prev => ({ ...prev, ...updatedProfile }));
        updateUser(prev => {
          if (!prev) return prev;

          const pickUpdatedField = (field) => (
            Object.prototype.hasOwnProperty.call(updatedProfile, field)
              ? updatedProfile[field]
              : prev[field]
          );

          return {
            ...prev,
            company_name: pickUpdatedField('company_name'),
            company_city: pickUpdatedField('company_city'),
            phone: pickUpdatedField('phone'),
            avatar_url: pickUpdatedField('avatar_url'),
          };
        });
        setMessage('Cập nhật hồ sơ thành công!');
        setIsEditing(false);
      } else {
        setError(data.error || 'Lỗi khi cập nhật hồ sơ');
      }
    } catch {
      setError('Lỗi kết nối mạng');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (event, fieldName, imageType) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setImageLoading(imageType);
    setMessage('');
    setError('');

    try {
      const imageDataUrl = await buildProfileImageDataUrl(file, imageType);
      setProfile(prev => ({ ...prev, [fieldName]: imageDataUrl }));
      setIsEditing(true);
    } catch (err) {
      setError(err.message || 'Không thể xử lý ảnh đã chọn');
    } finally {
      setImageLoading('');
    }
  };

  if (loading) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 text-navy-700 animate-spin mb-4" />
      <p className="text-gray-500 font-medium">Đang tải hồ sơ công ty...</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="h-48 bg-gradient-to-r from-navy-800 to-navy-600 relative overflow-hidden">
        {profile?.company_cover_url ? (
          <img
            src={profile.company_cover_url}
            alt="Ảnh bìa công ty"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-black/10" />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleImageChange(event, 'company_cover_url', 'cover')}
        />
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          disabled={imageLoading === 'cover'}
          className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
        >
          {imageLoading === 'cover' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {imageLoading === 'cover' ? 'Đang xử lý...' : 'Đổi ảnh bìa'}
        </button>
      </div>
      
      <div className="px-6 sm:px-10 pb-10 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end -mt-16 mb-8 gap-4">
          <div className="flex items-end gap-5">
            <div className="relative w-32 h-32 bg-white p-2 rounded-2xl shadow-lg border-2 border-white group">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Logo" className="w-full h-full rounded-xl object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center text-4xl text-gray-400 font-bold uppercase">
                  {profile?.company_name?.charAt(0) || profile?.full_name?.charAt(0)}
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleImageChange(event, 'avatar_url', 'avatar')}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={imageLoading === 'avatar'}
                className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-1.5 rounded-lg bg-gray-900/75 px-2 py-1.5 text-[11px] font-semibold text-white opacity-100 backdrop-blur-sm transition-colors hover:bg-gray-900/85 disabled:cursor-not-allowed disabled:opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
              >
                {imageLoading === 'avatar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                {imageLoading === 'avatar' ? 'Đang xử lý' : 'Đổi ảnh đại diện'}
              </button>
            </div>
            <div className="mb-0 sm:translate-y-2">
              <h1 className="text-2xl font-bold text-gray-800">{profile?.company_name || 'Tên công ty chưa cập nhật'}</h1>
              <p className="text-gray-500 flex items-center gap-1.5 mt-1">
                <Globe className="w-4 h-4" /> {profile?.company_website || 'website.com'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-navy-700 hover:bg-navy-800 text-white rounded-xl font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Lưu thay đổi
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-6 py-2.5 bg-navy-700 hover:bg-navy-800 text-white rounded-xl font-semibold transition-colors"
              >
                Chỉnh sửa hồ sơ
              </button>
            )}
          </div>
        </div>

        {message && <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> {message}</div>}
        {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-2"><Info className="w-5 h-5" /> {error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-3">Giới thiệu công ty</h3>
              {isEditing ? (
                <textarea 
                  name="company_description"
                  value={profile?.company_description || ''}
                  onChange={handleChange}
                  className="w-full h-40 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-200 focus:border-navy-500 outline-none transition-all" 
                  placeholder="Mô tả về công ty của bạn..."
                ></textarea>
              ) : (
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {profile?.company_description || 'Chưa có thông tin giới thiệu.'}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4">Thông tin chi tiết</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Tên công ty</label>
                  {isEditing ? (
                    <input name="company_name" value={profile?.company_name || ''} onChange={handleChange} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" />
                  ) : (
                    <p className="text-sm text-gray-800 font-medium">{profile?.company_name || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Thành phố</label>
                  {isEditing ? (
                    <input name="company_city" value={profile?.company_city || ''} onChange={handleChange} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" />
                  ) : (
                    <p className="text-sm text-gray-800 font-medium">{profile?.company_city || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Quy mô nhân sự</label>
                  {isEditing ? (
                    <input name="company_size" value={profile?.company_size || ''} onChange={handleChange} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" placeholder="VD: 100 - 500 nhân viên" />
                  ) : (
                    <p className="text-sm text-gray-800 font-medium">{profile?.company_size || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Điện thoại</label>
                  {isEditing ? (
                    <input name="phone" value={profile?.phone || ''} onChange={handleChange} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" />
                  ) : (
                    <p className="text-sm text-gray-800 font-medium">{profile?.phone || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Website</label>
                  {isEditing ? (
                    <input name="company_website" value={profile?.company_website || ''} onChange={handleChange} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" />
                  ) : (
                    <p className="text-sm text-blue-600 font-medium">{profile?.company_website || '-'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
