import { useState } from 'react';
import { Cookie } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'aptertekwork_cookie_consent';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COOKIE_CONSENT_KEY) !== 'accepted';
  });

  const acceptAllCookies = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[90] px-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-lg border border-indigo-100/60 bg-white/95 p-4 shadow-lg shadow-gray-900/10 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 gap-3">
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 sm:flex">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">Website sử dụng cookie</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
              Chúng tôi dùng cookie để cải thiện trải nghiệm, ghi nhớ tuỳ chọn và phân tích hoạt động trên website.
              Bạn có thể tìm hiểu thêm trong chính sách quyền riêng tư.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href="/blog"
            className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
          >
            Tìm hiểu thêm
          </a>
          <button
            type="button"
            onClick={acceptAllCookies}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white transition-colors hover:from-indigo-700 hover:to-violet-700"
          >
            Chấp nhận
          </button>
        </div>
      </div>
    </div>
  );
}
