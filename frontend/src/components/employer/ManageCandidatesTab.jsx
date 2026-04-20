import React, { useState, useEffect, useCallback } from 'react';
import { Search, Mail, Phone, Eye, MoreHorizontal, CheckCircle, Loader2, Briefcase, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageCandidatesTab() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStage, setActiveStage] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  
  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch('/api/employer/candidates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCandidates(data.data || []);
      } else {
        setError(data.error || 'Lỗi khi tải danh sách ứng viên');
      }
    } catch (err) {
      console.error('Fetch candidates error:', err);
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchCandidates();
  }, [token, fetchCandidates]);

  const handleStatusUpdate = async (applicationId, newStatus) => {
    setActionLoading(applicationId);
    try {
      const res = await fetch(`/api/employer/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchCandidates(); // Refresh list
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi cập nhật trạng thái');
      }
    } catch {
      alert('Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const stages = [
    { id: 'all', label: 'Tất cả', count: candidates.length },
    { id: 'pending', label: 'Chờ xử lý', count: candidates.filter(c => c.status === 'pending' || !c.status).length },
    { id: 'interview', label: 'Phỏng vấn', count: candidates.filter(c => c.status === 'interview').length },
    { id: 'hired', label: 'Đã tuyển', count: candidates.filter(c => c.status === 'hired').length },
    { id: 'rejected', label: 'Từ chối', count: candidates.filter(c => c.status === 'rejected').length },
  ];

  const getStatusLabel = (status) => {
    switch (status) {
      case 'interview': return { label: 'Phỏng vấn', class: 'bg-blue-100 text-blue-700' };
      case 'hired': return { label: 'Đã tuyển', class: 'bg-emerald-100 text-emerald-700' };
      case 'rejected': return { label: 'Từ chối', class: 'bg-red-100 text-red-700' };
      default: return { label: 'Chờ xử lý', class: 'bg-amber-100 text-amber-700' };
    }
  };

  if (loading) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 text-navy-700 animate-spin mb-4" />
      <p className="text-gray-500 font-medium">Đang tải danh sách ứng viên...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Pipeline Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
        {stages.map(stage => (
          <button
            key={stage.id}
            onClick={() => setActiveStage(stage.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeStage === stage.id 
                ? 'bg-navy-700 text-white shadow-md' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {stage.label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeStage === stage.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
            }`}>
              {stage.count}
            </span>
          </button>
        ))}
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{error}</div>}

      {/* Candidate List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
        {candidates.filter(c => activeStage === 'all' || (c.status || 'pending') === activeStage).length > 0 ? (
          candidates.filter(c => activeStage === 'all' || (c.status || 'pending') === activeStage).map((c) => {
            const status = getStatusLabel(c.status);
            return (
              <div key={c.id} className="p-6 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex gap-4 items-center">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt={c.candidate_name} className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-navy-500 to-navy-700 flex items-center justify-center text-white font-bold text-xl ring-2 ring-gray-100">
                      {c.candidate_name?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-800 text-lg">{c.candidate_name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.class}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-navy-600 font-semibold mb-2">
                      <Briefcase className="w-4 h-4" /> {c.job_title}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {c.candidate_email}</span>
                      {c.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {c.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4 w-full lg:w-auto">
                  <div className="text-xs text-gray-400 font-medium">
                    Ứng tuyển: {new Date(c.created_at).toLocaleDateString('vi-VN')}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {actionLoading === c.id ? (
                      <div className="px-8 py-2"><Loader2 className="w-5 h-5 animate-spin text-navy-600" /></div>
                    ) : (
                      <>
                        <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
                          <Eye className="w-4 h-4" /> Hồ sơ
                        </button>
                        
                        {c.status !== 'interview' && c.status !== 'hired' && (
                          <button onClick={() => handleStatusUpdate(c.id, 'interview')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors">
                            <Clock className="w-4 h-4" /> Phỏng vấn
                          </button>
                        )}
                        
                        {c.status !== 'hired' && (
                          <button onClick={() => handleStatusUpdate(c.id, 'hired')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors">
                            <CheckCircle className="w-4 h-4" /> Tuyển
                          </button>
                        )}
                        
                        {c.status !== 'rejected' && (
                          <button onClick={() => handleStatusUpdate(c.id, 'rejected')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">
                            <XCircle className="w-4 h-4" /> Từ chối
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">Không có ứng viên nào trong danh sách.</p>
          </div>
        )}
      </div>
    </div>
  );
}
