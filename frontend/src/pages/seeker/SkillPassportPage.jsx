import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BrainCircuit,
  Briefcase,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import SeekerToolsNav from '@features/seeker-tools/SeekerToolsNav';
import { talentInsightsApi } from '@shared/api/talentInsightsApi';
import { getBackLabelByRole, getDefaultRouteByRole } from '@shared/utils/roleRedirect';

function resolvePublicUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function formatDate(value) {
  if (!value) return 'Chưa cập nhật';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('vi-VN');
}

function StatTile({ icon, label, value, tone }) {
  const IconComponent = icon;
  return (
    <div className="aw-surface p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
        <IconComponent className="h-5 w-5" />
      </div>
      <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    </div>
  );
}

export default function SkillPassportPage() {
  const { user } = useAuth();
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const backLabel = getBackLabelByRole(user?.role_code);

  useEffect(() => {
    let mounted = true;
    talentInsightsApi.getMySkillPassport()
      .then((data) => {
        if (mounted) setPassport(data);
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Không thể tải Skill Passport');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const publicUrl = useMemo(() => resolvePublicUrl(passport?.public_url), [passport?.public_url]);

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

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
    <div className="aw-container max-w-6xl py-6">
      <Link to={backRoute} className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-indigo-700">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <SeekerToolsNav />

      <section className="aw-surface overflow-hidden p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-500">AI Skill Passport</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{passport?.profile?.full_name || 'Ứng viên'}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{passport?.headline}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-indigo-50"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Đã sao chép' : 'Copy link public'}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-indigo-700 hover:to-violet-700"
            >
              <ExternalLink className="h-4 w-4" /> Mở bản public
            </a>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Target} label="Passport score" value={`${passport?.passport_score || 0}%`} tone="bg-indigo-50 text-indigo-700" />
        <StatTile icon={BrainCircuit} label="AI Test TB" value={`${passport?.ai_tests?.average_score || 0}%`} tone="bg-violet-50 text-violet-700" />
        <StatTile icon={ShieldCheck} label="Xác minh" value={(passport?.verification?.certificates_count || 0) + (passport?.verification?.work_histories_count || 0)} tone="bg-emerald-50 text-emerald-700" />
        <StatTile icon={Briefcase} label="Ứng tuyển" value={passport?.applications?.length || 0} tone="bg-cyan-50 text-cyan-700" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="aw-surface p-5">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">CV chính & kỹ năng</h2>
          </div>
          {passport?.cv ? (
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{passport.cv.title}</p>
              <p className="mt-1 text-sm text-slate-500">{passport.cv.target_role || 'Chưa có vị trí mục tiêu'} · {formatDate(passport.cv.created_at)}</p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Chưa có CV chính.
            </div>
          )}
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-700">Kỹ năng mạnh</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(passport?.skills?.strong_skills || []).length ? passport.skills.strong_skills.map((skill) => (
                <span key={skill} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">{skill}</span>
              )) : <span className="text-sm text-slate-400">Chưa nhận diện đủ kỹ năng.</span>}
            </div>
          </div>
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-700">Kỹ năng nên bổ sung</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(passport?.skills?.growth_skills || []).map((skill) => (
                <span key={skill} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{skill}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="aw-surface p-5">
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-bold text-slate-900">AI Test gần đây</h2>
          </div>
          <div className="mt-4 space-y-3">
            {(passport?.ai_tests?.latest || []).length ? passport.ai_tests.latest.map((test) => (
              <div key={test.id} className="rounded-lg border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{test.test_title || 'Bài test'}</p>
                    <p className="mt-1 text-xs text-slate-500">{test.job_title || 'Bài test độc lập'}</p>
                  </div>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{test.percentage}%</span>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Chưa có bài test hoàn thành.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="aw-surface p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Chứng chỉ & lịch sử xác minh</h2>
          </div>
          <div className="mt-4 space-y-3">
            {[...(passport?.verification?.certificates || []), ...(passport?.verification?.work_histories || [])].slice(0, 6).map((item) => (
              <div key={`${item.certificate_name || item.company_name}-${item.id}`} className="rounded-lg bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{item.certificate_name || item.job_title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.issuer_name || item.company_name}</p>
                {item.verification_code ? <p className="mt-2 text-xs font-mono text-emerald-600">{item.verification_code}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="aw-surface p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Gợi ý nâng cấp hồ sơ</h2>
          </div>
          <div className="mt-4 space-y-3">
            {(passport?.suggestions || []).map((suggestion) => (
              <div key={suggestion} className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                {suggestion}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
