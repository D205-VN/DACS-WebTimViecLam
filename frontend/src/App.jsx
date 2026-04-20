import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import CompaniesPage from './pages/CompaniesPage';
import BlogPage from './pages/BlogPage';
import BlogDetailPage from './pages/BlogDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import JobDetailPage from './pages/JobDetailPage';
import SavedJobsPage from './pages/SavedJobsPage';
import AppliedJobsPage from './pages/AppliedJobsPage';
import CVBuilderPage from './pages/seeker/CVBuilderPage';
import ManageCVsPage from './pages/seeker/ManageCVsPage';
import CVImportImagePage from './pages/seeker/CVImportImagePage';
import EmployerDashboard from './pages/employer/EmployerDashboard';
import PostJob from './pages/employer/PostJob';

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
  if (user?.role_code !== 'employer') return <Navigate to="/" replace />;
  return children;
}

const router = createBrowserRouter([
  { path: '/', element: <MainLayout><HomePage /></MainLayout> },
  { path: '/companies', element: <MainLayout><CompaniesPage /></MainLayout> },
  { path: '/blog', element: <MainLayout><BlogPage /></MainLayout> },
  { path: '/blog/:slug', element: <MainLayout><BlogDetailPage /></MainLayout> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/jobs/:id', element: <MainLayout><JobDetailPage /></MainLayout> },
  { path: '/change-password', element: <MainLayout><ProtectedRoute><ChangePasswordPage /></ProtectedRoute></MainLayout> },
  { path: '/saved-jobs', element: <MainLayout><ProtectedRoute><SavedJobsPage /></ProtectedRoute></MainLayout> },
  { path: '/applied-jobs', element: <MainLayout><ProtectedRoute><AppliedJobsPage /></ProtectedRoute></MainLayout> },
  // Seeker routes (namespaced similar to /employer/*)
  { path: '/seeker/cv-builder', element: <MainLayout><ProtectedRoute><CVBuilderPage /></ProtectedRoute></MainLayout> },
  { path: '/seeker/my-cvs', element: <MainLayout><ProtectedRoute><ManageCVsPage /></ProtectedRoute></MainLayout> },
  { path: '/seeker/cv-import', element: <MainLayout><ProtectedRoute><CVImportImagePage /></ProtectedRoute></MainLayout> },

  // Backwards-compatible redirects
  { path: '/cv-builder', element: <Navigate to="/seeker/cv-builder" replace /> },
  { path: '/my-cvs', element: <Navigate to="/seeker/my-cvs" replace /> },
  { path: '/cv-import', element: <Navigate to="/seeker/cv-import" replace /> },
  // Employer routes
  { path: '/employer/dashboard', element: <EmployerRoute><EmployerDashboard /></EmployerRoute> },
  { path: '/employer/post-job', element: <EmployerRoute><PostJob /></EmployerRoute> },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
