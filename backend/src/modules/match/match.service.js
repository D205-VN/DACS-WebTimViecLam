const { getNearestDistanceForAddress } = require('../../core/utils/locationCoordinates');
const { ensureJobStatusSchema, ensurePublicApplicationSchema } = require('../jobs/job.model');
const repository = require('./match.repository');

const WEIGHT_SKILL = 0.35;
const WEIGHT_TITLE = 0.20;
const WEIGHT_INDUSTRY = 0.15;
const WEIGHT_LOCATION = 0.15;
const WEIGHT_HISTORY = 0.15;

function stripHtml(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#[0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeVN(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeVN(text)
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

function extractCvInfo(htmlContent = '', targetRole = '') {
  const plainText = stripHtml(htmlContent);
  const normalizedText = normalizeVN(plainText);
  const commonSkillPatterns = [
    'javascript', 'typescript', 'python', 'java', 'c\\+\\+', 'c#', 'php', 'ruby', 'golang', 'go',
    'react', 'reactjs', 'react.js', 'angular', 'vue', 'vuejs', 'vue.js', 'nextjs', 'next.js',
    'nodejs', 'node.js', 'express', 'nestjs', 'django', 'flask', 'spring', 'laravel',
    'html', 'css', 'sass', 'tailwind', 'bootstrap',
    'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch',
    'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'ci/cd', 'cicd',
    'git', 'github', 'gitlab', 'jira', 'figma', 'photoshop', 'illustrator',
    'api', 'rest', 'graphql', 'microservices',
    'linux', 'devops', 'terraform', 'jenkins',
    'machine learning', 'deep learning', 'ai', 'data science', 'data analysis',
    'power bi', 'tableau', 'excel',
    'marketing', 'seo', 'sem', 'google ads', 'facebook ads',
    'sales', 'crm', 'erp', 'sap',
    'accounting', 'ke toan', 'tai chinh', 'ngan hang',
    'project management', 'agile', 'scrum',
    'communication', 'teamwork', 'leadership',
    'english', 'tieng anh', 'ielts', 'toeic', 'toefl',
    'autocad', 'solidworks', 'revit',
  ];
  const foundSkills = [];

  for (const pattern of commonSkillPatterns) {
    const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(normalizedText) || regex.test(plainText.toLowerCase())) {
      foundSkills.push(pattern.replace(/\\/g, ''));
    }
  }

  const skillSectionMatch = plainText.match(/(?:kỹ\s*năng|skills?|chuyên\s*môn)[:\s]*([\s\S]{10,500}?)(?=(?:kinh\s*nghiệm|học\s*vấn|chứng\s*chỉ|sở\s*thích|mục\s*tiêu|$))/i);
  if (skillSectionMatch) {
    const sectionTokens = tokenize(skillSectionMatch[1]);
    for (let index = 0; index < sectionTokens.length - 1; index += 1) {
      const bigram = `${sectionTokens[index]} ${sectionTokens[index + 1]}`;
      if (bigram.length >= 4 && !foundSkills.includes(bigram)) {
        foundSkills.push(bigram);
      }
    }
  }

  return {
    skills: [...new Set(foundSkills)],
    title: normalizeVN(targetRole),
    rawText: normalizedText,
    rawPlain: plainText,
  };
}

function scoreSkills(cvSkills, jobText) {
  if (!cvSkills.length || !jobText) return { score: 0, matchedSkills: [] };

  const normalizedJobText = normalizeVN(jobText);
  let matchCount = 0;
  const matchedSkills = [];

  for (const skill of cvSkills) {
    const normalizedSkill = normalizeVN(skill);
    if (
      normalizedJobText.includes(normalizedSkill) ||
      jobText.toLowerCase().includes(skill.toLowerCase())
    ) {
      matchCount++;
      matchedSkills.push(skill);
    }
  }

  const rawScore = (matchCount / cvSkills.length) * 100;
  return { score: Math.min(100, Math.round(rawScore)), matchedSkills };
}

