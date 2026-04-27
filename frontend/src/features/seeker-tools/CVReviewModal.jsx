import { AlertCircle, CheckCircle2, Lightbulb, Loader2, Sparkles, X } from 'lucide-react';

const priorityMeta = {
  high: { label: 'Ưu tiên cao', className: 'bg-red-50 text-red-700 border-red-100' },
  medium: { label: 'Nên sửa', className: 'bg-amber-50 text-amber-700 border-amber-100' },
  low: { label: 'Tối ưu thêm', className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export default function CVReviewModal({
  open = true,
  title = 'Gợi ý sửa CV',
  loading = false,
  applyingIndex = null,
  applyStates = {},
  applyErrors = {},
  error = '',
  applyMessage = '',
  review = null,
  onClose,
  onApplySuggestion,
}) {
  if (!open) return null;

  const suggestions = review?.suggestions || [];
  const strengths = review?.strengths || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AI Review</p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-auto p-6">
          {loading ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-slate-500">
              <Loader2 className="mb-3 h-9 w-9 animate-spin text-navy-600" />
              <p className="text-sm font-medium">Đang phân tích CV...</p>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : review ? (
            <div className="space-y-6">
              {applyMessage ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">{applyMessage}</p>
                </div>
              ) : null}

              <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Đánh giá tổng quan</p>
                  <p className="mt-2 text-sm leading-6 text-blue-950">{review.summary}</p>
                </div>
                <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-white text-navy-700 shadow-sm">
                  <Sparkles className="h-5 w-5" />
                  <span className="mt-1 text-2xl font-bold">{review.score ?? '--'}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">điểm</span>
                </div>
              </div>

              {strengths.length > 0 ? (
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Điểm ổn
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {strengths.map((item, index) => (
                      <div key={index} className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Lightbulb className="h-4 w-4 text-amber-500" /> Chỗ cần sửa
                </h4>
                <div className="space-y-3">
                  {suggestions.map((item, index) => {
                    const meta = priorityMeta[item.priority] || priorityMeta.medium;
                    const applyState = applyStates[index] || 'idle';
                    const applyError = applyErrors[index] || '';
                    const isApplying = applyingIndex === index;
                    const isDone = applyState === 'done';
                    const isFailed = applyState === 'error';
                    const isBusyElsewhere = applyingIndex !== null && !isApplying;
                    const applyButtonClass = isDone
                      ? 'bg-emerald-600 text-white'
                      : isFailed
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-navy-600 text-white hover:bg-navy-700';
                    const applyButtonIcon = isApplying
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : isDone
                        ? <CheckCircle2 className="h-4 w-4" />
                        : isFailed
                          ? <AlertCircle className="h-4 w-4" />
                          : <Sparkles className="h-4 w-4" />;
                    const applyButtonLabel = isApplying
                      ? 'Đang sửa...'
                      : isDone
                        ? 'Hoàn tất'
                        : isFailed
                          ? 'Sửa lại'
                          : 'Sửa CV';

                    return (
                      <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{item.section || 'CV'}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800">{item.issue}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.suggestion}</p>
                        {item.example ? (
                          <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                            <span className="font-semibold text-slate-900">Ví dụ: </span>{item.example}
                          </div>
                        ) : null}
                        {applyError ? (
                          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{applyError}</span>
                          </div>
                        ) : null}
                        {onApplySuggestion ? (
                          <button
                            type="button"
                            onClick={() => onApplySuggestion(item, index)}
                            disabled={isBusyElsewhere || isDone}
                            className={`mt-3 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${applyButtonClass}`}
                          >
                            {applyButtonIcon}
                            {applyButtonLabel}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
