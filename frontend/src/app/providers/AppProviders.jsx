import { AuthProvider } from '@features/auth/AuthContext';
import { NotificationProvider } from '@features/notifications/NotificationContext';
import CookieConsentBanner from '@shared/ui/CookieConsentBanner';

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        {children}
        <CookieConsentBanner />
      </NotificationProvider>
    </AuthProvider>
  );
}
