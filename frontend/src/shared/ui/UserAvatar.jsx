import { useState } from 'react';
import { User } from 'lucide-react';

function shouldRenderImage(src) {
  const normalized = String(src || '').trim();
  if (!normalized) return false;

  const sentinelValues = new Set(['user', 'default-user', 'default_avatar']);
  return !sentinelValues.has(normalized.toLowerCase());
}

export default function UserAvatar({
  src,
  alt = 'Ảnh đại diện',
  className = '',
  fallbackClassName = '',
  iconClassName = '',
}) {
  const normalizedSrc = String(src || '').trim();
  const [failedSrc, setFailedSrc] = useState('');
  const canRenderImage = shouldRenderImage(normalizedSrc) && failedSrc !== normalizedSrc;

  if (canRenderImage) {
    return <img src={normalizedSrc} alt={alt} className={className} onError={() => setFailedSrc(normalizedSrc)} />;
  }

  return (
    <div className={fallbackClassName || className}>
      <User className={iconClassName} />
    </div>
  );
}
