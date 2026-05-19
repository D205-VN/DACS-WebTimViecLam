import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, Loader2, Send, Sparkles, Target } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import { talentInsightsApi } from '@shared/api/talentInsightsApi';
import { getJobDetailRoute } from '@shared/utils/roleRedirect';

const MIN_ANSWER_LENGTH = 5;

export default function WorkSimulationPage() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const [scenario, setScenario] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      talentInsightsApi.getWorkSimulationForJob(jobId),
      talentInsightsApi.getLatestWorkSimulation(jobId),
    ])
      .then(([scenarioResult, latestResult]) => {
        if (!mounted) return;
        if (scenarioResult.status === 'fulfilled') setScenario(scenarioResult.value.scenario);
        else setError(scenarioResult.reason?.message || 'Không thể tải Mini Work Simulation');

        if (latestResult.status === 'fulfilled' && latestResult.value?.data) {
          setResult({
            score: Number(latestResult.value.data.score || 0),
            feedback: latestResult.value.data.feedback || {},
          });
          setAnswer(latestResult.value.data.answer || '');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [jobId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const data = await talentInsightsApi.submitWorkSimulation(jobId, { answer, scenario });
      setResult({ score: data.score, feedback: data.feedback });
    } catch (err) {
      setError(err.message || 'Không thể chấm bài simulation');
    } finally {
      setSubmitting(false);
    }
  };

  const trimmedAnswerLength = answer.trim().length;
  const canSubmit = trimmedAnswerLength >= MIN_ANSWER_LENGTH && !submitting;

  if (loading) {
    return (
      <div className="aw-container py-16">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="aw-container max-w-5xl py-6">
      <Link to={getJobDetailRoute(user?.role_code, jobId)} className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-indigo-700">
        <ArrowLeft className="h-4 w-4" /> Quay lại tin tuyển dụng
      </Link>

      <section className="aw-surface p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-600 text-white">
            <BriefcaseBusiness className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-600">Mini Work Simulation</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">{scenario?.title || 'Bài mô phỏng công việc'}</h1>
            <p className="mt-1 text-sm text-slate-500">{scenario?.job?.company_name || 'Nhà tuyển dụng'}</p>
          </div>
        </div>
      </section>

      {error ? <div className="mt-5 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <section className="aw-surface p-5">
          <div className="rounded-lg bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
            {scenario?.prompt}
          </div>
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={13}
            placeholder="Viết phương án xử lý của bạn. Nên có mục tiêu, các bước, rủi ro, chỉ số đo lường..."
            className="mt-5 w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">{answer.length} ký tự</p>
              {trimmedAnswerLength < MIN_ANSWER_LENGTH ? (
                <p className="mt-1 text-xs text-amber-600">Nhập ít nhất {MIN_ANSWER_LENGTH} ký tự để chấm bài.</p>
              ) : answer.trim().length < 80 ? (
                <p className="mt-1 text-xs text-slate-500">Câu trả lời ngắn vẫn chấm được, nhưng điểm có thể thấp.</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-cyan-700 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Chấm bài
            </button>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="aw-surface p-5">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-cyan-600" />
              <h2 className="text-lg font-bold text-slate-900">Tiêu chí chấm</h2>
            </div>
            <div className="mt-4 space-y-2">
              {(scenario?.expected_points || []).map((point) => (
                <div key={point} className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">{point}</div>
              ))}
            </div>
          </section>

          <section className="aw-surface p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Kết quả</h2>
            </div>
            {result ? (
              <div className="mt-4">
                <p className="text-4xl font-black text-emerald-600">{Math.round(result.score)}%</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{result.feedback?.summary}</p>
                <div className="mt-4 space-y-3">
                  {(result.feedback?.strengths || []).map((item) => (
                    <div key={item} className="flex gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {item}
                    </div>
                  ))}
                  {(result.feedback?.improvements || []).map((item) => (
                    <div key={item} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{item}</div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Nộp bài để nhận điểm và gợi ý cải thiện.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
