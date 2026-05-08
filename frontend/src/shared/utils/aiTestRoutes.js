export function getAiTestKind(testType) {
  const normalized = String(testType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'video_ai') return 'video-ai';
  if (normalized === 'avatar_live3d' || normalized === 'avatar_live2d' || normalized.includes('live3d') || normalized.includes('live2d')) {
    return 'avatar-live3d';
  }
  return 'trac-nghiem';
}

export function getSeekerAiTestPath(testId, testType) {
  return `/seeker/ai-tests/${getAiTestKind(testType)}/${testId}`;
}
