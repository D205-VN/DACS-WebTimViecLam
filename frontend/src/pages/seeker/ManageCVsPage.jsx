import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Trash2, Download, Loader2, Sparkles, Calendar, Briefcase, ImageUp, Search, Eye, CheckCircle2, X, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import SeekerToolsNav from '@features/seeker-tools/SeekerToolsNav';
import CVReviewModal from '@features/seeker-tools/CVReviewModal';
import { getBackLabelByRole, getDefaultRouteByRole } from '@shared/utils/roleRedirect';
import API_BASE_URL from '@shared/api/baseUrl';

const API = `${API_BASE_URL}/api/cv`;

export default function ManageCVsPage() {
  const { token, user } = useAuth();
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const backLabel = getBackLabelByRole(user?.role_code);
  
  // States for viewing/downloading CV
  const [viewHtml, setViewHtml] = useState(null);
  const [previewCv, setPreviewCv] = useState(null);
  const [primaryLoadingId, setPrimaryLoadingId] = useState(null);
  const [reviewCv, setReviewCv] = useState(null);
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [reviewLoadingId, setReviewLoadingId] = useState(null);
  const [reviewApplyingIndex, setReviewApplyingIndex] = useState(null);
  const [reviewApplyMessage, setReviewApplyMessage] = useState('');
  const [reviewApplyStates, setReviewApplyStates] = useState({});
  const [reviewApplyErrors, setReviewApplyErrors] = useState({});
  const cvRef = useRef(null);

  const fetchCVs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/my-cvs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCvs(data.cvs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCVs();
  }, [fetchCVs]);

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hồ sơ này?')) return;
    try {
      const res = await fetch(`${API}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Không thể xóa CV');
      setCvs(p => p.filter(c => c.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSetPrimary = async (id) => {
    setPrimaryLoadingId(id);
    try {
      const res = await fetch(`${API}/${id}/primary`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể chọn CV chính');

      setCvs((prev) =>
        prev.map((cv) => ({
          ...cv,
          is_primary: cv.id === id,
        }))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setPrimaryLoadingId(null);
    }
  };

  const handleDownload = async (htmlContent, title) => {
    setViewHtml(htmlContent);
    // Đợi render xong (trong ref ẩn)
    setTimeout(async () => {
      if (!cvRef.current) return;
      const html2pdf = (await import('html2pdf.js')).default;
      html2pdf().set({
        margin: 0, filename: `${title.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(cvRef.current).save().then(() => {
        setViewHtml(null); // Clear sau khi down
      });
    }, 100);
  };

  const handleReview = async (cv) => {
    setReviewCv(cv);
    setReviewResult(null);
    setReviewError('');
    setReviewApplyMessage('');
    setReviewApplyStates({});
    setReviewApplyErrors({});
    setReviewLoadingId(cv.id);

    try {
      const res = await fetch(`${API}/${cv.id}/review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể phân tích CV');
      setReviewResult(data.data || null);
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewLoadingId(null);
    }
  };

  const handleApplyReviewSuggestion = async (suggestion, index) => {
    if (!reviewCv) return;
    setReviewApplyingIndex(index);
    setReviewError('');
    setReviewApplyMessage('');
    setReviewApplyStates((prev) => ({ ...prev, [index]: 'idle' }));
    setReviewApplyErrors((prev) => ({ ...prev, [index]: '' }));

    try {
      const res = await fetch(`${API}/${reviewCv.id}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ suggestions: [suggestion] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể sửa CV theo gợi ý');

      const updatedCv = data.data;
      if (updatedCv) {
        setCvs((prev) => prev.map((cv) => (cv.id === updatedCv.id ? { ...cv, ...updatedCv } : cv)));
        setReviewCv((prev) => (prev ? { ...prev, ...updatedCv } : prev));
        setPreviewCv((prev) => (prev?.id === updatedCv.id ? { ...prev, ...updatedCv } : prev));
      }
      setReviewApplyStates((prev) => ({ ...prev, [index]: 'done' }));
      setReviewApplyMessage('Đã sửa CV đã lưu. Bạn có thể bấm xem hồ sơ để kiểm tra lại bản mới.');
    } catch (err) {
      setReviewApplyStates((prev) => ({ ...prev, [index]: 'error' }));
      setReviewApplyErrors((prev) => ({ ...prev, [index]: err.message || 'Không thể sửa CV theo gợi ý này' }));
    } finally {
      setReviewApplyingIndex(null);
    }
  };

  const filteredCVs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cvs;
    return cvs.filter((cv) => {
      const title = (cv.title || '').toLowerCase();
      const role = (cv.target_role || '').toLowerCase();
      return title.includes(q) || role.includes(q);
    });
  }, [cvs, query]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-navy-600" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to={backRoute} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      <div className="flex flex-col gap-4 mb-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center">
            <FileText className="w-7 h-7 text-navy-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Quản lý Hồ sơ CV</h1>
            <p className="text-sm text-gray-500">Xem, chọn CV chính và tải xuống các bản CV bạn đã lưu</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link to="/seeker/blockchain-verification" className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold rounded-xl hover:bg-emerald-100 transition-all">
            <ShieldCheck className="w-4 h-4" /> Blockchain
          </Link>
          <Link to="/seeker/cv-import" className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:shadow-sm hover:bg-gray-50 transition-all">
            <ImageUp className="w-4 h-4" /> Import ảnh từ máy
          </Link>
          <Link to="/seeker/cv-builder" className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
            <Sparkles className="w-4 h-4" /> Tạo CV AI
          </Link>
        </div>
      </div>

      <SeekerToolsNav />

      <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800">
        Hệ thống sẽ tự dùng <b>CV chính</b> khi bạn bấm ứng tuyển. Bạn có thể xem trước từng bản CV và đổi CV chính bất kỳ lúc nào tại đây.
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

      {cvs.length > 0 && (
        <div className="mb-6">
          <div className="relative max-w-xl">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên tuyển dụng (vị trí ứng tuyển) hoặc tiêu đề CV..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-400 transition-all"
            />
          </div>
          {query.trim() && (
            <p className="mt-2 text-xs text-gray-500">
              Hiển thị <b>{filteredCVs.length}</b> / {cvs.length} hồ sơ
            </p>
          )}
        </div>
      )}

      {cvs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-800 mb-2">Chưa có hồ sơ nào</h3>
          <p className="text-gray-500 mb-6">Bạn chưa lưu bất kỳ bản CV nào. Hãy tạo một bản CV ấn tượng bằng AI nhé!</p>
          <Link to="/seeker/cv-builder" className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-600 text-white font-semibold rounded-xl hover:bg-navy-700 transition-colors">
            Bắt đầu tạo CV
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCVs.map(cv => (
            <div key={cv.id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-50 text-navy-600 rounded-xl flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <button onClick={() => handleDelete(cv.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xóa hồ sơ">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-gray-800 mb-1 line-clamp-1" title={cv.title}>{cv.title}</h3>
                {cv.is_primary ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> CV chính
                  </span>
                ) : null}
              </div>

              {cv.is_primary ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  Bản này đang được dùng mặc định để nộp hồ sơ.
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-500">
                  Chọn bản này làm CV chính nếu muốn dùng để ứng tuyển.
                </p>
              )}
              
              <div className="space-y-2 mb-6 mt-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Briefcase className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate">{cv.target_role || 'Chưa rõ vị trí'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>Ngày tạo: {new Date(cv.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                </div>
              </div>
              
              <div className="mt-auto space-y-2">
                <button
                  onClick={() => setPreviewCv(cv)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-4 h-4" /> Xem hồ sơ
                </button>
                <button
                  onClick={() => handleReview(cv)}
                  disabled={Boolean(reviewLoadingId)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 font-semibold rounded-xl hover:bg-amber-100 transition-colors disabled:opacity-70"
                >
                  {reviewLoadingId === cv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  {reviewLoadingId === cv.id ? 'Đang phân tích...' : 'Gợi ý sửa CV'}
                </button>
                <button onClick={() => handleDownload(cv.html_content, cv.title)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-navy-50 text-navy-700 font-semibold rounded-xl hover:bg-navy-100 transition-colors">
                  <Download className="w-4 h-4" /> Tải PDF
                </button>
                <button
                  onClick={() => handleSetPrimary(cv.id)}
                  disabled={cv.is_primary || primaryLoadingId === cv.id}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold rounded-xl transition-colors ${
                    cv.is_primary
                      ? 'bg-emerald-50 text-emerald-700 cursor-default'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-70 disabled:cursor-not-allowed'
                  }`}
                >
                  {primaryLoadingId === cv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {cv.is_primary ? 'Đang là CV chính' : 'Chọn làm CV chính'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewCv ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Xem hồ sơ CV</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">{previewCv.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{previewCv.target_role || 'Chưa rõ vị trí'}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCv(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-96px)] overflow-auto bg-slate-50 p-5">
              <div
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-w-[800px] mx-auto"
                dangerouslySetInnerHTML={{ __html: previewCv.html_content }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <CVReviewModal
        open={Boolean(reviewCv)}
        title={reviewCv ? `Gợi ý sửa ${reviewCv.title}` : 'Gợi ý sửa CV'}
        loading={Boolean(reviewCv && reviewLoadingId === reviewCv.id)}
        applyingIndex={reviewApplyingIndex}
        applyStates={reviewApplyStates}
        applyErrors={reviewApplyErrors}
        error={reviewError}
        applyMessage={reviewApplyMessage}
        review={reviewResult}
        onClose={() => setReviewCv(null)}
        onApplySuggestion={handleApplyReviewSuggestion}
      />

      {/* Ẩn CV HTML để export PDF */}
      <div style={{ display: 'none' }}>
        <div ref={cvRef} dangerouslySetInnerHTML={{ __html: viewHtml || '' }} />
      </div>
    </div>
  );
}
