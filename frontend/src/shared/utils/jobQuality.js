export function getTodayDateInputValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function getNowDateTimeLocalValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function countWords(value = '') {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function hasExplicitSalary(payload) {
  const salaryText = String(payload.salary || '').trim().toLowerCase();
  const hasSalaryRange = Boolean(payload.salary_min || payload.salary_max);
  return hasSalaryRange || (salaryText && !/th[oỏ]a\s*thu[aậ]n/.test(salaryText));
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(tag => String(tag || '').trim()).filter(Boolean);
  return String(tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
}

export function analyzeJobQuality(payload = {}) {
  const suggestions = [];
  let score = 100;

  const title = String(payload.title || '').trim();
  const descriptionWords = countWords(payload.description);
  const requirementWords = countWords(payload.requirements);
  const benefitWords = countWords(payload.benefits);
  const tags = normalizeTags(payload.tags);
  const today = getTodayDateInputValue();

  const addIssue = (severity, text, penalty) => {
    suggestions.push({ severity, text });
    score -= penalty;
  };

  if (title.length < 12) {
    addIssue('high', 'Tiêu đề nên nêu rõ vị trí và công nghệ/chuyên môn chính.', 14);
  } else if (title.length > 90) {
    addIssue('medium', 'Tiêu đề đang hơi dài, nên rút gọn để ứng viên quét nhanh hơn.', 7);
  }

  if (descriptionWords < 45) {
    addIssue('high', 'Mô tả công việc còn ngắn, nên bổ sung nhiệm vụ hằng ngày và phạm vi trách nhiệm.', 18);
  }

  if (requirementWords < 25) {
    addIssue('medium', 'Yêu cầu ứng viên nên có kỹ năng bắt buộc, kỹ năng cộng điểm và mức kinh nghiệm.', 12);
  }

  if (benefitWords < 18) {
    addIssue('medium', 'Quyền lợi nên cụ thể hơn: thưởng, bảo hiểm, thiết bị, đào tạo, remote/hybrid.', 10);
  }

  if (!hasExplicitSalary(payload)) {
    addIssue('high', 'Nên công khai khoảng lương để tăng tỉ lệ ứng tuyển.', 16);
  }

  if (!payload.deadline) {
    addIssue('medium', 'Nên đặt hạn nộp hồ sơ để ứng viên biết độ khẩn của tin.', 8);
  } else if (String(payload.deadline) < today) {
    addIssue('high', 'Hạn nộp hồ sơ đang nhỏ hơn ngày hiện tại.', 20);
  }

  if (!payload.location && !payload.currentLocation) {
    addIssue('medium', 'Tin nên có địa điểm làm việc rõ ràng.', 8);
  }

  if (tags.length < 3) {
    addIssue('low', 'Thêm ít nhất 3 từ khóa để job alert và tìm kiếm hoạt động tốt hơn.', 6);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    label: score >= 80 ? 'Tin mạnh' : score >= 60 ? 'Cần bổ sung' : 'Nên chỉnh trước khi đăng',
    tone: score >= 80 ? 'emerald' : score >= 60 ? 'amber' : 'red',
    suggestions: suggestions.length ? suggestions : [{ severity: 'low', text: 'Tin đã đủ thông tin chính. Hãy đảm bảo nội dung đúng thực tế tuyển dụng hiện tại.' }],
  };
}
