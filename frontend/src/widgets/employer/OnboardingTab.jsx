import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle,
  Clock,
  Loader2,
  Eye,
  FileText,
  MessageCircle,
  ChevronRight,
  AlertCircle,
  Check,
  X,
  Send,
  Users,
  Briefcase,
  Hourglass,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';
import UserAvatar from '@shared/ui/UserAvatar';

const DEFAULT_DOCUMENTS = [
  { id: 'cccd', name: 'CCCD/CMND', status: 'pending', url: null, aiData: null, feedback: '' },
  { id: 'degree', name: 'Bằng cấp/Chứng chỉ', status: 'pending', url: null, aiData: null, feedback: '' },
  { id: 'health', name: 'Giấy khám sức khỏe', status: 'pending', url: null, aiData: null, feedback: '' },
];

const DOCUMENT_LABELS = {
  cccd: 'CCCD/CMND',
  cccd_front: 'CCCD/CMND - Mặt trước',
  cccd_back: 'CCCD/CMND - Mặt sau',
  degree: 'Bằng cấp/Chứng chỉ',
  health: 'Giấy khám sức khỏe',
};

function resolveFileUrl(fileUrl) {
  if (!fileUrl) return null;
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return `${API_BASE_URL}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`;
}

function normalizeOnboardingDocuments(candidate) {
  const docs = Array.isArray(candidate.onboarding_documents)
    ? candidate.onboarding_documents
    : [];

  if (!docs.length) {
    return DEFAULT_DOCUMENTS.map((doc) => ({ ...doc }));
  }

  return docs.map((doc) => ({
    id: doc.id,
    docType: doc.doc_type,
    name: DOCUMENT_LABELS[doc.doc_type] || doc.doc_name || doc.file_name || 'Tài liệu',
    status: doc.status || 'pending',
    url: resolveFileUrl(doc.file_url),
    fileName: doc.file_name,
    aiData: doc.ai_result && Object.keys(doc.ai_result).length ? doc.ai_result : null,
    feedback: doc.feedback || '',
  }));
}