function scoreTitle(cvTitle, jobTitle) {
  if (!cvTitle || !jobTitle) return 0;

  const cvTokens = tokenize(cvTitle);
  const jobTokens = tokenize(jobTitle);
  if (!cvTokens.length || !jobTokens.length) return 0;

  const matchCount = cvTokens.reduce((count, token) => (
    count + (jobTokens.some((jobToken) => jobToken.includes(token) || token.includes(jobToken)) ? 1 : 0)
  ), 0);

  return Math.min(100, Math.round((matchCount / cvTokens.length) * 100));
}

function scoreIndustry(cvText, jobIndustry) {
  if (!cvText || !jobIndustry) return 0;

  const industryTokens = tokenize(jobIndustry);
  if (!industryTokens.length) return 0;

  const matchCount = industryTokens.reduce((count, token) => count + (cvText.includes(token) ? 1 : 0), 0);
  return Math.min(100, Math.round((matchCount / industryTokens.length) * 100));
}

function scoreApplicationHistory(historyText, jobText) {
  if (!historyText || !jobText) return 0;

  const historyTokens = new Set(tokenize(historyText));
  const jobTokens = [...new Set(tokenize(jobText))].slice(0, 30);
  if (!historyTokens.size || !jobTokens.length) return 0;

  const matchCount = jobTokens.reduce((count, token) => count + (historyTokens.has(token) ? 1 : 0), 0);
  const denominator = Math.min(jobTokens.length, 12);

  return Math.min(100, Math.round((matchCount / Math.max(denominator, 1)) * 100));
}

function scoreLocation(distanceKm) {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm)) return 0;
  if (distanceKm <= 10) return 100;
  if (distanceKm <= 30) return Math.round(100 - (distanceKm - 10) * 1);
  if (distanceKm <= 50) return Math.round(80 - (distanceKm - 30) * 1.5);
  if (distanceKm <= 100) return Math.round(50 - (distanceKm - 50) * 0.6);
  if (distanceKm <= 200) return Math.round(20 - (distanceKm - 100) * 0.1);
  return 0;
}

function buildMatchReasons(skillResult, titleScore, industryScore, locationScore, historyScore, distanceKm) {
  const reasons = [];

  if (skillResult.score >= 50 && skillResult.matchedSkills.length > 0) {
    reasons.push({ type: 'skill', icon: '✅', text: `Kỹ năng phù hợp: ${skillResult.matchedSkills.slice(0, 3).join(', ')}` });
  } else if (skillResult.score >= 20) {
    reasons.push({ type: 'skill', icon: '🔶', text: 'Có một số kỹ năng liên quan' });
  }

  if (titleScore >= 60) reasons.push({ type: 'title', icon: '🎯', text: 'Chức danh khớp với mục tiêu CV' });
  if (industryScore >= 40) reasons.push({ type: 'industry', icon: '📋', text: 'Ngành nghề phù hợp' });
  if (historyScore >= 35) reasons.push({ type: 'history', icon: '📌', text: 'Liên quan đến lịch sử ứng tuyển của bạn' });

  if (locationScore >= 80 && Number.isFinite(distanceKm)) {
    reasons.push({ type: 'location', icon: '📍', text: `Gần vị trí của bạn (${Math.round(distanceKm)} km)` });
  } else if (locationScore >= 40 && Number.isFinite(distanceKm)) {
    reasons.push({ type: 'location', icon: '📍', text: `Cách ${Math.round(distanceKm)} km` });
  }

  if (!reasons.length) reasons.push({ type: 'general', icon: '💼', text: 'Tin tuyển dụng mới phù hợp' });
  return reasons;
}

function parseRecommendationQuery(query = {}) {
  const requestedLimit = Number.parseInt(query.limit, 10);
  const limit = Math.min(Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 10, 20);
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

  return {
    limit,
    origin: hasCoordinates ? { lat, lng } : null,
  };
}

