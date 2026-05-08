import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Bot,
  CheckSquare,
  Clock,
  Edit,
  FileText,
  Link,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { aiTestApi } from '@shared/api/aiTestApi';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';
import { getSeekerAiTestPath } from '@shared/utils/aiTestRoutes';

const TEST_TYPE_PROFILES = {
  normal: {
    label: 'Trắc nghiệm',
    fullLabel: 'Trắc nghiệm (MCQ)',
    description: 'Câu hỏi lựa chọn, chấm đúng/sai tự động.',
    defaultDuration: 45,
    placeholder: 'VD: Trắc nghiệm NodeJS cho Backend Intern',
    icon: CheckSquare,
    accent: 'from-emerald-500 via-teal-500 to-cyan-500',
    iconBg: 'from-emerald-500 to-teal-600',
    softBg: 'from-emerald-50 to-teal-50',
    border: 'border-emerald-100/70 hover:border-emerald-200',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    button: 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200/70',
    empty: 'Chưa có bài trắc nghiệm nào.',
  },
  video_ai: {
    label: 'VideoAI + Tự luận',
    fullLabel: 'VideoAI + Tự luận',
    description: 'Câu hỏi có video, ứng viên trả lời bằng văn bản hoặc giọng nói.',
    defaultDuration: 60,
    placeholder: 'VD: VideoAI đánh giá xử lý tình huống CSKH',
    icon: Video,
    accent: 'from-blue-500 via-cyan-500 to-sky-500',
    iconBg: 'from-blue-500 to-cyan-600',
    softBg: 'from-blue-50 to-cyan-50',
    border: 'border-blue-100/70 hover:border-blue-200',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    button: 'from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-blue-200/70',
    empty: 'Chưa có bài VideoAI + Tự luận nào.',
  },
  avatar: {
    label: 'Avatar Live3D',
    fullLabel: 'Avatar Live3D',
    description: 'Avatar AI phỏng vấn trực tiếp ứng viên.',
    defaultDuration: 60,
    placeholder: 'VD: Avatar phỏng vấn vòng đầu',
    icon: Bot,
    accent: 'from-violet-500 via-fuchsia-500 to-rose-500',
    iconBg: 'from-violet-500 to-fuchsia-600',
    softBg: 'from-violet-50 to-fuchsia-50',
    border: 'border-violet-100/70 hover:border-violet-200',
    badge: 'border-violet-200 bg-violet-50 text-violet-700',
    button: 'from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-violet-200/70',
    empty: 'Chưa có bài Avatar AI nào.',
  },
};

const CREATE_TYPES = ['normal', 'video_ai', 'avatar_live3d'];
const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'normal', label: 'Trắc nghiệm' },
  { key: 'video_ai', label: 'VideoAI' },
  { key: 'avatar', label: 'Avatar' },
];

function getTestTypeMeta(type) {
  if (type === 'video_ai') return TEST_TYPE_PROFILES.video_ai;
  if (type === 'avatar' || ['avatar_live3d', 'avatar_live2d'].includes(type)) return TEST_TYPE_PROFILES.avatar;
  return TEST_TYPE_PROFILES.normal;
}

function isAvatarTestType(type) {
  return ['avatar_live3d', 'avatar_live2d'].includes(type);
}

function getCreateTypeFromFilter(filter) {
  if (filter === 'video_ai') return 'video_ai';
  if (filter === 'avatar') return 'avatar_live3d';
  return 'normal';
}

function formatDate(value) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return date.toLocaleDateString('vi-VN');
}