export default function OnboardingTab() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOnboardingCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/candidates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        const hiredOnboarding = (data.data || [])
          // Chỉ lấy ứng viên đã trúng tuyển
          .filter(c => c.status === 'hired' || c.status === 'onboarding')
          // Loại bỏ ứng viên thuộc tin đã ngừng tuyển (deadline đã qua hoặc status != approved)
          .filter(c => {
            const jobStatus = (c.job_status || 'approved').toLowerCase();
            if (jobStatus !== 'approved') return false;
            // Kiểm tra deadline
            if (c.job_deadline) {
              const dl = new Date(c.job_deadline);
              if (!isNaN(dl.getTime()) && dl < new Date()) return false;
            }
            return true;
          })
          .map(c => ({
            ...c,
            onboarding_status: c.onboarding_submission_id ? 'submitted' : 'waiting',
            documents: normalizeOnboardingDocuments(c),
          }));
        setCandidates(hiredOnboarding);
      }
    } catch {
      setError('Không thể tải danh sách onboarding');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchOnboardingCandidates();
  }, [token, fetchOnboardingCandidates]);

  const handleReviewDocument = async (doc, status) => {
    // If rejecting, ask for a reason
    let feedbackStr = '';
    if (status === 'rejected') {
      const reason = window.prompt(`Nhập lý do từ chối tài liệu "${doc.name}":`);
      if (reason === null) return; // User cancelled
      feedbackStr = reason;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/employer/onboarding-documents/${doc.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, feedback: feedbackStr }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Lỗi khi cập nhật tài liệu');
      }

      // Update local state immediately for better UX
      setSelectedCandidate(prev => {
        if (!prev) return prev;
        const updatedDocs = prev.documents.map(d => 
          d.id === doc.id ? { ...d, status, feedback: feedbackStr } : d
        );
        return { ...prev, documents: updatedDocs };
      });

      // Refresh the list to get full updated state from backend
      fetchOnboardingCandidates();
    } catch (error) {
      alert(error.message);
    }
  };

  // Tính progress dựa trên số tài liệu đã duyệt
  const getProgress = (docs) => {
    if (!docs || docs.length === 0) return 0;
    const approved = docs.filter(d => d.status === 'approved').length;
    return Math.round((approved / docs.length) * 100);
  };

  const getProgressColor = (progress) => {
    if (progress === 0) return 'bg-gray-300';
    if (progress < 50) return 'bg-amber-500';
    if (progress < 100) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const getOnboardingLabel = (docs, candidate) => {
    if (!docs) return { text: 'Đang chờ hồ sơ', color: 'bg-amber-100 text-amber-700' };
    const approved = docs.filter(d => d.status === 'approved').length;
    const total = docs.length;
    if (approved === total && total > 0) return { text: 'Hoàn tất', color: 'bg-emerald-100 text-emerald-700' };
    const hasReviewed = docs.some(d => d.status !== 'pending');
    if (hasReviewed) return { text: `${approved}/${total} đã duyệt`, color: 'bg-blue-100 text-blue-700' };
    // Check if docs were actually submitted (have file URLs)
    const hasSubmitted = candidate?.onboarding_status === 'submitted' || docs.some(d => d.url);
    if (hasSubmitted) return { text: 'Đã nộp - Chờ duyệt', color: 'bg-indigo-100 text-indigo-700' };
    return { text: 'Đang chờ hồ sơ', color: 'bg-amber-100 text-amber-700' };
  };

  const handleViewDocument = (doc) => {
    if (!doc.url) return;
    window.open(doc.url, '_blank', 'noopener,noreferrer');
  };

  // Search filter
  const filteredCandidates = candidates.filter(c =>
    (c.candidate_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.job_title || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm p-20 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-700 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Đang tải danh sách onboarding...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Quản Lý Hồ Sơ & Onboarding</h2>
          <p className="text-sm text-gray-500 mt-0.5">Theo dõi tiến độ hoàn thiện hồ sơ pháp lý của ứng viên trúng tuyển</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm tên hoặc vị trí..."
            className="pl-10 pr-4 py-2 border border-indigo-100/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{error}</div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ─── Left: Danh sách ─── */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-indigo-50/50/50 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ứng viên trúng tuyển</span>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{filteredCandidates.length}</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {filteredCandidates.length > 0 ? (
                filteredCandidates.map((candidate) => {
                  const progress = getProgress(candidate.documents);
                  const label = getOnboardingLabel(candidate.documents, candidate);
                  return (
                    <button
                      key={candidate.id}
                      onClick={() => setSelectedCandidate(candidate)}
                      className={`w-full text-left p-4 hover:bg-indigo-50/50 transition-colors flex items-center gap-3 ${
                        selectedCandidate?.id === candidate.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                      }`}
                    >
                      <UserAvatar
                        src={candidate.avatar_url}
                        alt={candidate.candidate_name}
                        className="w-10 h-10 rounded-full"
                        fallbackClassName="flex w-10 h-10 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
                        iconClassName="h-4 w-4 text-white"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 text-sm truncate">{candidate.candidate_name}</h4>
                        {/* FIX 2: Hiển thị tên tin tuyển dụng */}
                        <p className="text-xs text-indigo-600 font-semibold truncate flex items-center gap-1 mt-0.5">
                          <Briefcase className="w-3 h-3 shrink-0" /> {candidate.job_title}
                        </p>
                        {/* Trạng thái + Progress */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${label.color}`}>
                            {label.text}
                          </span>
                        </div>
                        <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${getProgressColor(progress)}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${selectedCandidate?.id === candidate.id ? 'text-indigo-600' : 'text-gray-300'}`} />
                    </button>
                  );
                })
              ) : (
                <div className="p-12 text-center">
                  <Hourglass className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm font-medium">
                    {searchTerm ? 'Không tìm thấy ứng viên nào.' : 'Chưa có ứng viên trúng tuyển.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Right: Chi tiết ─── */}
        <div className="lg:col-span-2">
          {selectedCandidate ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-indigo-100/60 bg-white/90 backdrop-blur-sm shadow-sm p-6">
                {/* Info */}
                <div className="flex items-center gap-4 mb-6">
                  <UserAvatar
                    src={selectedCandidate.avatar_url}
                    className="w-16 h-16 rounded-lg"
                    fallbackClassName="flex w-16 h-16 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600"
                    iconClassName="h-6 w-6 text-white"
                  />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedCandidate.candidate_name}</h3>
                    {/* FIX 2: Hiển thị tên tin tuyển dụng nổi bật */}
                    <p className="text-indigo-600 font-semibold flex items-center gap-1.5 mt-0.5">
                      <Briefcase className="w-4 h-4" /> {selectedCandidate.job_title}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3.5 h-3.5" /> Trúng tuyển ngày: {new Date(selectedCandidate.created_at).toLocaleDateString('vi-VN')}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getOnboardingLabel(selectedCandidate.documents, selectedCandidate).color}`}>
                        {getOnboardingLabel(selectedCandidate.documents, selectedCandidate).text}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="bg-gradient-to-br from-indigo-50/40 to-violet-50/30 rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-bold text-indigo-700">Tiến độ hoàn thiện hồ sơ</span>
                    <span className="text-lg font-black text-indigo-700">{getProgress(selectedCandidate.documents)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-700"
                      style={{ width: `${getProgress(selectedCandidate.documents)}%` }}
                    />
                  </div>
                </div>

                {/* Documents */}
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" /> Danh mục hồ sơ pháp lý
                </h4>
                <div className="space-y-3">
                  {selectedCandidate.documents.map((doc) => (
                    <div key={doc.id} className="group rounded-xl border border-indigo-100/60 hover:border-indigo-200 hover:shadow-sm transition-all bg-white overflow-hidden">
                      {/* Image preview */}
                      {doc.url ? (
                        <div className="w-full bg-gray-50 flex items-center justify-center overflow-hidden" style={{ maxHeight: 280 }}>
                          <img
                            src={doc.url}
                            alt={doc.name}
                            className="w-full object-contain"
                            style={{ maxHeight: 280 }}
                          />
                        </div>
                      ) : (
                        <div className="w-full py-8 bg-gray-50 flex items-center justify-center text-gray-300">
                          <FileText className="w-8 h-8 mr-2 opacity-40" />
                          <span className="text-sm italic">Chưa nộp tài liệu</span>
                        </div>
                      )}

                      {/* Info bar */}
                      <div className="flex items-center justify-between gap-4 p-4">
                        <div>
                          <span className="text-sm font-bold text-gray-800">{doc.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                          'bg-amber-100 text-amber-700'
                            }`}>
                              {doc.status === 'approved' ? 'Đã duyệt' : doc.status === 'rejected' ? 'Bị từ chối' : 'Đang chờ'}
                            </span>
                          </div>
                        </div>

                        {doc.url && doc.status === 'pending' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleViewDocument(doc)}
                              className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                              title="Xem tài liệu"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleReviewDocument(doc, 'approved')}
                              className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Duyệt">
                              <Check className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleReviewDocument(doc, 'rejected')}
                              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Từ chối">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Feedback */}
                      {(doc.feedback || doc.status === 'rejected') && (
                        <div className="mx-4 mb-4 p-3 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700 font-medium">{doc.feedback || 'Yêu cầu tải lên lại tài liệu hợp lệ.'}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Feedback Section */}
                <div className="mt-8 border-t border-indigo-50 pt-6">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-cyan-600" /> Nhắn tin & Hướng dẫn cho ứng viên
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Nhập yêu cầu bổ sung hoặc lời chào mừng..."
                      className="flex-1 px-4 py-3 border border-indigo-100/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                    />
                    <button className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-3 rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all  active:scale-95">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 italic">* Tin nhắn sẽ được gửi qua Email và thông báo trên hệ thống.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full bg-white/90 backdrop-blur-sm rounded-2xl border border-dashed border-indigo-200/60 flex flex-col items-center justify-center p-20 text-center">
              <div className="w-20 h-20 bg-indigo-50/50 rounded-full flex items-center justify-center mb-4">
                <Users className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-400">Chọn một ứng viên</h3>
              <p className="text-sm text-gray-400 max-w-xs mt-2">Chọn ứng viên từ danh sách bên trái để quản lý hồ sơ và tiến trình Onboarding.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
