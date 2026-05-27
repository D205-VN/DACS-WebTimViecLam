import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Award, BrainCircuit, Briefcase, FileText, Loader2, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { talentInsightsApi } from '@services/talent-insights/talentInsightsApi';

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('vi-VN');
}

function PublicStat({ icon, label, value }) {
  const IconComponent = icon;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <IconComponent className="h-5 w-5 text-indigo-600" />
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    </div>
  );
}

export default function PublicSkillPassportPage() {
  const { token } = useParams();
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    talentInsightsApi.getPublicSkillPassport(token)
      .then(setPassport)
      .catch((err) => setError(err.message || 'Không thể tải Skill Passport'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="aw-container py-20">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aw-container max-w-3xl py-20">
        <div className="rounded-lg border border-red-100 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="aw-container max-w-5xl py-8">
      <section className="aw-surface overflow-hidden p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-500">Public AI Skill Passport</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{passport?.profile?.full_name || 'Ứng viên'}</h1>
              <p className="mt-2 text-sm text-slate-500">{passport?.headline}</p>
            </div>
          </div>
          <Link to="/login" className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white">
            Đăng nhập AptertekWork
          </Link>
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PublicStat icon={Target} label="Passport score" value={`${passport?.passport_score || 0}%`} />
        <PublicStat icon={BrainCircuit} label="AI Test TB" value={`${passport?.ai_tests?.average_score || 0}%`} />
        <PublicStat icon={ShieldCheck} label="Hồ sơ xác minh" value={(passport?.verification?.certificates_count || 0) + (passport?.verification?.work_histories_count || 0)} />
        <PublicStat icon={Briefcase} label="Kỹ năng nổi bật" value={passport?.skills?.strong_skills?.length || 0} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <section className="aw-surface p-5">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Năng lực chính</h2>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">{passport?.cv?.title || 'CV chính'}</p>
            <p className="mt-1 text-sm text-slate-500">{passport?.cv?.target_role || passport?.headline}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(passport?.skills?.strong_skills || []).map((skill) => (
              <span key={skill} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">{skill}</span>
            ))}
          </div>
        </section>

        <section className="aw-surface p-5">
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-bold text-slate-900">AI Test nổi bật</h2>
          </div>
          <div className="mt-4 space-y-3">
            {(passport?.ai_tests?.latest || []).slice(0, 4).map((test) => (
              <div key={test.id} className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{test.test_title || 'Bài test'}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(test.completed_at)}</p>
                  </div>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{test.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
