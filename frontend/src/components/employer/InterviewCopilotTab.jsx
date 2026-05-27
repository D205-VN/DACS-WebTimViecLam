import { useEffect, useMemo, useState } from 'react';
import { Bot, ClipboardCheck, Loader2, Save, Star, UserCheck } from 'lucide-react';
import { talentInsightsApi } from '@services/talent-insights/talentInsightsApi';
import UserAvatar from '@components/ui/UserAvatar';

const DEFAULT_RATINGS = {
  technical: 3,
  problem_solving: 3,
  communication: 3,
  culture_fit: 3,
};

const RATING_FIELDS = [
  { key: 'technical', label: 'Chuyên môn' },
  { key: 'problem_solving', label: 'Xử lý vấn đề' },
  { key: 'communication', label: 'Giao tiếp' },
  { key: 'culture_fit', label: 'Phù hợp văn hóa' },
];

const RECOMMENDATION_LABELS = {
  strong_yes: 'Rất nên tuyển',
  yes: 'Nên tuyển',
  consider: 'Cân nhắc thêm',
  no: 'Chưa phù hợp',
};

function formatDateTime(value) {
  if (!value) return 'Chưa có lịch';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Chưa có lịch';
  return parsed.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getAverageRating(ratings = DEFAULT_RATINGS) {
  const values = RATING_FIELDS.map((field) => Number(ratings[field.key] || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.length ? (total / values.length).toFixed(1) : '0.0';
}

function RatingInput({ label, value, onChange }) {
  return (
    <label className="block rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-indigo-700">{value}/5</span>
      </span>
      <input
        type="range"
        min="1"
        max="5"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-indigo-600"
      />
    </label>
  );
}

export default function InterviewCopilotTab() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({
    ratings: DEFAULT_RATINGS,
    strengths: '',
    concerns: '',
    recommendation: 'consider',
    feedback_to_candidate: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    talentInsightsApi.getEmployerInterviews()
      .then((payload) => {
        const data = payload.data || [];
        setItems(data);
        if (data[0]) setSelectedId(data[0].application_id);
      })
      .catch((err) => setError(err.message || 'Không thể tải danh sách phỏng vấn'))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => items.find((item) => String(item.application_id) === String(selectedId)) || null,
    [items, selectedId]
  );

  useEffect(() => {
    if (!selected) return;
    setForm({
      ratings: { ...DEFAULT_RATINGS, ...(selected.ratings || {}) },
      strengths: selected.strengths || '',
      concerns: selected.concerns || '',
      recommendation: selected.recommendation || 'consider',
      feedback_to_candidate: selected.feedback_to_candidate || '',
    });
    setNotice('');
  }, [selected]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await talentInsightsApi.saveInterviewEvaluation(selected.application_id, form);
      setItems((prev) => prev.map((item) => (
        String(item.application_id) === String(selected.application_id)
          ? {
              ...item,
              evaluation_id: saved.id,
              ratings: saved.ratings,
              strengths: saved.strengths,
              concerns: saved.concerns,
              recommendation: saved.recommendation,
              feedback_to_candidate: saved.feedback_to_candidate,
              evaluated_at: saved.updated_at,
            }
          : item
      )));
      setNotice('Đã lưu đánh giá phỏng vấn.');
    } catch (err) {
      setError(err.message || 'Không thể lưu đánh giá');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="aw-surface p-10 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="aw-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Đánh giá phỏng vấn</h2>
              <p className="text-sm text-slate-500">Chấm ứng viên sau phỏng vấn và lưu phản hồi cuối cùng.</p>
            </div>
          </div>
          <div className="grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-3">
            <span className="rounded-lg bg-slate-50 px-3 py-2">1. Chọn ứng viên</span>
            <span className="rounded-lg bg-slate-50 px-3 py-2">2. Chấm 4 tiêu chí</span>
            <span className="rounded-lg bg-slate-50 px-3 py-2">3. Lưu kết quả</span>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="aw-surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Lịch phỏng vấn</p>
              <p className="text-xs text-slate-400">{items.length} hồ sơ cần theo dõi</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <Bot className="h-5 w-5" />
            </div>
          </div>
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có ứng viên ở giai đoạn phỏng vấn.</div>
          ) : (
            <div className="max-h-[620px] divide-y divide-slate-100 overflow-y-auto">
              {items.map((item) => {
                const active = String(selectedId) === String(item.application_id);
                return (
                  <button
                    key={item.application_id}
                    type="button"
                    onClick={() => setSelectedId(item.application_id)}
                    className={`flex w-full items-start gap-3 p-3 text-left transition ${active ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <UserAvatar
                      src={item.avatar_url}
                      alt={item.full_name || 'Ứng viên'}
                      className="h-9 w-9 rounded-lg object-cover"
                      fallbackClassName="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
                      iconClassName="h-5 w-5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{item.full_name}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">{item.job_title}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.interview_at)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${item.evaluation_id ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.evaluation_id ? 'Đã chấm' : 'Chờ chấm'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="aw-surface p-5">
          {selected ? (
            <div>
              <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">Phiếu đánh giá</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{selected.full_name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selected.job_title} · {selected.company_name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-800">
                    <Star className="h-4 w-4 text-indigo-600" /> {getAverageRating(form.ratings)}/5
                  </span>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${selected.evaluation_id ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {selected.evaluation_id ? 'Đã đánh giá' : 'Chưa đánh giá'}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {RATING_FIELDS.map((field) => (
                  <RatingInput
                    key={field.key}
                    label={field.label}
                    value={form.ratings[field.key]}
                    onChange={(value) => setForm((prev) => ({ ...prev, ratings: { ...prev.ratings, [field.key]: value } }))}
                  />
                ))}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Điểm mạnh nội bộ</span>
                  <textarea value={form.strengths} onChange={(event) => setForm((prev) => ({ ...prev, strengths: event.target.value }))} rows={5} className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-violet-100" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Rủi ro cần làm rõ</span>
                  <textarea value={form.concerns} onChange={(event) => setForm((prev) => ({ ...prev, concerns: event.target.value }))} rows={5} className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-violet-100" />
                </label>
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-semibold text-slate-700">Khuyến nghị</span>
                <select value={form.recommendation} onChange={(event) => setForm((prev) => ({ ...prev, recommendation: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-violet-100">
                  {Object.entries(RECOMMENDATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="mt-5 block">
                <span className="text-sm font-semibold text-slate-700">Phản hồi gửi ứng viên</span>
                <textarea value={form.feedback_to_candidate} onChange={(event) => setForm((prev) => ({ ...prev, feedback_to_candidate: event.target.value }))} rows={5} className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-violet-100" />
              </label>

              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-indigo-900">
                  <p className="font-bold">Kết luận: {RECOMMENDATION_LABELS[form.recommendation]}</p>
                  <p className="mt-1 text-indigo-700/80">Điểm trung bình {getAverageRating(form.ratings)}/5</p>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu đánh giá
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-slate-500">
              <UserCheck className="h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm">Chọn một ứng viên để bắt đầu đánh giá.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
