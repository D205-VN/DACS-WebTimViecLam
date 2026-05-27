import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, Briefcase, CheckCircle2, Loader2, MessageSquareText, Sparkles } from 'lucide-react';
import { talentInsightsApi } from '@services/talent-insights/talentInsightsApi';
import { getJobDetailRoute } from '@services/navigation/roleRedirect';
import { useAuth } from '@components/providers/AuthContext';

export default function InterviewCopilotPage() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const [copilot, setCopilot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    talentInsightsApi.getInterviewCopilotForJob(jobId)
      .then(setCopilot)
      .catch((err) => setError(err.message || 'Không thể tải Interview Copilot'))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="aw-container py-16">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aw-container py-10">
        <div className="rounded-lg border border-red-100 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="aw-container max-w-5xl py-6">
      <Link to={getJobDetailRoute(user?.role_code, jobId)} className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-indigo-700">
        <ArrowLeft className="h-4 w-4" /> Quay lại tin tuyển dụng
      </Link>

      <section className="aw-surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <BrainCircuit className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-500">Interview Copilot</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">{copilot?.job?.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{copilot?.job?.company_name || 'Nhà tuyển dụng'}</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
            <Sparkles className="h-4 w-4" /> Luyện trước phỏng vấn
          </span>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <section className="space-y-4">
          {(copilot?.questions || []).map((question) => (
            <div key={question.id} className="aw-surface p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-black text-indigo-700">
                  {question.id}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-6 text-slate-900">{question.content}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Trọng tâm: {question.focus}</p>
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    {question.answer_hint}
                  </div>
                  <textarea
                    value={answers[question.id] || ''}
                    onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
                    rows={4}
                    placeholder="Ghi nháp câu trả lời theo STAR..."
                    className="mt-4 w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-violet-200"
                  />
                </div>
              </div>
            </div>
          ))}
        </section>

        <aside className="space-y-5">
          <section className="aw-surface p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Checklist trước buổi phỏng vấn</h2>
            </div>
            <div className="mt-4 space-y-3">
              {(copilot?.checklist || []).map((item) => (
                <div key={item} className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{item}</div>
              ))}
            </div>
          </section>

          <section className="aw-surface p-5">
            <div className="flex items-center gap-3">
              <MessageSquareText className="h-5 w-5 text-violet-600" />
              <h2 className="text-lg font-bold text-slate-900">Rubric nhà tuyển dụng hay dùng</h2>
            </div>
            <div className="mt-4 space-y-2">
              {(copilot?.employer_rubric || []).map((item) => (
                <div key={item} className="rounded-lg border border-slate-100 bg-white px-4 py-3 text-sm text-slate-700">{item}</div>
              ))}
            </div>
          </section>

          <section className="aw-surface p-5">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-cyan-600" />
              <h2 className="text-lg font-bold text-slate-900">Kỹ năng nên nhấn mạnh</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(copilot?.skills || []).map((skill) => (
                <span key={skill} className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">{skill}</span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
