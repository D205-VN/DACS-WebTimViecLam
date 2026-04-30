import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle,
  Clock,
  Loader2,
  Eye,
  FileText,
  MessageCircle,
  ScanLine,
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

export default function OnboardingTab() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [scanning, setScanning] = useState(false);
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
            // Tất cả ứng viên mới hired → hồ sơ đều "Đang chờ" (chưa nộp)
            onboarding_status: 'waiting',
            documents: [
              { id: 'cccd',   name: 'CCCD/CMND',           status: 'pending', url: null, aiData: null, feedback: '' },
              { id: 'degree', name: 'Bằng cấp/Chứng chỉ',  status: 'pending', url: null, aiData: null, feedback: '' },
              { id: 'health', name: 'Giấy khám sức khỏe',   status: 'pending', url: null, aiData: null, feedback: '' },
            ],
          }));
        setCandidates(hiredOnboarding);
      }
    } catch (err) {
      setError('Không thể tải danh sách onboarding');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchOnboardingCandidates();
  }, [token, fetchOnboardingCandidates]);

  const handleAIScan = (docId) => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      alert('AI đã quét xong tài liệu!\nKết quả: Họ tên khớp 100%, Số CCCD: 012345678xxx');
    }, 2000);
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

  const getOnboardingLabel = (docs) => {
    if (!docs) return { text: 'Đang chờ hồ sơ', color: 'bg-amber-100 text-amber-700' };
    const approved = docs.filter(d => d.status === 'approved').length;
    const total = docs.length;
    if (approved === total) return { text: 'Hoàn tất', color: 'bg-emerald-100 text-emerald-700' };
    const hasAny = docs.some(d => d.status !== 'pending');
    if (hasAny) return { text: `${approved}/${total} đã duyệt`, color: 'bg-blue-100 text-blue-700' };
    return { text: 'Đang chờ hồ sơ', color: 'bg-amber-100 text-amber-700' };
  };

  // Search filter
  const filteredCandidates = candidates.filter(c =>
    (c.candidate_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.job_title || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-navy-700 animate-spin mb-4" />
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
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20 w-64"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{error}</div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ─── Left: Danh sách ─── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ứng viên trúng tuyển</span>
              <span className="text-xs font-bold text-navy-600 bg-navy-50 px-2 py-0.5 rounded-full">{filteredCandidates.length}</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {filteredCandidates.length > 0 ? (
                filteredCandidates.map((candidate) => {
                  const progress = getProgress(candidate.documents);
                  const label = getOnboardingLabel(candidate.documents);
                  return (
                    <button
                      key={candidate.id}
                      onClick={() => setSelectedCandidate(candidate)}
                      className={`w-full text-left p-4 hover:bg-navy-50/50 transition-colors flex items-center gap-3 ${
                        selectedCandidate?.id === candidate.id ? 'bg-navy-50 border-l-4 border-navy-600' : ''
                      }`}
                    >
                      <UserAvatar
                        src={candidate.avatar_url}
                        alt={candidate.candidate_name}
                        className="w-10 h-10 rounded-full"
                        fallbackClassName="flex w-10 h-10 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700"
                        iconClassName="h-4 w-4 text-white"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 text-sm truncate">{candidate.candidate_name}</h4>
                        {/* FIX 2: Hiển thị tên tin tuyển dụng */}
                        <p className="text-xs text-navy-600 font-semibold truncate flex items-center gap-1 mt-0.5">
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
                      <ChevronRight className={`w-4 h-4 shrink-0 ${selectedCandidate?.id === candidate.id ? 'text-navy-600' : 'text-gray-300'}`} />
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
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                {/* Info */}
                <div className="flex items-center gap-4 mb-6">
                  <UserAvatar
                    src={selectedCandidate.avatar_url}
                    className="w-16 h-16 rounded-2xl"
                    fallbackClassName="flex w-16 h-16 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-500 to-navy-700"
                    iconClassName="h-6 w-6 text-white"
                  />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedCandidate.candidate_name}</h3>
                    {/* FIX 2: Hiển thị tên tin tuyển dụng nổi bật */}
                    <p className="text-navy-600 font-semibold flex items-center gap-1.5 mt-0.5">
                      <Briefcase className="w-4 h-4" /> {selectedCandidate.job_title}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3.5 h-3.5" /> Trúng tuyển ngày: {new Date(selectedCandidate.created_at).toLocaleDateString('vi-VN')}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getOnboardingLabel(selectedCandidate.documents).color}`}>
                        {getOnboardingLabel(selectedCandidate.documents).text}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="bg-navy-50/50 rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-bold text-navy-700">Tiến độ hoàn thiện hồ sơ</span>
                    <span className="text-lg font-black text-navy-700">{getProgress(selectedCandidate.documents)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-navy-500 to-navy-700 transition-all duration-700"
                      style={{ width: `${getProgress(selectedCandidate.documents)}%` }}
                    />
                  </div>
                </div>

                {/* Documents */}
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-navy-600" /> Danh mục hồ sơ pháp lý
                </h4>
                <div className="space-y-3">
                  {selectedCandidate.documents.map((doc) => (
                    <div key={doc.id} className="group p-4 rounded-xl border border-gray-100 hover:border-navy-200 hover:shadow-md transition-all bg-white">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            doc.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                            doc.status === 'rejected' ? 'bg-red-50 text-red-600' :
                                                        'bg-amber-50 text-amber-600'
                          }`}>
                            <FileText className="w-5 h-5" />
                          </div>
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
                              {doc.aiData && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <ScanLine className="w-3 h-3" /> AI Verified
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* AI Scan */}
                          {doc.url && doc.status === 'pending' && (
                            <button
                              onClick={() => handleAIScan(doc.id)}
                              disabled={scanning}
                              className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                            >
                              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                              AI Scan
                            </button>
                          )}

                          {doc.url ? (
                            <button className="p-2 hover:bg-navy-50 text-navy-600 rounded-lg transition-colors" title="Xem tài liệu">
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Chưa nộp</span>
                          )}

                          {doc.url && (
                            <div className="flex gap-1 ml-2 pl-2 border-l border-gray-100">
                              <button className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Duyệt">
                                <Check className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Từ chối">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Feedback */}
                      {(doc.feedback || doc.status === 'rejected') && (
                        <div className="mt-3 ml-11 p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700 font-medium">{doc.feedback || 'Yêu cầu tải lên lại tài liệu hợp lệ.'}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Feedback Section */}
                <div className="mt-8 border-t border-gray-100 pt-6">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-cyan-600" /> Nhắn tin & Hướng dẫn cho ứng viên
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Nhập yêu cầu bổ sung hoặc lời chào mừng..."
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20 shadow-sm"
                    />
                    <button className="bg-navy-700 text-white p-3 rounded-xl hover:bg-navy-800 transition-all shadow-md active:scale-95">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 italic">* Tin nhắn sẽ được gửi qua Email và thông báo trên hệ thống.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full bg-white rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center p-20 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
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
