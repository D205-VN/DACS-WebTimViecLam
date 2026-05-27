import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Building2, MapPin, Globe, Users, Briefcase, Calendar,
  ChevronRight, Play, Image as ImageIcon, Gift, ArrowLeft,
  ExternalLink, Clock
} from 'lucide-react';
import API_BASE_URL from '@services/http/baseUrl';

const API = `${API_BASE_URL}/api/jobs`;

const SECTION_TABS = [
  { key: 'about', label: 'Giới thiệu' },
  { key: 'gallery', label: 'Ảnh & Video' },
  { key: 'perks', label: 'Phúc lợi' },
  { key: 'jobs', label: 'Việc làm' },
];

function formatDeadline(deadline) {
  if (!deadline) return null;
  try {
    return new Date(deadline).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  } catch { return null; }
}

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function CompanyBrandingPage() {
  const [searchParams] = useSearchParams();
  const companyName = searchParams.get('name') || '';
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('about');
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!companyName) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    fetch(`${API}/company-profile?name=${encodeURIComponent(companyName)}`)
      .then(r => r.json())
      .then(data => {
        if (data.data) setCompany(data.data);
        else setError(data.error || 'Không tìm thấy công ty');
      })
      .catch(() => setError('Không thể kết nối đến máy chủ'))
      .finally(() => setLoading(false));
  }, [companyName]);

  if (loading) return (
    <div className="flex justify-center py-32">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
    </div>
  );

  if (error || !company) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <Building2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-700 mb-2">{error || 'Không tìm thấy công ty'}</h2>
      <Link to="/companies" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium mt-4">
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách công ty
      </Link>
    </div>
  );

  const gallery = Array.isArray(company.company_gallery) ? company.company_gallery : [];
  const perks = Array.isArray(company.company_perks) ? company.company_perks : [];
  const jobs = Array.isArray(company.jobs) ? company.jobs : [];
  const embedUrl = getYouTubeEmbedUrl(company.company_video_url);
  const lightboxImage = previewImage || (lightboxIdx !== null ? { src: gallery[lightboxIdx], alt: `Ảnh ${lightboxIdx + 1}` } : null);

  return (
    <div className="aw-page">
      {/* Hero Cover */}
      <div className="relative h-72 sm:h-96 bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-700 overflow-hidden">
        {company.company_cover_url && (
          <>
            <img src={company.company_cover_url} alt="Ảnh bìa" className="absolute inset-0 w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => setPreviewImage({ src: company.company_cover_url, alt: 'Ảnh bìa' })}
              aria-label="Xem ảnh bìa"
              className="absolute inset-0 z-[1] cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/80"
            />
          </>
        )}
        <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute top-4 left-4 z-10">
          <Link to="/companies" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white rounded-lg text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Danh sách công ty
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Company Header Card */}
        <div className="aw-surface -mt-16 relative z-10 mb-6 p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Logo */}
            <div className="relative z-20 -mt-12 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border-4 border-white bg-gradient-to-r from-indigo-600 to-violet-600 ">
              {company.avatar_url
                ? (
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ src: company.avatar_url, alt: 'Logo công ty' })}
                    aria-label="Xem logo công ty"
                    className="block h-full w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <img src={company.avatar_url} alt="Logo" className="w-full h-full object-cover" />
                  </button>
                )
                : <span className="text-4xl font-bold text-white">{company.company_name?.charAt(0)}</span>
              }
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{company.company_name}</h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-2 text-sm text-gray-500">
                {company.company_industry && (
                  <span className="inline-flex items-center gap-1.5"><Briefcase className="w-4 h-4" />{company.company_industry}</span>
                )}
                {company.company_size && (
                  <span className="inline-flex items-center gap-1.5"><Users className="w-4 h-4" />{company.company_size}</span>
                )}
                {company.company_city && (
                  <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{company.company_city}</span>
                )}
                {company.company_founded_year && (
                  <span className="inline-flex items-center gap-1.5"><Calendar className="w-4 h-4" />Thành lập {company.company_founded_year}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {company.company_website && (
                <a href={company.company_website.startsWith('http') ? company.company_website : `https://${company.company_website}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-100/60 text-gray-700 rounded-lg text-sm font-medium hover:border-indigo-300 hover:text-indigo-700 transition-colors">
                  <Globe className="w-4 h-4" /> Website <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold">
                <Briefcase className="w-4 h-4" /> {company.job_count || 0} việc đang tuyển
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 pb-16">
          <div className="min-w-0">
            {/* Section Tabs */}
            <div className="aw-surface overflow-hidden">
              <div className="flex border-b border-indigo-50 overflow-x-auto">
                {SECTION_TABS.filter(t => {
                  if (t.key === 'gallery') return gallery.length > 0 || embedUrl;
                  if (t.key === 'perks') return perks.length > 0;
                  return true;
                }).map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${activeTab === tab.key ? 'border-indigo-500 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab.label}
                    {tab.key === 'jobs' && jobs.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{jobs.length}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-6 sm:p-8">
                {/* About */}
                {activeTab === 'about' && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Giới thiệu công ty</h2>
                    {company.company_description ? (
                      <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{company.company_description}</p>
                    ) : (
                      <p className="text-gray-400 italic">Công ty chưa cập nhật thông tin giới thiệu.</p>
                    )}
                  </div>
                )}

                {/* Gallery & Video */}
                {activeTab === 'gallery' && (
                  <div className="space-y-8">
                    {gallery.length > 0 && (
                      <div>
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                          <ImageIcon className="w-5 h-5 text-indigo-600" /> Ảnh văn phòng
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {gallery.map((url, idx) => (
                            <button key={idx} onClick={() => setLightboxIdx(idx)}
                              className="group aspect-video rounded-lg overflow-hidden bg-gray-100 shadow-sm  transition-shadow">
                              <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover  transition-transform duration-300" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {embedUrl && (
                      <div>
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                          <Play className="w-5 h-5 text-indigo-600" /> Video giới thiệu
                        </h2>
                        <div className="rounded-lg overflow-hidden  aspect-video">
                          <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Company Video" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Perks */}
                {activeTab === 'perks' && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <Gift className="w-5 h-5 text-indigo-600" /> Phúc lợi & Đãi ngộ
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {perks.map((perk, idx) => (
                        <div key={idx} className="flex items-start gap-4 rounded-lg border border-indigo-50 bg-indigo-50/50 p-4 transition-colors hover:border-indigo-100/60 hover:bg-white">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-indigo-50 bg-white text-2xl">
                            {perk.icon}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{perk.title}</p>
                            {perk.description && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{perk.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Jobs */}
                {activeTab === 'jobs' && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 mb-6">Việc làm đang tuyển ({jobs.length})</h2>
                    {jobs.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>Hiện chưa có tin tuyển dụng nào.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {jobs.map(job => (
                          <Link key={job.id} to={`/jobs/${job.id}`}
                            className="flex items-center justify-between gap-4 p-4 border border-indigo-50 rounded-lg hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors truncate">{job.title}</p>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                                {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                                {job.salary && <span className="font-medium text-emerald-600">{job.salary}</span>}
                                {job.job_type && <span className="px-2 py-0.5 bg-gray-100 rounded-full">{job.job_type}</span>}
                                {job.deadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />HSD: {formatDeadline(job.deadline)}</span>}
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 shrink-0 transition-colors" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="aw-surface p-5">
              <h3 className="font-bold text-gray-800 mb-4">Thông tin công ty</h3>
              <div className="space-y-3 text-sm">
                {[
                  { icon: Building2, label: 'Tên công ty', value: company.company_name },
                  { icon: Briefcase, label: 'Ngành nghề', value: company.company_industry },
                  { icon: Users, label: 'Quy mô', value: company.company_size },
                  { icon: MapPin, label: 'Địa điểm', value: company.company_city },
                  { icon: Calendar, label: 'Thành lập', value: company.company_founded_year },
                ].map(item => item.value ? (
                  <div key={item.label} className="flex items-start gap-3">
                    <item.icon className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">{item.label}</p>
                      <p className="font-medium text-gray-700">{item.value}</p>
                    </div>
                  </div>
                ) : null)}
                {company.company_website && (
                  <div className="flex items-start gap-3">
                    <Globe className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Website</p>
                      <a href={company.company_website.startsWith('http') ? company.company_website : `https://${company.company_website}`}
                        target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline break-all">
                        {company.company_website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {jobs.length > 0 && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-5 text-gray-900">
                <h3 className="font-bold mb-1">Tuyển dụng ngay!</h3>
                <p className="mb-4 text-sm text-indigo-700">{company.company_name} đang có {jobs.length} vị trí mở.</p>
                <button onClick={() => setActiveTab('jobs')}
                  className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:from-indigo-700 hover:to-violet-700">
                  Xem tất cả việc làm
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={() => { setLightboxIdx(null); setPreviewImage(null); }}>
          <img src={lightboxImage.src} alt={lightboxImage.alt}
            className="max-w-full max-h-full rounded-lg shadow-lg object-contain" onClick={e => e.stopPropagation()} />
          <button onClick={() => { setLightboxIdx(null); setPreviewImage(null); }}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-xl font-bold transition-colors">
            ×
          </button>
          {lightboxIdx !== null && gallery.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + gallery.length) % gallery.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-lg transition-colors">‹</button>
              <button onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % gallery.length); }}
                className="absolute right-16 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-lg transition-colors">›</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
