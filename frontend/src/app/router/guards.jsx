import { Navigate } from 'react-router-dom';
import { useAuth } from '@features/auth/AuthContext';
import { getDefaultRouteByRole } from '@shared/utils/roleRedirect';

function RouteLoader() {
  return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-700"></div>
    </div>
  );
}

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}

export function EmployerRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role_code !== 'employer') {
    return <Navigate to={getDefaultRouteByRole(user?.role_code)} replace />;
  }

  return children;
}

export function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role_code !== 'admin') {
    return <Navigate to={getDefaultRouteByRole(user?.role_code)} replace />;
  }

  return children;
}

export function SeekerRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role_code !== 'seeker') {
    return <Navigate to={getDefaultRouteByRole(user?.role_code)} replace />;
  }

  return children;
}
