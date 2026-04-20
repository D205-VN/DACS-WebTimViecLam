import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Trash2, Download, Loader2, Sparkles, Calendar, Briefcase, ImageUp, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API = '/api/cv';

export default function ManageCVsPage() {
  const { token } = useAuth();
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  
  // States for viewing/downloading CV
  const [viewHtml, setViewHtml] = useState(null);
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
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center">
            <FileText className="w-7 h-7 text-navy-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Quản lý Hồ sơ CV</h1>
            <p className="text-sm text-gray-500">Xem lại và tải xuống các bản CV bạn đã lưu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/seeker/cv-import" className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:shadow-sm hover:bg-gray-50 transition-all">
            <ImageUp className="w-4 h-4" /> Import ảnh từ máy
          </Link>
          <Link to="/seeker/cv-builder" className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
            <Sparkles className="w-4 h-4" /> Tạo CV AI
          </Link>
        </div>
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
              
              <h3 className="text-lg font-bold text-gray-800 mb-1 line-clamp-1" title={cv.title}>{cv.title}</h3>
              
              <div className="space-y-2 mb-6 mt-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Briefcase className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate">{cv.target_role || 'Chưa rõ vị trí'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>Ngày tạo: {new Date(cv.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
              
              <div className="mt-auto">
                <button onClick={() => handleDownload(cv.html_content, cv.title)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-navy-50 text-navy-700 font-semibold rounded-xl hover:bg-navy-100 transition-colors">
                  <Download className="w-4 h-4" /> Tải PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ẩn CV HTML để export PDF */}
      <div style={{ display: 'none' }}>
        <div ref={cvRef} dangerouslySetInnerHTML={{ __html: viewHtml || '' }} />
      </div>
    </div>
  );
}
