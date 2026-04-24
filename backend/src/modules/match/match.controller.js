const pool = require('../../infrastructure/database/postgres');
const { getNearestDistanceForAddress } = require('../../core/utils/locationCoordinates');

// ─── Weights ────────────────────────────────────────────────────────────────────
const WEIGHT_SKILL     = 0.40;
const WEIGHT_TITLE     = 0.25;
const WEIGHT_INDUSTRY  = 0.15;
const WEIGHT_LOCATION  = 0.20;

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Strip all HTML tags and decode common entities → plain text */
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

/**
 * Normalize Vietnamese text: remove diacritics, lowercase, trim.
 * Useful for fuzzy matching.
 */
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

/**
 * Tokenize text into meaningful words (length >= 2).
 */
function tokenize(text) {
  return normalizeVN(text)
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/**
 * Extract key terms from CV HTML.
 * Returns { skills[], title, industry, rawText }.
 */
function extractCvInfo(htmlContent = '', targetRole = '') {
  const plainText = stripHtml(htmlContent);
  const normalizedText = normalizeVN(plainText);

  // Common skill keywords found in Vietnamese CVs
  const commonSkillPatterns = [
    // Programming & Tech
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
    // Business & Soft skills
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

  // Also try to extract skills from sections titled "Kỹ năng" / "Skills"
  const skillSectionMatch = plainText.match(/(?:kỹ\s*năng|skills?|chuyên\s*môn)[:\s]*([\s\S]{10,500}?)(?=(?:kinh\s*nghiệm|học\s*vấn|chứng\s*chỉ|sở\s*thích|mục\s*tiêu|$))/i);
  if (skillSectionMatch) {
    const sectionTokens = tokenize(skillSectionMatch[1]);
    // Add any multi-word tokens that look like skills
    for (let i = 0; i < sectionTokens.length - 1; i++) {
      const bigram = `${sectionTokens[i]} ${sectionTokens[i + 1]}`;
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

// ─── Scoring functions ──────────────────────────────────────────────────────────

/**
 * Skill matching score (0-100).
 * Checks how many CV skills appear in job requirements/description.
 */
function scoreSkills(cvSkills, jobText) {
  if (!cvSkills.length || !jobText) return 0;

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

  // Score = percentage of CV skills found in job, capped at 100
  const rawScore = (matchCount / cvSkills.length) * 100;
  return { score: Math.min(100, Math.round(rawScore)), matchedSkills };
}

/**
 * Title/role matching score (0-100).
 * Checks overlap between CV target role and job title.
 */
function scoreTitle(cvTitle, jobTitle) {
  if (!cvTitle || !jobTitle) return 0;

  const cvTokens = tokenize(cvTitle);
  const jobTokens = tokenize(jobTitle);
  if (!cvTokens.length || !jobTokens.length) return 0;

  let matchCount = 0;
  for (const token of cvTokens) {
    if (jobTokens.some((jt) => jt.includes(token) || token.includes(jt))) {
      matchCount++;
    }
  }

  return Math.min(100, Math.round((matchCount / cvTokens.length) * 100));
}

/**
 * Industry matching score (0-100).
 */
function scoreIndustry(cvText, jobIndustry) {
  if (!cvText || !jobIndustry) return 0;

  const industryTokens = tokenize(jobIndustry);
  if (!industryTokens.length) return 0;

  let matchCount = 0;
  for (const token of industryTokens) {
    if (cvText.includes(token)) {
      matchCount++;
    }
  }

  return Math.min(100, Math.round((matchCount / industryTokens.length) * 100));
}

/**
 * Location matching score (0-100).
 * Uses Haversine distance. Closer = higher score.
 * - 0-10km  → 100
 * - 10-30km → 80-99
 * - 30-50km → 50-79
 * - 50-100km → 20-49
 * - >100km  → 0-19
 */
function scoreLocation(distanceKm) {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm)) {
    return 0;
  }

  if (distanceKm <= 10) return 100;
  if (distanceKm <= 30) return Math.round(100 - (distanceKm - 10) * 1);
  if (distanceKm <= 50) return Math.round(80 - (distanceKm - 30) * 1.5);
  if (distanceKm <= 100) return Math.round(50 - (distanceKm - 50) * 0.6);
  if (distanceKm <= 200) return Math.round(20 - (distanceKm - 100) * 0.1);
  return 0;
}

/**
 * Build human-readable match reasons (Vietnamese).
 */
function buildMatchReasons(skillResult, titleScore, industryScore, locationScore, distanceKm, jobTitle) {
  const reasons = [];

  if (skillResult.score >= 50 && skillResult.matchedSkills.length > 0) {
    const topSkills = skillResult.matchedSkills.slice(0, 3).join(', ');
    reasons.push({ type: 'skill', icon: '✅', text: `Kỹ năng phù hợp: ${topSkills}` });
  } else if (skillResult.score >= 20) {
    reasons.push({ type: 'skill', icon: '🔶', text: `Có một số kỹ năng liên quan` });
  }

  if (titleScore >= 60) {
    reasons.push({ type: 'title', icon: '🎯', text: `Chức danh khớp với mục tiêu CV` });
  }

  if (industryScore >= 40) {
    reasons.push({ type: 'industry', icon: '📋', text: `Ngành nghề phù hợp` });
  }

  if (locationScore >= 80 && Number.isFinite(distanceKm)) {
    reasons.push({ type: 'location', icon: '📍', text: `Gần vị trí của bạn (${Math.round(distanceKm)} km)` });
  } else if (locationScore >= 40 && Number.isFinite(distanceKm)) {
    reasons.push({ type: 'location', icon: '📍', text: `Cách ${Math.round(distanceKm)} km` });
  }

  if (!reasons.length) {
    reasons.push({ type: 'general', icon: '💼', text: `Tin tuyển dụng mới phù hợp` });
  }

  return reasons;
}

// ─── Main controller ────────────────────────────────────────────────────────────

/**
 * GET /api/match/recommendations
 * Returns AI-scored job recommendations based on the user's primary CV.
 *
 * Query params:
 *  - limit (default 10, max 20)
 *  - lat, lng (optional — for location scoring)
 */
exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
    const origin = hasCoordinates ? { lat, lng } : null;

    // 1. Fetch user's primary CV (or latest)
    const cvResult = await pool.query(
      `SELECT id, title, target_role, html_content
       FROM user_cvs
       WHERE user_id = $1
       ORDER BY is_primary DESC, created_at DESC, id DESC
       LIMIT 1`,
      [userId]
    );

    if (!cvResult.rows.length) {
      return res.json({
        data: [],
        cv_status: 'no_cv',
        message: 'Bạn chưa có CV. Hãy tạo CV để nhận gợi ý việc làm phù hợp.',
      });
    }

    const cv = cvResult.rows[0];
    const cvInfo = extractCvInfo(cv.html_content, cv.target_role);

    if (!cvInfo.skills.length && !cvInfo.title) {
      return res.json({
        data: [],
        cv_status: 'insufficient',
        message: 'CV chưa có đủ thông tin kỹ năng. Hãy bổ sung kỹ năng để nhận gợi ý chính xác hơn.',
      });
    }

    // 2. Fetch a pool of candidate jobs (latest 200 approved jobs)
    const jobsResult = await pool.query(
      `SELECT id, job_title as title, job_description as description,
              job_requirements as requirements, benefits,
              job_address as location, job_type, salary,
              company_name, company_address, industry,
              career_level, created_at
       FROM jobs
       WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'
       ORDER BY created_at DESC NULLS LAST, id DESC
       LIMIT 200`
    );

    if (!jobsResult.rows.length) {
      return res.json({
        data: [],
        cv_status: 'ok',
        message: 'Hiện tại chưa có tin tuyển dụng nào.',
      });
    }

    // 3. Fetch user's already-applied job IDs to exclude them
    const appliedResult = await pool.query(
      `SELECT job_id FROM applied_jobs WHERE user_id = $1`,
      [userId]
    );
    const appliedJobIds = new Set(appliedResult.rows.map((r) => r.job_id));

    // 4. Score each job
    const scored = [];
    for (const job of jobsResult.rows) {
      // Skip jobs user already applied to
      if (appliedJobIds.has(job.id)) continue;

      const jobFullText = [job.title, job.description, job.requirements, job.benefits].filter(Boolean).join(' ');

      // Skill score
      const skillResult = scoreSkills(cvInfo.skills, jobFullText);

      // Title score
      const titleScore = scoreTitle(cvInfo.title, job.title);

      // Industry score
      const industryScore = scoreIndustry(cvInfo.rawText, job.industry);

      // Location score
      let distanceKm = null;
      let locationScore = 0;
      if (origin) {
        const addressText = [job.location, job.company_address, job.company_name].filter(Boolean).join(' ');
        distanceKm = getNearestDistanceForAddress(origin, addressText);
        locationScore = scoreLocation(distanceKm);
      }

      // Weighted total
      const totalScore = Math.round(
        WEIGHT_SKILL * skillResult.score +
        WEIGHT_TITLE * titleScore +
        WEIGHT_INDUSTRY * industryScore +
        WEIGHT_LOCATION * locationScore
      );

      // Only include if score is meaningful (> 10)
      if (totalScore > 10) {
        const reasons = buildMatchReasons(skillResult, titleScore, industryScore, locationScore, distanceKm, job.title);

        scored.push({
          ...job,
          match_score: totalScore,
          match_details: {
            skill_score: skillResult.score,
            title_score: titleScore,
            industry_score: industryScore,
            location_score: locationScore,
            distance_km: distanceKm !== null ? Number(distanceKm.toFixed(1)) : null,
          },
          match_reasons: reasons,
        });
      }
    }

    // 5. Sort by score descending, then by recency
    scored.sort((a, b) => {
      if (b.match_score !== a.match_score) return b.match_score - a.match_score;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    // 6. Return top N
    res.json({
      data: scored.slice(0, limit),
      cv_status: 'ok',
      cv_skills: cvInfo.skills,
      cv_title: cv.target_role || '',
    });
  } catch (err) {
    console.error('Match recommendations error:', err);
    res.status(500).json({ error: 'Lỗi khi tính gợi ý việc làm' });
  }
};
