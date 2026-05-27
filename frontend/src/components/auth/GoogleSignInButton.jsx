import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const GOOGLE_SCRIPT_ID = 'google-identity-services-script';
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '4615580608-8d4ng3atlmmgb404tpce6lp2p4cjdedn.apps.googleusercontent.com';
const SCRIPT_LOAD_TIMEOUT_MS = 4000;
const BUTTON_RENDER_CHECK_MS = 1200;

let googleScriptPromise;

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID)
      || document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    const script = existingScript || document.createElement('script');

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    const fail = () => {
      cleanup();
      googleScriptPromise = null;
      reject(new Error('Không thể tải Google Sign-In'));
    };

    const handleLoad = () => {
      cleanup();
      if (!window.google?.accounts?.id) {
        fail();
        return;
      }
      script.dataset.loaded = 'true';
      resolve(window.google);
    };

    const handleError = () => fail();
    const timeoutId = window.setTimeout(fail, SCRIPT_LOAD_TIMEOUT_MS);

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (script.dataset.loaded === 'true') {
      handleLoad();
    }
  });

  return googleScriptPromise;
}

function getButtonWidth(container) {
  const width = container.parentElement?.getBoundingClientRect().width || 350;
  return Math.min(400, Math.max(280, Math.floor(width)));
}

function GoogleLogo({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.12H12v4.01h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.89a6 6 0 0 1 0-3.78V7.52H3.06a10 10 0 0 0 0 8.96l3.34-2.59Z" />
      <path fill="#EA4335" d="M12 5.98c1.47 0 2.8.51 3.84 1.5l2.86-2.86A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.94 5.52l3.34 2.59c.79-2.37 3-4.13 5.6-4.13Z" />
    </svg>
  );
}

export default function GoogleSignInButton({
  label,
  mode = 'signin',
  onCredential,
  onError,
}) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);

  const initializeGoogle = useCallback(async () => {
    const google = await loadGoogleIdentityScript();
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: onCredential,
      itp_support: true,
      use_fedcm_for_prompt: true,
    });
    return google;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;
    let renderCheckId;
    let renderedContainer;

    async function renderNativeButton() {
      setStatus('loading');

      try {
        const google = await initializeGoogle();
        if (cancelled || !containerRef.current) return;

        const container = containerRef.current;
        renderedContainer = container;
        container.innerHTML = '';
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: getButtonWidth(container),
        });

        renderCheckId = window.setTimeout(() => {
          if (cancelled) return;
          setStatus(container.querySelector('iframe') ? 'native' : 'fallback');
        }, BUTTON_RENDER_CHECK_MS);
      } catch {
        if (!cancelled) setStatus('fallback');
      }
    }

    renderNativeButton();

    return () => {
      cancelled = true;
      window.clearTimeout(renderCheckId);
      if (renderedContainer) renderedContainer.innerHTML = '';
    };
  }, [initializeGoogle, mode]);

  const handleFallbackClick = useCallback(async () => {
    setBusy(true);
    try {
      const google = await initializeGoogle();
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
          onError?.('Google chưa thể mở cửa sổ đăng nhập. Vui lòng tắt chặn nội dung hoặc thử trình duyệt khác.');
        }
      });
    } catch {
      onError?.('Không thể tải Google Sign-In. Vui lòng kiểm tra kết nối hoặc tắt chặn nội dung.');
    } finally {
      setBusy(false);
    }
  }, [initializeGoogle, onError]);

  return (
    <div className="relative min-h-11">
      <div
        ref={containerRef}
        aria-hidden={status !== 'native'}
        className={status === 'native' ? 'flex w-full justify-center' : 'pointer-events-none absolute -left-[9999px] top-0'}
      />

      {status !== 'native' && (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={status === 'loading' || busy}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 disabled:cursor-wait disabled:text-gray-400"
        >
          {status === 'loading' || busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleLogo />}
          <span>{status === 'loading' ? 'Đang tải Google...' : label}</span>
        </button>
      )}
    </div>
  );
}
