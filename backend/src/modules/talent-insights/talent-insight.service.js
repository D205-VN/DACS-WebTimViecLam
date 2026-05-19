const AppError = require('../../core/errors/AppError');
const { ensureTalentInsightSchema } = require('./talent-insight.model');
const repository = require('./talent-insight.repository');

const KNOWN_SKILLS = [
  'Python', 'Machine Learning', 'Data Analysis', 'Model Deployment', 'Analytical Skills',
  'Deep Learning', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn', 'MLOps',
  'NLP', 'Computer Vision', 'Artificial Intelligence', 'Linux', 'Networking',
  'Database Administration', 'Technical Support', 'Troubleshooting', 'Desktop Support',
  'Microsoft Office', 'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Express', 'NestJS',
  'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Tailwind', 'PostgreSQL', 'MySQL', 'MongoDB',
  'Redis', 'REST API', 'GraphQL', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'CI/CD',
  'Git', 'Figma', 'SEO', 'SEM',
  'Google Ads', 'Facebook Ads', 'Content Marketing', 'CRM', 'Sales', 'Telesales',
  'Chăm sóc khách hàng', 'Tư vấn bán hàng', 'Kế toán', 'Tài chính', 'Excel', 'Power BI',
  'SQL', 'Phân tích dữ liệu', 'Quản lý dự án', 'Agile', 'Scrum', 'Tuyển dụng', 'Onboarding',
  'Đào tạo', 'Vận hành', 'Logistics', 'Kho vận', 'Tiếng Anh', 'Giao tiếp', 'Làm việc nhóm',
];

const SKILL_SECTION_HEADINGS = [
  'kỹ năng', 'ky nang', 'skills', 'technical skills', 'core skills', 'công cụ', 'cong cu',
  'tools', 'technologies', 'công nghệ', 'cong nghe', 'chuyên môn', 'chuyen mon',
];

const SECTION_BOUNDARY_HEADINGS = [
  ...SKILL_SECTION_HEADINGS,
  'mục tiêu nghề nghiệp', 'muc tieu nghe nghiep', 'career objective', 'objective', 'summary',
  'kinh nghiệm', 'kinh nghiệm làm việc', 'kinh nghiem', 'kinh nghiem lam viec', 'experience',
  'work experience', 'học vấn', 'hoc van', 'education', 'dự án', 'du an', 'projects',
  'chứng chỉ', 'chung chi', 'certifications', 'giải thưởng', 'giai thuong', 'awards',
  'ngôn ngữ', 'ngon ngu', 'languages', 'liên hệ', 'lien he', 'contact',
];

const GROWTH_SKILL_GROUPS = [
  {
    keywords: ['ai engineer', 'machine learning', 'ml engineer', 'data scientist', 'data analysis'],
    skills: ['Deep Learning', 'TensorFlow', 'PyTorch', 'MLOps', 'Docker', 'NLP', 'Computer Vision'],
  },
  {
    keywords: ['frontend', 'react', 'vue', 'ui engineer'],
    skills: ['TypeScript', 'React', 'Next.js', 'Tailwind', 'REST API', 'Testing'],
  },
  {
    keywords: ['backend', 'nodejs', 'api engineer', 'software engineer'],
    skills: ['Node.js', 'Express', 'PostgreSQL', 'Docker', 'REST API', 'CI/CD'],
  },
  {
    keywords: ['marketing', 'content', 'seo'],
    skills: ['SEO', 'SEM', 'Google Ads', 'Content Marketing', 'Facebook Ads', 'CRM'],
  },
  {
    keywords: ['sales', 'telesales', 'bán hàng', 'ban hang'],
    skills: ['Sales', 'Telesales', 'CRM', 'Chăm sóc khách hàng', 'Tư vấn bán hàng'],
  },
];

const STOP_WORDS = new Set([
  'cong', 'viec', 'nhan', 'vien', 'tuyen', 'dung', 'ung', 'vien', 'kinh', 'nghiem',
  'yeu', 'cau', 'trach', 'nhiem', 'quyen', 'loi', 'phuc', 'loi', 'muc', 'luong',
  'company', 'candidate', 'experience', 'requirement', 'description',
]);

const NOISE_SKILL_TOKENS = new Set([
  ...STOP_WORDS,
  'email', 'gmail', 'gmail.com', 'yahoo', 'hotmail', 'outlook', 'phone', 'tel', 'www',
  'http', 'https', 'engineer', 'specialist', 'administrator', 'manager', 'developer',
  'analyst', 'intern', 'fresher', 'junior', 'senior', 'middle', 'lead', 'name', 'profile',
  'tieu', 'nghe',
]);

const NON_SKILL_REQUIREMENT_LABELS = new Set([
  'trinh do hoc van', 'bang cap', 'gioi tinh', 'do tuoi', 'tuoi', 'ky quy',
  'muc luong', 'luong', 'so luong', 'hinh thuc', 'thoi gian', 'dia diem',
]);

