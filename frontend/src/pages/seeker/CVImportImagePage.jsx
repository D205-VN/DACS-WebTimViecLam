import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ImageUp, Loader2, Save, Download, CheckCircle } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import SeekerToolsNav from '@features/seeker-tools/SeekerToolsNav';
import API_BASE_URL from '@shared/api/baseUrl';

const API = `${API_BASE_URL}/api/cv`;

export default function CVImportImagePage() {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  const cvRef = useRef(null);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');

  const [extracted, setExtracted] = useState(null);
  const [cvHtml, setCvHtml] = useState('');

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickFile = () => fileInputRef.current?.click();

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setError('');
    setExtracted(null);
    setCvHtml('');
    setSaveSuccess(false);
    setSaveMessage('');
    setFile(f || null);
    // Allow selecting same file again
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!file) return;
    setError('');
    setSaveMessage('');
    setLoading(true);
    setExtracted(null);
    setCvHtml('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${API}/import-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fallback =
          res.status === 401 || res.status === 403
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : res.status === 413
              ? 'Ảnh quá lớn (tối đa 10MB). Vui lòng chọn ảnh nhỏ hơn.'
              : 'Import ảnh thất bại';
        throw new Error(data.error || fallback);
      }
      setExtracted(data.extracted || null);
      setCvHtml(data.cv || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!cvHtml) return;
    setSaving(true);
    try {
      const title = extracted?.role ? `CV - ${extracted.role}` : 'CV - Import ảnh';
      const res = await fetch(`${API}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          target_role: extracted?.role || '',
          html_content: cvHtml,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu CV');
      setSaveSuccess(true);
      setSaveMessage(
        data.is_primary
          ? 'CV import đã lưu và đang là hồ sơ chính dùng để nộp hồ sơ.'
          : 'CV import đã lưu. Bạn có thể vào Quản lý hồ sơ CV để chọn bản này làm CV chính.'
      );
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!cvRef.current) return;
    const html2pdf = (await import('html2pdf.js')).default;
    html2pdf()
      .set({
        margin: 0,
        filename: `CV_Import_Anh.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(cvRef.current)
      .save();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to="/seeker/my-cvs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại quản lý CV
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center">
          <ImageUp className="w-7 h-7 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Import CV từ ảnh</h1>
          <p className="text-sm text-gray-500">Tải ảnh CV từ máy, hệ thống sẽ đọc nội dung và dựng lại CV HTML để bạn lưu / tải PDF</p>
        </div>
      </div>

      <SeekerToolsNav />

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}
      {saveMessage && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{saveMessage}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold text-gray-800">Ảnh CV</h2>
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
              <button onClick={pickFile} className="px-4 py-2 text-sm font-semibold text-navy-700 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors">
                Chọn ảnh
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-700 rounded-lg hover:shadow-lg transition-all disabled:opacity-60"
              >
                {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Đang đọc...</span> : 'Import'}
              </button>
            </div>
          </div>

          {file ? (
            <div className="rounded-xl border border-gray-100 overflow-hidden bg-gray-50">
              <img src={previewUrl} alt="CV upload preview" className="w-full max-h-[520px] object-contain" />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-500">
              Chọn một ảnh CV rõ nét (PNG/JPG). Hệ thống sẽ scan nội dung và dựng lại thành một bản CV HTML gần với bố cục gốc.
            </div>
          )}

          {extracted && (
            <div className="mt-5">
              <h3 className="text-sm font-bold text-gray-800 mb-2">Dữ liệu trích xuất</h3>
              <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                <div><b>Họ tên:</b> {extracted.fullName || '(trống)'}</div>
                <div><b>Email:</b> {extracted.email || '(trống)'}</div>
                <div><b>SĐT:</b> {extracted.phone || '(trống)'}</div>
                <div><b>Vị trí:</b> {extracted.role || '(trống)'}</div>
                <div><b>Bố cục:</b> {extracted.layoutStyle || '(đang suy luận)'}</div>
                <div><b>Màu nhấn:</b> {extracted.primaryColor || '(đang suy luận)'}</div>
              </div>
              {extracted.sectionOrder ? (
                <p className="mt-2 text-xs text-gray-500">
                  <b>Thứ tự section:</b> {extracted.sectionOrder}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div>
          <div className="sticky top-20">
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="text-base font-bold text-gray-800">CV dựng lại</h2>
              {cvHtml && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || saveSuccess}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-navy-600 rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-70"
                  >
                    {saveSuccess ? <><CheckCircle className="w-4 h-4" /> Đã lưu</> : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</> : <><Save className="w-4 h-4" /> Lưu</>}
                  </button>
                  <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-navy-700 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors">
                    <Download className="w-4 h-4" /> Tải PDF
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto min-h-[600px] flex flex-col">
              {cvHtml ? (
                <div ref={cvRef} className="p-6 flex-1 min-w-[800px]" dangerouslySetInnerHTML={{ __html: cvHtml }} />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-gray-400 p-8 text-center">
                  <p className="text-sm">Sau khi bấm Import, CV HTML sẽ hiển thị ở đây.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
