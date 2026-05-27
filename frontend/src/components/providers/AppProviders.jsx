import { AuthProvider } from '@components/providers/AuthContext';
import { NotificationProvider } from '@components/providers/NotificationContext';
import CookieConsentBanner from '@components/ui/CookieConsentBanner';

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
