import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import CompaniesPage from './pages/CompaniesPage';
import BlogPage from './pages/BlogPage';
import BlogDetailPage from './pages/BlogDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ProfilePage from './pages/ProfilePage';
import JobDetailPage from './pages/JobDetailPage';
import SavedJobsPage from './pages/SavedJobsPage';
import AppliedJobsPage from './pages/AppliedJobsPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import CVBuilderPage from './pages/seeker/CVBuilderPage';
import ManageCVsPage from './pages/seeker/ManageCVsPage';
import CVImportImagePage from './pages/seeker/CVImportImagePage';
import EmployerDashboard from './pages/employer/EmployerDashboard';
import PostJob from './pages/employer/PostJob';
import { getDefaultRouteByRole } from './utils/roleRedirect';

function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50/80 flex flex-col">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}

// Protected route wrapper (requires login)
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-700"></div></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// Employer-only route wrapper (requires login + role employer)
function EmployerRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-700"></div></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role_code !== 'employer') return <Navigate to={getDefaultRouteByRole(user?.role_code)} replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-700"></div></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role_code !== 'admin') return <Navigate to={getDefaultRouteByRole(user?.role_code)} replace />;
  return children;
}

function SeekerRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-700"></div></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role_code !== 'seeker') return <Navigate to={getDefaultRouteByRole(user?.role_code)} replace />;
  return children;
}
// Auto-redirect based on role when visiting /
function RoleBasedHome() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-700"></div></div>;
  if (isAuthenticated) {
    if (user?.role_code === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user?.role_code === 'employer') return <Navigate to="/employer/dashboard" replace />;
    if (user?.role_code === 'seeker') return <Navigate to="/seeker/home" replace />;
  }
  return <MainLayout><HomePage /></MainLayout>;
}

const router = createBrowserRouter([
  { path: '/', element: <RoleBasedHome /> },
  { path: '/companies', element: <MainLayout><CompaniesPage /></MainLayout> },
  { path: '/blog', element: <MainLayout><BlogPage /></MainLayout> },
  { path: '/blog/:slug', element: <MainLayout><BlogDetailPage /></MainLayout> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/jobs/:id', element: <MainLayout><JobDetailPage /></MainLayout> },
  { path: '/profile', element: <MainLayout><ProtectedRoute><ProfilePage /></ProtectedRoute></MainLayout> },
  { path: '/change-password', element: <MainLayout><ProtectedRoute><ChangePasswordPage /></ProtectedRoute></MainLayout> },
  { path: '/employer/change-password', element: <MainLayout><EmployerRoute><ChangePasswordPage /></EmployerRoute></MainLayout> },
  { path: '/admin/change-password', element: <MainLayout><AdminRoute><ChangePasswordPage /></AdminRoute></MainLayout> },
  { path: '/saved-jobs', element: <MainLayout><ProtectedRoute><SavedJobsPage /></ProtectedRoute></MainLayout> },
  { path: '/applied-jobs', element: <MainLayout><ProtectedRoute><AppliedJobsPage /></ProtectedRoute></MainLayout> },
  { path: '/seeker', element: <Navigate to="/seeker/home" replace /> },
  { path: '/seeker/home', element: <MainLayout><SeekerRoute><HomePage /></SeekerRoute></MainLayout> },
  { path: '/seeker/companies', element: <MainLayout><SeekerRoute><CompaniesPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/blog', element: <MainLayout><SeekerRoute><BlogPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/blog/:slug', element: <MainLayout><SeekerRoute><BlogDetailPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/jobs/:id', element: <MainLayout><SeekerRoute><JobDetailPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/profile', element: <MainLayout><SeekerRoute><ProfilePage /></SeekerRoute></MainLayout> },
  { path: '/seeker/change-password', element: <MainLayout><SeekerRoute><ChangePasswordPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/saved-jobs', element: <MainLayout><SeekerRoute><SavedJobsPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/applied-jobs', element: <MainLayout><SeekerRoute><AppliedJobsPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/cv-builder', element: <MainLayout><SeekerRoute><CVBuilderPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/my-cvs', element: <MainLayout><SeekerRoute><ManageCVsPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/cv-import', element: <MainLayout><SeekerRoute><CVImportImagePage /></SeekerRoute></MainLayout> },

  // Backwards-compatible redirects
  { path: '/cv-builder', element: <Navigate to="/seeker/cv-builder" replace /> },
  { path: '/my-cvs', element: <Navigate to="/seeker/my-cvs" replace /> },
  { path: '/cv-import', element: <Navigate to="/seeker/cv-import" replace /> },
  // Employer routes
  { path: '/employer/dashboard', element: <EmployerRoute><EmployerDashboard /></EmployerRoute> },
  { path: '/employer/post-job', element: <EmployerRoute><PostJob /></EmployerRoute> },
  { path: '/admin', element: <Navigate to="/admin/dashboard" replace /> },
  { path: '/admin/dashboard', element: <AdminRoute><AdminDashboard /></AdminRoute> },
]);

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <RouterProvider router={router} />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
