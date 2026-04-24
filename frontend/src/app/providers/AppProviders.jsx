import { AuthProvider } from '@features/auth/AuthContext';
import { NotificationProvider } from '@features/notifications/NotificationContext';

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  );
}