const REQUIREMENT_FILLER_TOKENS = new Set([
  ...STOP_WORDS,
  'biet', 'su', 'dung', 'co', 'can', 'phai', 'tot', 'thanh', 'thao', 'uu', 'tien',
  'kha', 'nang', 'lam', 'viec', 'duoc', 'muon', 'nen', 'hoc', 'hoi', 'phat', 'trien',
  'ban', 'than', 'nghe', 'nghiep', 'them', 'tao',
]);

const MIN_SIMULATION_ANSWER_LENGTH = 5;

function assertRole(user, roles) {
  if (!roles.includes(user?.role_code)) {
    throw new AppError('Bạn không có quyền sử dụng chức năng này.', 403);
  }
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtmlToLines(value = '') {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(h[1-6]|p|div|section|article|li|ul|ol|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeText(value = '') {
  return stripHtml(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/node\.?\s*js/g, 'nodejs')
    .replace(/[^a-z0-9\s+#.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value = '') {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    .slice(0, 120);
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizedPhraseExists(normalizedText, phrase) {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedText || !normalizedPhrase) return false;
  const pattern = new RegExp(`(^|[^a-z0-9+#.])${escapeRegExp(normalizedPhrase)}([^a-z0-9+#.]|$)`);
  return pattern.test(normalizedText);
}

function isStandaloneHeading(line, headings) {
  const normalizedLine = normalizeText(line);
  return headings.some((heading) => normalizedLine === normalizeText(heading));
}

function getInlineSkillSection(line = '') {
  const match = String(line).match(/^\s*(?:kỹ\s*năng|ky\s*nang|skills?|technical\s+skills?|core\s+skills?|công\s*cụ|cong\s*cu|tools?|technologies?|công\s*nghệ|cong\s*nghe|chuyên\s*môn|chuyen\s*mon)\s*[:\-–]\s*(.+)$/i);
  return match?.[1]?.trim() || '';
}

function canonicalSkillName(value) {
  const normalized = normalizeText(value);
  return KNOWN_SKILLS.find((skill) => normalizeText(skill) === normalized) || value;
}

function cleanSkillCandidate(value = '') {
  const candidate = stripHtml(value)
    .replace(/^[\s•●▪▫*\-–—]+/, '')
    .replace(/[.;:,\-–—\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const normalized = normalizeText(candidate);
  const words = normalized.split(/\s+/).filter(Boolean);

  if (!candidate || candidate.length < 2 || candidate.length > 56) return '';
  if (/@/.test(candidate) || /\b[\w.+-]+@[\w.-]+\.\w+\b/i.test(candidate)) return '';
  if (/\b(?:gmail|yahoo|hotmail|outlook)\.com\b/i.test(candidate)) return '';
  if (/^\+?\d[\d\s().-]{5,}$/.test(candidate)) return '';
  if (!normalized || NOISE_SKILL_TOKENS.has(normalized)) return '';
  if (words.length > 5) return '';
  if (words.every((word) => NOISE_SKILL_TOKENS.has(word))) return '';

  return canonicalSkillName(candidate);
}

function splitSkillCandidates(line = '') {
  return String(line)
    .split(/\s*(?:[,;|•·]+|\n+)\s*/)
    .map(cleanSkillCandidate)
    .filter(Boolean);
}

function splitRequirementSegments(text = '') {
  return stripHtmlToLines(text)
    .flatMap((line) => line
      .replace(/(^|\s)-(?=\s*[0-9A-Za-zÀ-ỹ])/g, '$1\n- ')
      .replace(/([:;])\s*\+(?=\s*[0-9A-Za-zÀ-ỹ])/g, '$1\n+ ')
      .replace(/\s\+(?=\s*[0-9A-Za-zÀ-ỹ])/g, '\n+ ')
      .split('\n'))
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanRequirementItem(value = '') {
  const candidate = stripHtml(value)
    .replace(/^[\s•●▪▫*+\-–—]+/, '')
    .replace(/[.;,\-–—\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!candidate || candidate.length < 3 || candidate.length > 140) return '';

  const labelMatch = candidate.match(/^([^:：]{2,36})\s*[:：]\s*(.*)$/);
  const label = labelMatch ? normalizeText(labelMatch[1]) : '';
  const rawValue = labelMatch ? labelMatch[2].trim() : candidate;
  const normalizedValue = normalizeText(rawValue);

  if (!rawValue || /khong yeu cau|chua cap nhat|nam va nu|nam nu/.test(normalizedValue)) return '';
  if (label && NON_SKILL_REQUIREMENT_LABELS.has(label)) return '';
  if (/^\d+([\s.,-]\d+)*$/.test(normalizedValue)) return '';

  return label === 'yeu cau' ? rawValue : candidate;
}

function extractRequirementItems(text = '') {
  return uniqueByNormalized(
    splitRequirementSegments(text)
      .map(cleanRequirementItem)
      .filter(Boolean)
  ).slice(0, 16);
}

function getRequirementMatchTokens(requirement = '') {
  return normalizeText(requirement)
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .filter((token) => !REQUIREMENT_FILLER_TOKENS.has(token))
    .filter((token) => !/^\d+$/.test(token));
}

function isRequirementMatched(requirement, candidateText) {
  const normalizedCandidate = normalizeText(candidateText);
  if (!requirement || !normalizedCandidate) return false;
  if (normalizedPhraseExists(normalizedCandidate, requirement)) return true;

  const tokens = getRequirementMatchTokens(requirement);
  if (!tokens.length) return false;

  const matched = tokens.filter((token) => normalizedPhraseExists(normalizedCandidate, token));
  const requiredMatches = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.75);
  return matched.length >= requiredMatches;
}

function extractSkillSectionItems(text = '') {
  const lines = stripHtmlToLines(text);
  const items = [];
  let inSkillSection = false;

  for (const line of lines) {
    const inlineSection = getInlineSkillSection(line);

    if (inlineSection) {
      items.push(...splitSkillCandidates(inlineSection));
      inSkillSection = true;
      continue;
    }

    if (isStandaloneHeading(line, SKILL_SECTION_HEADINGS)) {
      inSkillSection = true;
      continue;
    }

    if (!inSkillSection) continue;
    if (isStandaloneHeading(line, SECTION_BOUNDARY_HEADINGS)) break;
    if (line.length > 240) continue;

    items.push(...splitSkillCandidates(line));
    if (items.length >= 24) break;
  }

  return items;
}

function extractKnownSkills(text = '') {
  const normalized = normalizeText(text);
  return KNOWN_SKILLS.filter((skill) => normalizedPhraseExists(normalized, skill));
}

function uniqueByNormalized(values = []) {
  const seen = new Set();
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function extractResponsibilities(text = '') {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/\n|[•●▪▫*-]\s+|(?<=[.!?;])\s+/)
    .map(stripHtml)
    .filter((line) => line.length >= 16 && line.length <= 180)
    .filter((line) => /(phát triển|xây dựng|thiết kế|triển khai|quản lý|phân tích|tối ưu|vận hành|thực hiện|đảm bảo|phối hợp|chịu trách nhiệm|tư vấn|chăm sóc|báo cáo|kiểm tra|theo dõi|hỗ trợ|lập kế hoạch|đánh giá|develop|manage|analyze|optimize|support)/i.test(line))
    .slice(0, 8);
}

function extractSkills(text = '') {
  const sectionTokens = extractSkillSectionItems(text);
  const explicit = extractKnownSkills(text);
  return uniqueByNormalized([...sectionTokens, ...explicit]).slice(0, 16);
}

function extractCvSectionSkills(text = '') {
  const sectionTokens = extractSkillSectionItems(text);
  return sectionTokens.length ? uniqueByNormalized(sectionTokens).slice(0, 16) : extractSkills(text);
}

function extractCandidateSkills(cv) {
  if (!cv) return [];
  return uniqueByNormalized([
    ...extractCvSectionSkills(cv.html_content || ''),
    ...extractSkills([cv.target_role, cv.title].filter(Boolean).join(' ')),
  ]).slice(0, 16);
}

function extractJobSkills(job) {
  if (!job) return [];
  return uniqueByNormalized([
    ...extractSkills(job.job_requirements || ''),
    ...extractSkills(job.job_description || ''),
    ...extractSkills([job.job_title, job.industry, job.career_level].filter(Boolean).join(' ')),
  ]).slice(0, 16);
}

function extractJobRequirementProfile(job) {
  if (!job) return [];
  const requirementItems = extractRequirementItems(job.job_requirements || '');
  const technicalSkills = uniqueByNormalized([
    ...extractKnownSkills(job.job_requirements || ''),
    ...extractKnownSkills(job.job_description || ''),
    ...extractKnownSkills([job.job_title, job.industry, job.career_level].filter(Boolean).join(' ')),
  ]);

  return uniqueByNormalized(
    requirementItems.length ? [...requirementItems, ...technicalSkills] : technicalSkills
  ).slice(0, 16);
}

function recommendGrowthSkills(context, currentSkills) {
  const normalizedContext = normalizeText(context);
  const current = new Set(currentSkills.map((skill) => normalizeText(skill)));
  const matchedGroup = GROWTH_SKILL_GROUPS.find((group) =>
    group.keywords.some((keyword) => normalizedPhraseExists(normalizedContext, keyword))
  );
  const recommended = matchedGroup?.skills || ['Excel', 'Power BI', 'SQL', 'Giao tiếp', 'Làm việc nhóm', 'Quản lý dự án'];

  return uniqueByNormalized(recommended)
    .filter((skill) => !current.has(normalizeText(skill)))
    .slice(0, 6);
}

function formatPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeTestScore(row) {
  const totalQuestions = Number(row.total_questions || 0);
  const maxScore = totalQuestions > 0 ? totalQuestions * 10 : 100;
  const totalScore = Number(row.total_score || 0);
  const percentage = maxScore > 0 ? formatPercent((totalScore / maxScore) * 100) : 0;

  return {
    ...row,
    total_questions: totalQuestions,
    total_score: totalScore,
    max_score: maxScore,
    percentage,
  };
}

function buildSkillProfile({ cv, tests, workHistories, applications }) {
  const cvText = [cv?.title, cv?.target_role, cv?.html_content].filter(Boolean).join(' ');
  const workText = workHistories
    .map((item) => [item.job_title, item.company_name, item.summary].filter(Boolean).join(' '))
    .join(' ');
  const appText = applications
    .map((item) => [item.job_title, item.industry].filter(Boolean).join(' '))
    .join(' ');
  const testText = tests
    .map((item) => [item.test_title, item.job_title].filter(Boolean).join(' '))
    .join(' ');

  const skills = uniqueByNormalized([
    ...extractCandidateSkills(cv),
    ...extractSkills(workText),
    ...extractSkills(testText),
    ...extractSkills(appText),
  ]).slice(0, 16);
  const strongSkills = skills.slice(0, 8);
  const missingSignals = recommendGrowthSkills(cvText, skills);

  return {
    skills,
    strong_skills: strongSkills,
    growth_skills: missingSignals,
  };
}

function buildPassportScore({ cv, tests, certifications, workHistories }) {
  const avgTest = tests.length
    ? tests.reduce((sum, item) => sum + item.percentage, 0) / tests.length
    : 0;
  const cvScore = cv ? 28 : 0;
  const testScore = Math.min(28, avgTest * 0.28);
  const verifiedScore = Math.min(26, (certifications.length * 8) + (workHistories.length * 6));
  const recencyScore = cv?.created_at && (Date.now() - new Date(cv.created_at).getTime()) < 180 * 24 * 60 * 60 * 1000 ? 18 : cv ? 10 : 0;
  return formatPercent(cvScore + testScore + verifiedScore + recencyScore);
}

async function buildCandidatePassport(userId) {
  await ensureTalentInsightSchema();

  const [profile, cv, rawTests, certifications, workHistories, applications, share] = await Promise.all([
    repository.getUserProfile(userId),
    repository.getPrimaryCv(userId),
    repository.getCandidateTestSummaries(userId, 10),
    repository.getCandidateCertifications(userId),
    repository.getCandidateWorkHistories(userId),
    repository.getCandidateApplications(userId, 10),
    repository.getOrCreatePassportShare(userId),
  ]);

  if (!profile) throw new AppError('Không tìm thấy ứng viên.', 404);

  const tests = rawTests.map(normalizeTestScore);
  const skillProfile = buildSkillProfile({ cv, tests, workHistories, applications });
  const avgTestScore = tests.length
    ? formatPercent(tests.reduce((sum, item) => sum + item.percentage, 0) / tests.length)
    : 0;
  const passportScore = buildPassportScore({ cv, tests, certifications, workHistories });

  return {
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      joined_at: profile.created_at,
    },
    headline: cv?.target_role || cv?.title || 'Ứng viên đang xây dựng hồ sơ năng lực',
    passport_score: passportScore,
    public_token: share.public_token,
    public_url: `/passport/${share.public_token}`,
    cv: cv ? {
      id: cv.id,
      title: cv.title,
      target_role: cv.target_role,
      current_location: cv.current_location,
      is_primary: cv.is_primary,
      created_at: cv.created_at,
    } : null,
    ai_tests: {
      average_score: avgTestScore,
      completed_count: tests.length,
      latest: tests.slice(0, 5),
    },
    skills: skillProfile,
    verification: {
      certificates_count: certifications.length,
      work_histories_count: workHistories.length,
      certificates: certifications,
      work_histories: workHistories,
    },
    applications: applications.slice(0, 6),
    suggestions: buildPassportSuggestions({ cv, tests, certifications, workHistories, skills: skillProfile.skills }),
  };
}

function buildPassportSuggestions({ cv, tests, certifications, workHistories, skills }) {
  const suggestions = [];
  if (!cv) suggestions.push('Tạo hoặc import CV chính để Skill Passport có dữ liệu nền.');
  if (!skills.length) suggestions.push('Bổ sung phần kỹ năng trong CV để hệ thống nhận diện năng lực tốt hơn.');
  if (!tests.length) suggestions.push('Hoàn thành ít nhất một bài AI Test để tăng độ tin cậy hồ sơ.');
  if (!certifications.length) suggestions.push('Thêm chứng chỉ đã xác minh để tăng tín hiệu năng lực.');
  if (!workHistories.length) suggestions.push('Thêm lịch sử làm việc đã xác minh để nhà tuyển dụng tin tưởng hơn.');
  if (!suggestions.length) suggestions.push('Hồ sơ đã khá đầy đủ. Hãy dùng link public khi gửi cho nhà tuyển dụng.');
  return suggestions;
}

function scoreJobFit({ job, cv, tests, certifications }) {
  const requiredSkills = extractJobRequirementProfile(job);
  const candidateSkills = extractCandidateSkills(cv);
  const candidateProfileText = [
    candidateSkills.join(' '),
    cv?.title,
    cv?.target_role,
    stripHtml(cv?.html_content || ''),
    cv?.current_location,
  ].filter(Boolean).join(' ');
  const matchedSkills = requiredSkills.filter((skill) => isRequirementMatched(skill, candidateProfileText)).slice(0, 12);
  const missingSkills = requiredSkills.filter((skill) => !isRequirementMatched(skill, candidateProfileText)).slice(0, 8);
  const titleScore = normalizeText(cv?.target_role || cv?.title || '').includes(normalizeText(job.job_title || '')) ? 12 : 0;
  const locationScore = cv?.current_location && normalizeText([job.job_address, job.company_address].join(' ')).includes(normalizeText(cv.current_location)) ? 8 : 3;
  const skillScore = requiredSkills.length ? (matchedSkills.length / requiredSkills.length) * 55 : candidateSkills.length ? 34 : 12;
  const avgTestScore = tests.length ? tests.reduce((sum, item) => sum + item.percentage, 0) / tests.length : 0;
  const testScore = Math.min(15, avgTestScore * 0.15);
  const verifiedScore = Math.min(10, certifications.length * 4);
  const score = formatPercent(12 + skillScore + titleScore + locationScore + testScore + verifiedScore);

  const reasons = [];
  if (matchedSkills.length) reasons.push(`Khớp kỹ năng: ${matchedSkills.slice(0, 5).join(', ')}`);
  if (titleScore) reasons.push('Vị trí mục tiêu trong CV gần với tiêu đề công việc.');
  if (avgTestScore) reasons.push(`Điểm AI Test trung bình ${formatPercent(avgTestScore)}%.`);
  if (certifications.length) reasons.push('Có chứng chỉ/lịch sử xác minh bổ sung độ tin cậy.');
  if (!reasons.length) reasons.push('Chưa đủ dữ liệu CV để phân tích sâu.');

  const cvTips = [];
  if (missingSkills.length) cvTips.push(`Bổ sung ví dụ/kinh nghiệm liên quan tới: ${missingSkills.slice(0, 4).join(', ')}.`);
  if (!titleScore) cvTips.push('Điều chỉnh tiêu đề CV hoặc mục tiêu nghề nghiệp gần hơn với vị trí này.');
  if (!tests.length) cvTips.push('Làm bài AI Test liên quan để tăng tín hiệu năng lực trước khi ứng tuyển.');
  if (!cvTips.length) cvTips.push('CV đang bám khá sát JD. Hãy viết thư giới thiệu nhấn mạnh kết quả đo được.');

  return {
    score,
    label: score >= 78 ? 'Rất phù hợp' : score >= 58 ? 'Có tiềm năng' : 'Cần cải thiện trước khi nộp',
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
    reasons,
    cv_tips: cvTips,
    required_skills: requiredSkills,
    candidate_skills: candidateSkills,
  };
}

function buildTrustScore(row) {
  if (!row) throw new AppError('Không tìm thấy dữ liệu nhà tuyển dụng.', 404);

  const totalApps = Number(row.total_applications || 0);
  const responseRate = totalApps > 0 ? Number(row.responded_applications || 0) / totalApps : 0.65;
  const avgHours = row.avg_response_hours == null ? null : Number(row.avg_response_hours);
  const responseSpeedScore = avgHours == null ? 0.6 : avgHours <= 24 ? 1 : avgHours <= 72 ? 0.8 : avgHours <= 168 ? 0.55 : 0.35;
  const approvedRatio = Number(row.total_jobs || 0) > 0 ? Number(row.approved_jobs || 0) / Number(row.total_jobs || 1) : 0.5;
  const profileCompleteness = [
    row.company_name,
    row.company_email,
    row.company_website,
    row.company_description,
    row.company_cover_url,
    row.company_industry,
  ].filter(Boolean).length / 6;
  const feedbackRate = Number(row.scheduled_interviews || 0) > 0
    ? Number(row.interview_feedback_count || 0) / Number(row.scheduled_interviews)
    : 0.45;
  const hiringEvidence = Number(row.hired_applications || 0) > 0 ? 1 : Number(row.total_applications || 0) > 0 ? 0.55 : 0.35;
  const score = formatPercent(
    responseRate * 25 +
    responseSpeedScore * 18 +
    approvedRatio * 18 +
    profileCompleteness * 19 +
    feedbackRate * 12 +
    hiringEvidence * 8
  );

  const signals = [
    {
      label: 'Tỷ lệ phản hồi',
      value: totalApps > 0 ? `${formatPercent(responseRate * 100)}%` : 'Chưa đủ dữ liệu',
      good: responseRate >= 0.6,
    },
    {
      label: 'Thời gian phản hồi trung bình',
      value: avgHours == null ? 'Chưa đủ dữ liệu' : `${Math.round(avgHours)} giờ`,
      good: avgHours == null || avgHours <= 72,
    },
    {
      label: 'Tin đã duyệt',
      value: `${row.approved_jobs || 0}/${row.total_jobs || 0}`,
      good: approvedRatio >= 0.7,
    },
    {
      label: 'Hồ sơ công ty',
      value: `${formatPercent(profileCompleteness * 100)}% hoàn thiện`,
      good: profileCompleteness >= 0.6,
    },
    {
      label: 'Phản hồi sau phỏng vấn',
      value: Number(row.scheduled_interviews || 0) > 0 ? `${formatPercent(feedbackRate * 100)}%` : 'Chưa đủ dữ liệu',
      good: feedbackRate >= 0.5,
    },
  ];

  return {
    company_name: row.company_name,
    score,
    label: score >= 78 ? 'Đáng tin cậy cao' : score >= 58 ? 'Đang có tín hiệu tốt' : 'Cần thêm dữ liệu xác thực',
    metrics: {
      total_jobs: Number(row.total_jobs || 0),
      approved_jobs: Number(row.approved_jobs || 0),
      total_applications: totalApps,
      responded_applications: Number(row.responded_applications || 0),
      hired_applications: Number(row.hired_applications || 0),
      scheduled_interviews: Number(row.scheduled_interviews || 0),
      interview_feedback_count: Number(row.interview_feedback_count || 0),
      avg_response_hours: avgHours,
    },
    signals,
  };
}

function buildInterviewCopilot(job) {
  const jobText = [job.job_description, job.job_requirements, job.industry].filter(Boolean).join(' ');
  const skills = extractJobSkills(job).slice(0, 8);
  const responsibilities = extractResponsibilities(jobText);
  const baseSkill = skills[0] || job.industry || job.job_title || 'công việc';
  const workContext = responsibilities[0] || `nhiệm vụ chính của vị trí ${job.job_title}`;
  const questions = [
    `Bạn hãy mô tả kinh nghiệm gần nhất liên quan đến ${baseSkill} và kết quả đo được.`,
    `Nếu được giao "${workContext}", bạn sẽ chia bước xử lý và kiểm soát rủi ro như thế nào?`,
    `Trong JD này, kỹ năng nào bạn tự tin nhất? Hãy nêu một ví dụ có số liệu hoặc kết quả cụ thể.`,
    `Khi deadline gấp nhưng yêu cầu chưa rõ, bạn sẽ làm gì để vẫn đảm bảo chất lượng công việc?`,
    `Bạn từng gặp lỗi/sự cố nào liên quan đến ${baseSkill}? Bạn tìm nguyên nhân và ngăn lỗi lặp lại ra sao?`,
    `Nếu phải phối hợp với đội khác để hoàn thành vị trí ${job.job_title}, bạn sẽ cập nhật tiến độ và xử lý xung đột thế nào?`,
  ].map((content, index) => ({
    id: index + 1,
    content,
    focus: skills[index % Math.max(skills.length, 1)] || baseSkill,
    answer_hint: 'Trả lời theo STAR: bối cảnh, nhiệm vụ, hành động, kết quả. Ưu tiên ví dụ thật và số liệu.',
  }));

  return {
    job: {
      id: job.id,
      title: job.job_title,
      company_name: job.company_name,
    },
    skills,
    responsibilities,
    questions,
    checklist: [
      'Chuẩn bị một ví dụ có số liệu cho kỹ năng quan trọng nhất trong JD.',
      'Đọc lại mô tả công việc và chọn 3 trách nhiệm bạn từng làm gần nhất.',
      'Chuẩn bị câu hỏi ngược về quy trình, KPI và kỳ vọng 30-60-90 ngày.',
    ],
    employer_rubric: [
      'Năng lực chuyên môn bám JD',
      'Tư duy giải quyết vấn đề',
      'Mức độ cụ thể của ví dụ',
      'Khả năng phối hợp và giao tiếp',
      'Động lực và mức độ phù hợp văn hóa',
    ],
  };
}

function buildWorkSimulation(job) {
  const skills = extractJobSkills(job).slice(0, 6);
  const responsibilities = extractResponsibilities([job.job_description, job.job_requirements].join('\n'));
  const primarySkill = skills[0] || job.industry || 'năng lực chuyên môn';
  const responsibility = responsibilities[0] || `xử lý một nhiệm vụ quan trọng của vị trí ${job.job_title}`;
  const normalizedTitle = normalizeText([job.job_title, job.industry].join(' '));
  const domain = normalizedTitle.includes('marketing')
    ? 'marketing'
    : normalizedTitle.includes('sales') || normalizedTitle.includes('ban hang')
      ? 'sales'
      : normalizedTitle.includes('hr') || normalizedTitle.includes('tuyen dung')
        ? 'hr'
        : normalizedTitle.includes('developer') || normalizedTitle.includes('frontend') || normalizedTitle.includes('backend') || normalizedTitle.includes('nodejs')
          ? 'tech'
          : 'operations';

  const prompts = {
    tech: `Bạn nhận một task có lỗi production liên quan tới ${primarySkill}. Hãy mô tả cách bạn tái hiện lỗi, tìm nguyên nhân, sửa, kiểm thử và phòng ngừa lặp lại.`,
    sales: `Một khách hàng tiềm năng quan tâm sản phẩm nhưng còn do dự về giá. Hãy viết kịch bản xử lý phản đối và kế hoạch follow-up trong 3 ngày.`,
    marketing: `Chiến dịch hiện tại có CTR thấp. Hãy phân tích nguyên nhân, đề xuất 3 thử nghiệm A/B và chỉ số bạn dùng để quyết định.`,
    hr: `Một ứng viên mạnh đang cân nhắc offer của đối thủ. Hãy lập kế hoạch trao đổi, đánh giá động lực và giữ trải nghiệm ứng viên tích cực.`,
    operations: `Quy trình hiện tại bị chậm ở bước "${responsibility}". Hãy đề xuất cách phân tích, cải tiến và đo hiệu quả sau triển khai.`,
  };

  return {
    job: {
      id: job.id,
      title: job.job_title,
      company_name: job.company_name,
    },
    domain,
    title: `Work Simulation: ${job.job_title}`,
    prompt: prompts[domain],
    expected_points: [
      'Làm rõ mục tiêu và ràng buộc',
      'Nêu quy trình xử lý từng bước',
      'Đưa ra tiêu chí đo kết quả',
      'Nhận diện rủi ro hoặc trường hợp ngoại lệ',
      'Có cách cải tiến sau khi hoàn thành',
    ],
    suggested_skills: skills,
  };
}

function scoreSimulationAnswer(answer, scenario) {
  const text = stripHtml(answer);
  const normalized = normalizeText(text);
  const expected = scenario.expected_points || [];
  const skillTerms = scenario.suggested_skills || [];
  const coverage = expected.filter((point) => {
    const terms = tokenize(point);
    return terms.some((term) => normalized.includes(term));
  }).length;
  const skillCoverage = skillTerms.filter((skill) => normalized.includes(normalizeText(skill))).length;
  const lengthScore = text.length >= 900 ? 25 : text.length >= 500 ? 20 : text.length >= 250 ? 14 : 8;
  const structureScore = /(bước|đầu tiên|sau đó|cuối cùng|kpi|chỉ số|rủi ro|đo lường|kiểm tra)/i.test(text) ? 20 : 10;
  const coverageScore = expected.length ? (coverage / expected.length) * 35 : 18;
  const skillScore = skillTerms.length ? Math.min(20, (skillCoverage / skillTerms.length) * 20) : 12;
  const score = Number(Math.max(0, Math.min(100, lengthScore + structureScore + coverageScore + skillScore)).toFixed(1));
  const feedback = {
    summary: score >= 75 ? 'Bài làm có cấu trúc tốt và bám tình huống.' : score >= 55 ? 'Bài làm có ý chính nhưng cần cụ thể hơn.' : 'Bài làm còn thiếu cấu trúc và ví dụ thực tế.',
    strengths: [
      structureScore >= 20 ? 'Có trình tự xử lý rõ ràng.' : null,
      skillCoverage > 0 ? 'Có nhắc tới kỹ năng/công cụ liên quan JD.' : null,
      text.length >= 500 ? 'Câu trả lời đủ độ chi tiết.' : null,
    ].filter(Boolean),
    improvements: [
      coverage < expected.length ? 'Bổ sung đầy đủ mục tiêu, rủi ro, chỉ số đo lường và bước cải tiến.' : null,
      skillCoverage === 0 ? 'Gắn câu trả lời với kỹ năng/công cụ trong JD.' : null,
      text.length < 500 ? 'Nên viết cụ thể hơn bằng ví dụ hoặc số liệu.' : null,
    ].filter(Boolean),
  };

  return { score, feedback };
}

async function getMySkillPassport(user) {
  assertRole(user, ['seeker']);
  return buildCandidatePassport(user.id);
}

async function getPublicSkillPassport(token) {
  await ensureTalentInsightSchema();
  const share = await repository.getPassportShareByToken(token);
  if (!share) throw new AppError('Skill Passport không tồn tại hoặc chưa được chia sẻ.', 404);
  const passport = await buildCandidatePassport(share.user_id);
  return {
    ...passport,
    profile: {
      ...passport.profile,
      email: null,
      phone: null,
    },
    applications: [],
  };
}

async function getJobFit(user, jobId) {
  assertRole(user, ['seeker']);
  await ensureTalentInsightSchema();

  const [job, cv, rawTests, certifications] = await Promise.all([
    repository.getJobById(jobId),
    repository.getPrimaryCv(user.id),
    repository.getCandidateTestSummaries(user.id, 5),
    repository.getCandidateCertifications(user.id),
  ]);

  if (!job) throw new AppError('Không tìm thấy việc làm.', 404);
  const tests = rawTests.map(normalizeTestScore);
  return {
    job: {
      id: job.id,
      title: job.job_title,
      company_name: job.company_name,
    },
    cv: cv ? { id: cv.id, title: cv.title, target_role: cv.target_role } : null,
    fit: scoreJobFit({ job, cv, tests, certifications }),
  };
}

async function getEmployerTrustForJob(jobId) {
  await ensureTalentInsightSchema();
  return buildTrustScore(await repository.getEmployerTrustByJobId(jobId));
}

async function getInterviewCopilotForJob(_user, jobId) {
  await ensureTalentInsightSchema();
  const job = await repository.getJobById(jobId);
  if (!job) throw new AppError('Không tìm thấy việc làm.', 404);
  return buildInterviewCopilot(job);
}

async function getEmployerInterviews(user) {
  assertRole(user, ['employer']);
  await ensureTalentInsightSchema();
  return {
    data: await repository.getEmployerInterviewApplications(user.id),
  };
}

function normalizeInterviewEvaluationPayload(body = {}) {
  const ratings = body.ratings && typeof body.ratings === 'object' ? body.ratings : {};
  const recommendation = ['strong_yes', 'yes', 'consider', 'no'].includes(body.recommendation)
    ? body.recommendation
    : 'consider';

  return {
    ratings,
    strengths: String(body.strengths || '').trim(),
    concerns: String(body.concerns || '').trim(),
    recommendation,
    feedback_to_candidate: String(body.feedback_to_candidate || '').trim(),
  };
}

async function saveInterviewEvaluationForEmployer(employerId, applicationId, body = {}) {
  await ensureTalentInsightSchema();

  const application = await repository.getApplicationForEmployer(applicationId, employerId);
  if (!application) throw new AppError('Không tìm thấy hồ sơ ứng tuyển thuộc quyền quản lý.', 404);

  return repository.upsertInterviewEvaluation(
    application,
    employerId,
    normalizeInterviewEvaluationPayload(body)
  );
}

async function saveInterviewEvaluation(user, applicationId, body = {}) {
  assertRole(user, ['employer']);
  return saveInterviewEvaluationForEmployer(user.id, applicationId, body);
}

async function getWorkSimulationForJob(_user, jobId) {
  await ensureTalentInsightSchema();
  const job = await repository.getJobById(jobId);
  if (!job) throw new AppError('Không tìm thấy việc làm.', 404);
  return {
    scenario: buildWorkSimulation(job),
  };
}

async function submitWorkSimulation(user, jobId, body = {}) {
  assertRole(user, ['seeker']);
  await ensureTalentInsightSchema();
  const job = await repository.getJobById(jobId);
  if (!job) throw new AppError('Không tìm thấy việc làm.', 404);

  const answer = String(body.answer || '').trim();
  if (answer.length < MIN_SIMULATION_ANSWER_LENGTH) {
    throw new AppError(`Bài làm cần ít nhất ${MIN_SIMULATION_ANSWER_LENGTH} ký tự để hệ thống chấm điểm.`, 400);
  }

  const scenario = body.scenario && typeof body.scenario === 'object' ? body.scenario : buildWorkSimulation(job);
  const { score, feedback } = scoreSimulationAnswer(answer, scenario);
  const saved = await repository.insertWorkSimulationSubmission({
    userId: user.id,
    jobId,
    scenario,
    answer,
    score,
    feedback,
  });

  return {
    submission: saved,
    score,
    feedback,
  };
}

async function getLatestWorkSimulation(user, jobId) {
  assertRole(user, ['seeker']);
  await ensureTalentInsightSchema();
  return {
    data: await repository.getLatestWorkSimulationSubmission(user.id, jobId),
  };
}

module.exports = {
  getEmployerInterviews,
  getEmployerTrustForJob,
  getInterviewCopilotForJob,
  getJobFit,
  getLatestWorkSimulation,
  getMySkillPassport,
  getPublicSkillPassport,
  getWorkSimulationForJob,
  saveInterviewEvaluationForEmployer,
  saveInterviewEvaluation,
  submitWorkSimulation,
};
