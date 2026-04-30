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
    desc: 'HR kiểm tra và xác nhận hồ sơ hợp lệ, hoàn tất quá trình nhận việc một cách chuyên nghiệp.',
  },
];

export default function OnboardingPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobInfo, setJobInfo] = useState(null);
  const [activeStep, setActiveStep] = useState(1); // 0, 1, 2
  const [documents, setDocuments] = useState([
    { id: 'cccd',   name: 'CCCD/CMND (Mặt trước & sau)',  status: 'pending',  required: true,  description: 'Hình ảnh rõ nét, không mất góc',     file: null, feedback: '' },
    { id: 'degree', name: 'Bằng tốt nghiệp / Chứng chỉ',  status: 'pending',  required: true,  description: 'Bản sao công chứng hoặc bản chính',  file: null, feedback: '' },
    { id: 'health', name: 'Giấy khám sức khỏe',            status: 'rejected', required: false, description: 'Thời hạn không quá 6 tháng',         file: null, feedback: 'Ảnh chụp bị mờ, vui lòng chụp lại rõ hơn.' },
  ]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // TODO: thay bằng API thật
        setJobInfo({ title: 'Senior Frontend Developer', company: 'FPT Software', hiredDate: '28/04/2026' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, token]);

  const calculateProgress = () => {
    const approved = documents.filter(d => d.status === 'approved').length;
    return Math.round((approved / documents.length) * 100);
  };

  const handleFileUpload = (docId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, file, status: 'uploaded' } : d));
  };

  const handleDelete = (docId) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, file: null, status: 'pending', feedback: '' } : d));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
        className="rounded-3xl overflow-hidden shadow-2xl"
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
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
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
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-700"
              style={{ width: `${calculateProgress()}%` }}
            />
          </div>
        </div>
      </div>

      {/* ══════ LIGHT CARD — UPLOAD HỒ SƠ ══════ */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
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
              className={`rounded-2xl border-2 transition-all p-5 ${
                doc.status === 'rejected'  ? 'border-red-200 bg-red-50/40' :
                doc.status === 'approved'  ? 'border-emerald-200 bg-emerald-50/30' :
                                             'border-gray-100 bg-white hover:border-emerald-100'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Info */}
                <div className="flex gap-4 items-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    doc.status === 'approved'  ? 'bg-emerald-100 text-emerald-600' :
                    doc.status === 'rejected'  ? 'bg-red-100 text-red-600' :
                                                 'bg-gray-100 text-gray-400'
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
                    <label className="cursor-pointer bg-gray-900 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95">
                      <Upload className="w-4 h-4" /> Tải lên
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(doc.id, e)} accept="image/*,application/pdf" />
                    </label>
                  ) : doc.status === 'uploaded' ? (
                    <>
                      <span className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-50 text-amber-700">Đang chờ HR duyệt</span>
                      <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Xóa để tải lại">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <span className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Đã được duyệt
                    </span>
                  )}
                </div>
              </div>

              {/* HR Feedback */}
              {doc.status === 'rejected' && doc.feedback && (
                <div className="mt-4 p-4 bg-red-100/60 rounded-xl border border-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800">Phản hồi từ HR:</p>
                    <p className="text-sm text-red-700 mt-0.5">{doc.feedback}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="px-8 pb-8">
          <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-gray-800 to-gray-900 text-white font-black text-base hover:from-gray-700 hover:to-gray-800 transition-all shadow-xl active:scale-[0.99] flex items-center justify-center gap-3">
            <ShieldCheck className="w-5 h-5" />
            Gửi Hồ Sơ Cho HR Xét Duyệt
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            * Sau khi gửi, HR sẽ xem xét và phản hồi trong vòng 1–2 ngày làm việc.
          </p>
        </div>
      </div>

      {/* Support */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col md:flex-row items-center gap-5 shadow-sm">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500 shrink-0">
          <Info className="w-7 h-7" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h4 className="font-bold text-gray-800">Cần hỗ trợ?</h4>
          <p className="text-sm text-gray-500 mt-1">
            Liên hệ bộ phận nhân sự <strong>{jobInfo?.company}</strong> qua hotline hoặc nhắn tin trực tiếp trên hệ thống.
          </p>
        </div>
        <button className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-gray-700 transition-all shadow-md">
          Nhắn tin cho HR
        </button>
      </div>
    </div>
  );
}