function buildApplicationHistoryText(rows) {
  return normalizeVN(
    rows
      .map((row) => [row.job_title, row.industry, row.job_description, row.job_requirements].filter(Boolean).join(' '))
      .join(' ')
  );
}

function scoreJob({ job, cvInfo, applicationHistoryText, origin }) {
  const jobFullText = [job.title, job.description, job.requirements, job.benefits].filter(Boolean).join(' ');
  const skillResult = scoreSkills(cvInfo.skills, jobFullText);
  const titleScore = scoreTitle(cvInfo.title, job.title);
  const industryScore = scoreIndustry(cvInfo.rawText, job.industry);
  const historyScore = scoreApplicationHistory(applicationHistoryText, jobFullText);
  let distanceKm = null;
  let locationScore = 0;

  if (origin) {
    const addressText = [job.location, job.company_address, job.company_name].filter(Boolean).join(' ');
    distanceKm = getNearestDistanceForAddress(origin, addressText);
    locationScore = scoreLocation(distanceKm);
  }

  const totalScore = Math.round(
    WEIGHT_SKILL * skillResult.score +
    WEIGHT_TITLE * titleScore +
    WEIGHT_INDUSTRY * industryScore +
    WEIGHT_LOCATION * locationScore +
    WEIGHT_HISTORY * historyScore
  );

  if (totalScore <= 10) return null;

  return {
    ...job,
    match_score: totalScore,
    match_details: {
      skill_score: skillResult.score,
      title_score: titleScore,
      industry_score: industryScore,
      history_score: historyScore,
      location_score: locationScore,
      distance_km: distanceKm !== null ? Number(distanceKm.toFixed(1)) : null,
    },
    match_reasons: buildMatchReasons(skillResult, titleScore, industryScore, locationScore, historyScore, distanceKm),
  };
}

async function getRecommendations(userId, query = {}) {
  await ensureJobStatusSchema();
  await ensurePublicApplicationSchema();

  const { limit, origin } = parseRecommendationQuery(query);
  const cv = await repository.findPrimaryOrLatestCv(userId);
  if (!cv) {
    return {
      data: [],
      cv_status: 'no_cv',
      message: 'Bạn chưa có CV. Hãy tạo CV để nhận gợi ý việc làm phù hợp.',
    };
  }

  const cvInfo = extractCvInfo(cv.html_content, cv.target_role);
  if (!cvInfo.skills.length && !cvInfo.title) {
    return {
      data: [],
      cv_status: 'insufficient',
      message: 'CV chưa có đủ thông tin kỹ năng. Hãy bổ sung kỹ năng để nhận gợi ý chính xác hơn.',
    };
  }

  const [jobs, appliedJobIds, historyRows] = await Promise.all([
    repository.findCandidateJobs(200),
    repository.findAppliedJobIds(userId),
    repository.findApplicationHistory(userId),
  ]);

  if (!jobs.length) {
    return {
      data: [],
      cv_status: 'ok',
      message: 'Hiện tại chưa có tin tuyển dụng nào.',
    };
  }

  const appliedJobIdSet = new Set(appliedJobIds);
  const applicationHistoryText = buildApplicationHistoryText(historyRows);
  const scored = jobs
    .filter((job) => !appliedJobIdSet.has(job.id))
    .map((job) => scoreJob({ job, cvInfo, applicationHistoryText, origin }))
    .filter(Boolean)
    .sort((left, right) => {
      if (right.match_score !== left.match_score) return right.match_score - left.match_score;
      return new Date(right.created_at || 0) - new Date(left.created_at || 0);
    });

  return {
    data: scored.slice(0, limit),
    cv_status: 'ok',
    cv_skills: cvInfo.skills,
    cv_title: cv.target_role || '',
  };
}

module.exports = {
  getRecommendations,
};
