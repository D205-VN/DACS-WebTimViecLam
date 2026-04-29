import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Loader2, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import API_BASE_URL from '@shared/api/baseUrl';

const API = `${API_BASE_URL}/api/verification`;

function formatDateTime(value) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function resolvePublicUrl(publicUrl, verificationCode) {
  const basePath = publicUrl || `/verify/${verificationCode}`;
  if (/^https?:\/\//i.test(basePath)) return basePath;
  if (typeof window === 'undefined') return basePath;
  return `${window.location.origin}${basePath.startsWith('/') ? basePath : `/${basePath}`}`;
}

function StatusRow({ label, ok }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" />}
        {ok ? 'Hợp lệ' : 'Không khớp'}
      </span>
    </div>
  );
}

export default function VerificationPublicPage() {
  const { code } = useParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;

    async function loadVerification() {
      setLoading(true);
      setError('');
      setNotice('');

      try {
        const res = await fetch(`${API}/public/${encodeURIComponent(code || '')}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Không thể kiểm tra mã xác thực');
        if (active) {
          setPayload(data.data || null);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
          setPayload(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadVerification();

    return () => {
      active = false;
    };
  }, [code]);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Đã sao chép link xác thực.');
    } catch {
      setError('Không thể sao chép mã xác thực');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Quay lại trang chủ
      </Link>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-navy-600" />
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-10 text-center text-red-600">
          <ShieldAlert className="mx-auto h-10 w-10" />
          <p className="mt-4 text-base font-semibold">{error}</p>
        </div>
      ) : payload ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${payload.is_block_valid && payload.is_linked_to_previous ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {payload.is_block_valid && payload.is_linked_to_previous ? <ShieldCheck className="h-7 w-7" /> : <ShieldX className="h-7 w-7" />}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Blockchain Verification</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {payload.asset?.type === 'cv'
                      ? 'CV đã được ghi nhận trên blockchain ledger nội bộ.'
                      : payload.asset?.type === 'certificate'
                        ? 'Chứng chỉ đã được ghi nhận trên blockchain ledger nội bộ.'
                        : 'Lịch sử làm việc đã được ghi nhận trên blockchain ledger nội bộ.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(resolvePublicUrl(payload.public_url, payload.verification_code))}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Copy className="h-4 w-4" /> Sao chép link
                </button>
                <a
                  href={resolvePublicUrl(payload.public_url, payload.verification_code)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4" /> Link public
                </a>
              </div>
            </div>

            {notice ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <StatusRow label="Hash block hợp lệ" ok={payload.is_block_valid} />
              <StatusRow label="Liên kết với block trước hợp lệ" ok={payload.is_linked_to_previous} />
              <StatusRow label="Khớp với dữ liệu hiện tại" ok={payload.matches_current_record} />
              <StatusRow label="Đang là version mới nhất" ok={payload.is_latest_version} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-800">Thông tin tài sản</h2>
              <div className="mt-4 space-y-3 text-sm text-gray-600">
                <p><span className="font-semibold text-gray-800">Loại:</span> {payload.asset_type}</p>
                <p><span className="font-semibold text-gray-800">Mã xác thực:</span> <span className="font-mono break-all">{payload.verification_code}</span></p>
                <p><span className="font-semibold text-gray-800">Chủ sở hữu:</span> {payload.asset?.owner_name || payload.metadata?.owner_name || 'Chưa công khai'}</p>
                {payload.asset?.title ? <p><span className="font-semibold text-gray-800">Tiêu đề CV:</span> {payload.asset.title}</p> : null}
                {payload.asset?.target_role ? <p><span className="font-semibold text-gray-800">Vị trí:</span> {payload.asset.target_role}</p> : null}
                {payload.asset?.current_location ? <p><span className="font-semibold text-gray-800">Khu vực:</span> {payload.asset.current_location}</p> : null}
                {payload.asset?.certificate_name ? <p><span className="font-semibold text-gray-800">Chứng chỉ:</span> {payload.asset.certificate_name}</p> : null}
                {payload.asset?.issuer_name ? <p><span className="font-semibold text-gray-800">Đơn vị cấp:</span> {payload.asset.issuer_name}</p> : null}
                {payload.asset?.credential_id ? <p><span className="font-semibold text-gray-800">Credential ID:</span> {payload.asset.credential_id}</p> : null}
                {payload.asset?.company_name ? <p><span className="font-semibold text-gray-800">Công ty:</span> {payload.asset.company_name}</p> : null}
                {payload.asset?.job_title ? <p><span className="font-semibold text-gray-800">Chức danh:</span> {payload.asset.job_title}</p> : null}
                {payload.asset?.status ? <p><span className="font-semibold text-gray-800">Trạng thái tài sản:</span> {payload.asset.status}</p> : null}
                <p><span className="font-semibold text-gray-800">Thời điểm ghi nhận:</span> {formatDateTime(payload.verified_at)}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-800">Dấu vết chuỗi</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Block hash</p>
                  <p className="mt-2 break-all rounded-2xl bg-gray-50 px-4 py-3 font-mono text-xs text-gray-600">{payload.block_hash}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Previous hash</p>
                  <p className="mt-2 break-all rounded-2xl bg-gray-50 px-4 py-3 font-mono text-xs text-gray-600">{payload.previous_hash || 'Genesis block'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Payload hash</p>
                  <p className="mt-2 break-all rounded-2xl bg-gray-50 px-4 py-3 font-mono text-xs text-gray-600">{payload.payload_hash}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Block index</p>
                  <p className="mt-2 text-sm font-semibold text-gray-700">#{payload.block_index}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
