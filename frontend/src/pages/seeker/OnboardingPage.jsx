import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  ShieldCheck,
  Info,
  Loader2,
  Trash2,
  UserCheck,
  FolderUp,
  ClipboardCheck,
  ScanLine,
  Eye,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';

/* ─── 3 bước quy trình Onboarding ─── */
const STEPS = [
  {
    icon: UserCheck,
    title: 'Xác Nhận Trúng Tuyển',
    desc: 'HR cập nhật trạng thái ứng viên sau phỏng vấn và thông báo kết quả chính thức qua email.',
  },
  {
    icon: FolderUp,
    title: 'Upload Hồ Sơ',
    desc: 'Ứng viên nộp giấy tờ như CCCD, bằng cấp, giấy khám sức khỏe,... thông qua hệ thống số hóa.',
  },
  {
    icon: ClipboardCheck,
    title: 'Phê Duyệt Hồ Sơ',
    desc: 'Nhà tuyển dụng kiểm tra và xác nhận hồ sơ hợp lệ, hoàn tất quá trình nhận việc một cách chuyên nghiệp.',
  },
];

export default function OnboardingPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobInfo, setJobInfo] = useState(null);
  const activeStep = 1; // 0, 1, 2
  const [scanning, setScanning] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitNotice, setSubmitNotice] = useState('');
  const [aiResults, setAiResults] = useState({});
  const [previews, setPreviews] = useState({});
  const [documents, setDocuments] = useState([
    { id: 'cccd_front', name: 'CCCD/CMND — Mặt trước',       status: 'pending',  required: true,  description: 'Chụp rõ nét, đủ ánh sáng, không mất góc',     file: null, feedback: '' },
    { id: 'cccd_back',  name: 'CCCD/CMND — Mặt sau',        status: 'pending',  required: true,  description: 'Chụp rõ nét, đủ ánh sáng, không mất góc',     file: null, feedback: '' },
    { id: 'degree', name: 'Bằng tốt nghiệp / Chứng chỉ',  status: 'pending',  required: true,  description: 'Bản sao công chứng hoặc bản chính',  file: null, feedback: '' },
    { id: 'health', name: 'Giấy khám sức khỏe',            status: 'pending',  required: true,  description: 'Thời hạn không quá 6 tháng',         file: null, feedback: '' },
  ]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/jobs/applied`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const match = (data.data || []).find(j => String(j.application_id) === String(id));
          if (match) {
            setJobInfo({
              title: match.title || 'Vị trí tuyển dụng',
              company: match.company_name || 'Công ty',
              hiredDate: match.applied_at ? new Date(match.applied_at).toLocaleDateString('vi-VN') : '',
            });
          }
        }
      } catch (err) {
        console.error('Load onboarding info error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (token) load();
  }, [id, token]);

  const calculateProgress = () => {
    const approved = documents.filter(d => d.status === 'approved').length;
    return Math.round((approved / documents.length) * 100);
  };

  const handleFileUpload = (docId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Tạo preview URL cho ảnh
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviews(prev => ({ ...prev, [docId]: url }));
    }

    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, file, status: 'uploaded' } : d));

    // Tự động chạy AI scan khi upload ảnh
    if (file.type.startsWith('image/')) {
      runAIScan(docId);
    }
  };

  const runAIScan = (docId) => {
    setScanning(docId);
    setAiResults(prev => ({ ...prev, [docId]: null }));

    // Giả lập AI scan 2-3 giây
    setTimeout(() => {
      const mockResults = {
        cccd_front: {
          label: 'CCCD — Mặt trước',
          confidence: 97.8,
          fields: [
            { key: 'Loại giấy tờ', value: 'Căn cước công dân', confidence: 99 },
            { key: 'Chất lượng ảnh', value: 'Rõ nét, đủ ánh sáng', confidence: 95 },
            { key: 'Góc chụp', value: 'Đầy đủ 4 góc', confidence: 98 },
            { key: 'Tính hợp lệ', value: 'Hợp lệ — Sẵn sàng gửi duyệt', confidence: 97 },
          ],
        },
        cccd_back: {
          label: 'CCCD — Mặt sau',
          confidence: 96.5,
          fields: [
            { key: 'Loại giấy tờ', value: 'Căn cước công dân (mặt sau)', confidence: 98 },
            { key: 'Chất lượng ảnh', value: 'Rõ nét', confidence: 94 },
            { key: 'Đặc điểm nhận dạng', value: 'Phát hiện vùng dữ liệu', confidence: 96 },
            { key: 'Tính hợp lệ', value: 'Hợp lệ — Sẵn sàng gửi duyệt', confidence: 97 },
          ],
        },
        degree: {
          label: 'Bằng cấp / Chứng chỉ',
          confidence: 94.2,
          fields: [
            { key: 'Loại tài liệu', value: 'Bằng tốt nghiệp', confidence: 96 },
            { key: 'Chất lượng ảnh', value: 'Rõ nét', confidence: 93 },
            { key: 'Tính hợp lệ', value: 'Hợp lệ — Sẵn sàng gửi duyệt', confidence: 94 },
          ],
        },
        health: {
          label: 'Giấy khám sức khỏe',
          confidence: 92.5,
          fields: [
            { key: 'Loại tài liệu', value: 'Giấy khám sức khỏe', confidence: 95 },
            { key: 'Chất lượng ảnh', value: 'Rõ nét', confidence: 91 },
            { key: 'Tính hợp lệ', value: 'Hợp lệ — Sẵn sàng gửi duyệt', confidence: 92 },
          ],
        },
      };
      setAiResults(prev => ({ ...prev, [docId]: mockResults[docId] || mockResults.degree }));
      setScanning(null);
    }, 2500);
  };

  const handleDelete = (docId) => {
    if (previews[docId]) URL.revokeObjectURL(previews[docId]);
    setPreviews(prev => { const n = { ...prev }; delete n[docId]; return n; });
    setAiResults(prev => { const n = { ...prev }; delete n[docId]; return n; });
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, file: null, status: 'pending', feedback: '' } : d));
  };

  const handleSubmitDocuments = async () => {
    setSubmitError('');
    setSubmitNotice('');

    const missingRequired = documents.filter((doc) => doc.required && !doc.file);
    if (missingRequired.length) {
      setSubmitError(`Bạn cần tải đủ hồ sơ bắt buộc: ${missingRequired.map((doc) => doc.name).join(', ')}`);
      return;
    }

    const uploadedDocuments = documents.filter((doc) => doc.file);
    const formData = new FormData();
    uploadedDocuments.forEach((doc) => {
      formData.append('documents', doc.file);
    });
    formData.append('doc_types', JSON.stringify(uploadedDocuments.map((doc) => doc.id)));
    formData.append('ai_results', JSON.stringify(aiResults));

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs/applications/${id}/onboarding-documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể gửi hồ sơ onboarding');

      setSubmitNotice(data.message || 'Đã gửi hồ sơ cho nhà tuyển dụng xét duyệt.');
      setDocuments(prev => prev.map(d => d.file ? { ...d, status: 'uploaded' } : d));
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-50/50">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Back */}
      <Link to="/applied-jobs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách việc làm
      </Link>

      {/* ══════ DARK HERO — QUY TRÌNH ONBOARDING ══════ */}
      <div
        className="rounded-lg overflow-hidden shadow-lg"
        style={{ background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 40%, #333 100%)' }}
      >
        {/* Header */}
        <div className="px-8 md:px-10 pt-10 pb-6">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Quản Lý Hồ Sơ &amp; Onboarding
          </h1>
          <p className="text-gray-400 text-sm mt-2">Hoàn thiện hồ sơ pháp lý để chính thức nhận việc</p>
        </div>

        {/* Quy trình */}
        <div className="px-8 md:px-10 pb-10">
          <p className="text-xl font-semibold italic text-gray-300 mb-8">
            Quy Trình Hoàn Tất Tuyển Dụng
          </p>

          <div className="space-y-8">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive  = idx === activeStep;
              const isDone    = idx < activeStep;

              return (
                <div key={idx} className="flex items-start gap-5 group">
                  {/* Step indicator */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
                      isDone
                        ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
                        : isActive
                          ? 'bg-white shadow-lg shadow-white/20'
                          : 'bg-white/10'
                    }`}>
                      {isDone
                        ? <CheckCircle className="w-5 h-5 text-white" />
                        : <Icon className={`w-5 h-5 ${isActive ? 'text-gray-900' : 'text-gray-500'}`} />
                      }
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`w-0.5 h-10 mt-2 rounded-full ${isDone ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pt-1">
                    <h3 className={`text-lg font-bold transition-colors ${
                      isDone ? 'text-emerald-400' : isActive ? 'text-white' : 'text-gray-400'
                    }`}>
                      {step.title}
                    </h3>
                    <p className={`text-sm mt-1.5 leading-relaxed max-w-lg ${
                      isActive ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-8 md:px-10 pb-8 border-t border-white/5 pt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Tiến độ hồ sơ của bạn</span>
            <span className="text-emerald-400 font-black text-lg">{calculateProgress()}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${calculateProgress()}%` }}
            />
          </div>
        </div>
      </div>

      {/* ══════ LIGHT CARD — UPLOAD HỒ SƠ ══════ */}
      <div className="bg-white rounded-lg border border-indigo-50 shadow-lg overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-50 bg-indigo-50/50/50 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Danh sách giấy tờ cần nộp</h2>
            <p className="text-xs text-gray-400">Tải lên đúng và đủ các tài liệu bên dưới</p>
          </div>
        </div>

        <div className="p-8 space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`rounded-lg border-2 transition-all p-5 ${
                doc.status === 'rejected'  ? 'border-red-200 bg-red-50/40' :
                doc.status === 'approved'  ? 'border-emerald-200 bg-emerald-50/30' :
                                             'border-indigo-50 bg-white hover:border-emerald-100'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Info */}
                <div className="flex gap-4 items-center">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                    doc.status === 'approved'  ? 'bg-emerald-100 text-emerald-600' :
                    doc.status === 'rejected'  ? 'bg-red-100 text-red-600' :
                                                 'bg-gradient-to-r from-indigo-50 to-violet-50 text-gray-400'
                  }`}>
                    {doc.status === 'approved' ? <CheckCircle className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-bold text-gray-800">{doc.name}</h5>
                      {doc.required && <span className="text-[10px] bg-red-50 text-red-500 font-bold px-2 py-0.5 rounded-full border border-red-100">BẮT BUỘC</span>}
                      {doc.status === 'approved'  && <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100">ĐÃ DUYỆT</span>}
                      {doc.status === 'rejected'  && <span className="text-[10px] bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full border border-red-100">BỊ TỪ CHỐI</span>}
                      {doc.status === 'uploaded'  && <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-100">CHỜ DUYỆT</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                    {doc.file && <p className="text-xs text-emerald-600 font-semibold mt-1">📎 {doc.file.name}</p>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {doc.status === 'pending' || doc.status === 'rejected' ? (
                    <label className="cursor-pointer bg-gray-900 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all  ">
                      <Upload className="w-4 h-4" /> Tải lên
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(doc.id, e)} accept="image/*,application/pdf" />
                    </label>
                  ) : doc.status === 'uploaded' ? (
                    <>
                      <span className="px-4 py-2 rounded-lg text-sm font-bold bg-amber-50 text-amber-700">Đang chờ duyệt</span>
                      {!aiResults[doc.id] && scanning !== doc.id && (
                        <button
                          onClick={() => runAIScan(doc.id)}
                          className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                        >
                          <ScanLine className="w-4 h-4" /> AI Scan
                        </button>
                      )}
                      {scanning === doc.id && (
                        <span className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-50 text-blue-700 flex items-center gap-1.5">
                          <Loader2 className="w-4 h-4 animate-spin" /> Đang quét...
                        </span>
                      )}
                      <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Xóa để tải lại">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <span className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-50 text-emerald-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Đã được duyệt
                    </span>
                  )}
                </div>
              </div>

              {/* Preview ảnh */}
              {previews[doc.id] && (doc.status === 'uploaded' || doc.status === 'approved') && (
                <div className="mt-4 ml-0 md:ml-16">
                  <div className="inline-block rounded-lg overflow-hidden border-2 border-indigo-50 shadow-sm">
                    <img src={previews[doc.id]} alt={doc.name} className="max-h-48 object-contain" />
                  </div>
                </div>
              )}

              {/* AI Scan Results */}
              {aiResults[doc.id] && (
                <div className="mt-4 ml-0 md:ml-16 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <ScanLine className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-blue-800">Kết quả AI Scan</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                      Độ tin cậy: {aiResults[doc.id].confidence}%
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {aiResults[doc.id].fields.map((field, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-500 font-medium">{field.key}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-800">{field.value}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            field.confidence >= 95 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {field.confidence}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback từ NTD */}
              {doc.status === 'rejected' && doc.feedback && (
                <div className="mt-4 p-4 bg-red-100/60 rounded-lg border border-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800">Phản hồi từ Nhà tuyển dụng:</p>
                    <p className="text-sm text-red-700 mt-0.5">{doc.feedback}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="px-8 pb-8">
          {submitError ? (
            <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {submitError}
            </div>
          ) : null}
          {submitNotice ? (
            <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {submitNotice}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleSubmitDocuments}
            disabled={submitting}
            className="w-full py-4 rounded-lg bg-gray-900 text-white font-black text-base hover:bg-gray-700 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            {submitting ? 'Đang gửi hồ sơ...' : 'Gửi Hồ Sơ Cho Nhà Tuyển Dụng Xét Duyệt'}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            * Sau khi gửi, Nhà tuyển dụng sẽ xem xét và phản hồi trong vòng 1–2 ngày làm việc.
          </p>
        </div>
      </div>

      {/* Support */}
      <div className="bg-white rounded-lg border border-indigo-50 p-6 flex flex-col md:flex-row items-center gap-5 shadow-sm">
        <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 shrink-0">
          <Info className="w-7 h-7" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h4 className="font-bold text-gray-800">Cần hỗ trợ?</h4>
          <p className="text-sm text-gray-500 mt-1">
            Liên hệ nhà tuyển dụng <strong>{jobInfo?.company}</strong> qua hotline hoặc nhắn tin trực tiếp trên hệ thống.
          </p>
        </div>
        <Link
          to={`/seeker/messages?applicationId=${id}`}
          className="bg-gray-900 text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-gray-700 transition-all "
        >
          Nhắn tin cho Nhà tuyển dụng
        </Link>
      </div>
    </div>
  );
}