const AITestManagementContent = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    job_id: '',
    description: '',
    duration: TEST_TYPE_PROFILES.normal.defaultDuration,
    test_type: 'normal',
  });

  const fetchTests = useCallback(async () => {
    try {
      const data = await aiTestApi.getTests();
      setTests(data || []);
    } catch (err) {
      console.error('Failed to fetch tests', err);
    }
  }, []);

  useEffect(() => {
    let active = true;

    aiTestApi.getTests()
      .then((data) => {
        if (active) setTests(data || []);
      })
      .catch((err) => console.error('Failed to fetch tests', err));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE_URL}/api/employer/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setJobs(data.data);
      })
      .catch(console.error);
  }, [token]);

  const counts = useMemo(() => {
    const normal = tests.filter((test) => test.test_type === 'normal' || !test.test_type).length;
    const videoAi = tests.filter((test) => test.test_type === 'video_ai').length;
    const avatar = tests.filter((test) => isAvatarTestType(test.test_type)).length;
    return {
      all: tests.length,
      normal,
      video_ai: videoAi,
      avatar,
    };
  }, [tests]);

  const filteredTests = useMemo(() => {
    if (activeFilter === 'all') return tests;
    return tests.filter((test) => {
      if (activeFilter === 'normal') return test.test_type === 'normal' || !test.test_type;
      if (activeFilter === 'avatar') return isAvatarTestType(test.test_type);
      return test.test_type === activeFilter;
    });
  }, [activeFilter, tests]);

  const selectedTypeMeta = getTestTypeMeta(formData.test_type);
  const SelectedTypeIcon = selectedTypeMeta.icon;

  const openCreateModal = (type = 'normal') => {
    const meta = getTestTypeMeta(type);
    setFormData({
      title: '',
      job_id: '',
      description: '',
      duration: meta.defaultDuration,
      test_type: type,
    });
    setShowCreateModal(true);
  };

  const handleSelectType = (type) => {
    const meta = getTestTypeMeta(type);
    setFormData((current) => ({
      ...current,
      test_type: type,
      duration: meta.defaultDuration,
    }));
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (creating) return;

    setCreating(true);
    try {
      await aiTestApi.createTest({
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        duration: Number(formData.duration) || selectedTypeMeta.defaultDuration,
        job_id: formData.job_id || null,
      });
      setShowCreateModal(false);
      await fetchTests();
      setFormData({
        title: '',
        job_id: '',
        description: '',
        duration: TEST_TYPE_PROFILES.normal.defaultDuration,
        test_type: 'normal',
      });
    } catch (err) {
      console.error(err);
      alert(err.message || 'Không thể tạo bài test');
    } finally {
      setCreating(false);
    }
  };

  const copyTestLink = (test) => {
    navigator.clipboard.writeText(`${window.location.origin}${getSeekerAiTestPath(test.id, test.test_type)}`);
    alert('Đã copy link bài test!');
  };

  const handleDeleteTest = async (testId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài test này? Hành động này không thể hoàn tác.')) return;
    try {
      await aiTestApi.deleteTest(testId);
      fetchTests();
    } catch (err) {
      console.error(err);
      alert('Không thể xóa bài test');
    }
  };

  const inputClass = 'w-full rounded-xl border border-indigo-100/70 bg-white px-4 py-3 text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-violet-200';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-700';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500"></div>
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-200/70">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Quản lý Bài Test AI</h1>
              <p className="mt-1 text-sm text-gray-500">
                Quản lý riêng bài trắc nghiệm, VideoAI + Tự luận và Avatar Live3D cho từng tin tuyển dụng.
              </p>
            </div>
          </div>

          <div className="grid min-w-[360px] grid-cols-4 gap-2 rounded-2xl border border-indigo-100/60 bg-indigo-50/40 p-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`rounded-xl px-3 py-2 text-center transition-all ${
                  activeFilter === filter.key
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:bg-white/70 hover:text-indigo-700'
                }`}
              >
                <span className="block text-[11px] font-semibold">{filter.label}</span>
                <span className="block text-lg font-black">{counts[filter.key]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-indigo-100/60 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Danh sách bài test</h2>
            <p className="text-sm text-gray-500">
              {activeFilter === 'all' ? `${tests.length} bài test trong hệ thống` : `${filteredTests.length} bài đang hiển thị`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreateModal(getCreateTypeFromFilter(activeFilter))}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200/60 transition-all hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 hover:shadow-xl"
          >
            <Plus className="h-4 w-4" />
            Tạo bài test
          </button>
        </div>

        {filteredTests.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-indigo-200/60 bg-indigo-50/30 p-14 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Sparkles className="h-8 w-8 text-indigo-300" />
            </div>
            <p className="font-semibold text-gray-600">
              {activeFilter === 'all' ? 'Chưa có bài test nào được tạo.' : getTestTypeMeta(activeFilter).empty}
            </p>
            <button
              type="button"
              onClick={() => openCreateModal(getCreateTypeFromFilter(activeFilter))}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50"
            >
              <Plus className="h-4 w-4" />
              Tạo bài đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTests.map((test) => {
              const linkedJob = jobs.find((job) => String(job.id) === String(test.job_id));
              const linkedJobTitle = linkedJob?.title || linkedJob?.job_title || test.job_title;
              const typeMeta = getTestTypeMeta(test.test_type);
              const TypeIcon = typeMeta.icon;

              return (
                <article
                  key={test.id}
                  className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${typeMeta.border}`}
                >
                  <div className={`absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r ${typeMeta.accent}`}></div>
                  <div className="p-5">
                    <div className="mb-4 flex items-start gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${typeMeta.iconBg} shadow-md`}>
                        <TypeIcon className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold text-gray-900 transition-colors group-hover:text-indigo-700">{test.title}</h3>
                        <span className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${typeMeta.badge}`}>
                          {typeMeta.fullLabel}
                        </span>
                      </div>
                    </div>

                    <p className="mb-4 line-clamp-2 min-h-[40px] text-sm leading-5 text-gray-500">
                      {test.description || typeMeta.description}
                    </p>

                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                        <FileText className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="truncate">{test.job_id ? linkedJobTitle || `Tin ID: ${test.job_id}` : 'Chưa gắn tin tuyển dụng'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {test.duration} phút
                        </span>
                        <span>{formatDate(test.created_at)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/employer/ai-tests/${test.id}/edit`)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                        title="Sửa bài test và câu hỏi"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/employer/ai-tests/${test.id}/scores`)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                        title="Xem danh sách nộp bài"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Điểm
                      </button>
                      <button
                        type="button"
                        onClick={() => copyTestLink(test)}
                        className="rounded-xl px-3 py-2 text-gray-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        title="Copy link bài test"
                      >
                        <Link className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTest(test.id)}
                        className="rounded-xl px-3 py-2 text-gray-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        title="Xóa bài test"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-indigo-100/60 bg-white shadow-2xl shadow-indigo-100/40">
            <div className={`absolute left-0 right-0 top-0 h-1.5 rounded-t-2xl bg-gradient-to-r ${selectedTypeMeta.accent}`}></div>
            <div className="flex items-center justify-between border-b border-indigo-50 p-6 pt-7">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${selectedTypeMeta.iconBg} shadow-lg`}>
                  <SelectedTypeIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Tạo {selectedTypeMeta.fullLabel}</h2>
                  <p className="text-sm text-gray-500">{selectedTypeMeta.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full p-2 transition-colors hover:bg-indigo-50"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateTest} className="grid gap-6 p-6 lg:grid-cols-[260px_1fr]">
              <div className="space-y-3">
                {CREATE_TYPES.map((type) => {
                  const meta = getTestTypeMeta(type);
                  const TypeIcon = meta.icon;
                  const selected = formData.test_type === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleSelectType(type)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all ${
                        selected
                          ? `bg-gradient-to-br ${meta.softBg} ${meta.border} shadow-sm`
                          : 'border-gray-100 bg-gray-50/70 hover:border-indigo-100 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.iconBg}`}>
                          <TypeIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{meta.label}</p>
                          <p className="mt-1 text-xs leading-5 text-gray-500">{meta.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Tên bài test</label>
                  <input
                    required
                    type="text"
                    className={inputClass}
                    placeholder={selectedTypeMeta.placeholder}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className={labelClass}>Mô tả</label>
                  <textarea
                    className={`${inputClass} min-h-[88px] resize-y`}
                    placeholder="Mục tiêu đánh giá, kỹ năng trọng tâm, vòng tuyển dụng..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                  <div>
                    <label className={labelClass}>Tin tuyển dụng</label>
                    <select
                      className={inputClass}
                      value={formData.job_id}
                      onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
                    >
                      <option value="">Không gắn vào tin nào</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>{job.title || job.job_title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Thời gian</label>
                    <input
                      required
                      min="5"
                      type="number"
                      className={inputClass}
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className={`rounded-2xl border bg-gradient-to-br ${selectedTypeMeta.softBg} p-4 ${selectedTypeMeta.border}`}>
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {formData.test_type === 'avatar_live3d'
                          ? 'Workflow Avatar Live3D'
                          : formData.test_type === 'video_ai'
                            ? 'Workflow VideoAI + Tự luận'
                            : 'Workflow Trắc nghiệm'}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-gray-600">
                        {formData.test_type === 'avatar_live3d'
                          ? 'Sau khi tạo bài, thêm câu hỏi tự luận. Avatar AI sẽ đọc câu hỏi và tạo trải nghiệm phỏng vấn trực tiếp cho ứng viên.'
                          : formData.test_type === 'video_ai'
                            ? 'Sau khi tạo bài, thêm câu hỏi tự luận và gắn video cho từng câu. Ứng viên có thể trả lời bằng văn bản hoặc giọng nói.'
                            : 'Sau khi tạo bài, thêm câu hỏi MCQ với đáp án A/B/C/D. Hệ thống tự chấm đúng sai theo đáp án đã chọn.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-indigo-50 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-indigo-50"
                    disabled={creating}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 ${selectedTypeMeta.button}`}
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Tạo bài test
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AITestManagementContent;
