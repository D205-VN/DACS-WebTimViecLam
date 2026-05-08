import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import { useAuth } from '@features/auth/AuthContext';
import MainLayout from '@app/layouts/MainLayout';
import { AdminRoute, EmployerRoute, ProtectedRoute, SeekerRoute } from '@app/router/guards';
import EmployerPageLayout from '@widgets/employer/EmployerPageLayout';
import HomePage from '@pages/HomePage';
import CompaniesPage from '@pages/CompaniesPage';
import BlogPage from '@pages/BlogPage';
import BlogDetailPage from '@pages/BlogDetailPage';
import LoginPage from '@pages/auth/LoginPage';
import RegisterPage from '@pages/auth/RegisterPage';
import ChangePasswordPage from '@pages/auth/ChangePasswordPage';
import ForgotPasswordPage from '@pages/auth/ForgotPasswordPage';
import ProfilePage from '@pages/ProfilePage';
import JobDetailPage from '@pages/JobDetailPage';
import SavedJobsPage from '@pages/seeker/SavedJobsPage';
import AppliedJobsPage from '@pages/seeker/AppliedJobsPage';
import AdminDashboard from '@pages/admin/AdminDashboard';
import CVBuilderPage from '@pages/seeker/CVBuilderPage';
import ManageCVsPage from '@pages/seeker/ManageCVsPage';
import CVImportImagePage from '@pages/seeker/CVImportImagePage';
import BlockchainVerificationPage from '@pages/seeker/BlockchainVerificationPage';
import JobAlertsPage from '@pages/seeker/JobAlertsPage';
import OnboardingPage from '@pages/seeker/OnboardingPage';
import EmployerDashboard from '@pages/employer/EmployerDashboard';
import PostJob from '@pages/employer/PostJob';
import AITestEditPage from '@pages/employer/AITestEditPage';
import ScoreManagementPage from '@pages/employer/ScoreManagementPage';
import CandidateTestUI from '@pages/seeker/CandidateTestUI';
import VerificationPublicPage from '@pages/VerificationPublicPage';
import CompanyBrandingPage from '@pages/CompanyBrandingPage';
import InterviewRoomPage from '@pages/InterviewRoomPage';
import { getEmployerDashboardPath, getEmployerDashboardState } from '@shared/utils/employerDashboardRoutes';

function RoleBasedHome() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (user?.role_code === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user?.role_code === 'employer') return <Navigate to="/employer/dashboard" replace />;
    if (user?.role_code === 'seeker') return <Navigate to="/seeker/home" replace />;
  }

  return (
    <MainLayout>
      <HomePage />
    </MainLayout>
  );
}

function EmployerDashboardTabRedirect({ tab }) {
  const location = useLocation();
  const params = Object.fromEntries(new URLSearchParams(location.search));

  return (
    <Navigate
      to={getEmployerDashboardPath(tab, params)}
      replace
      state={getEmployerDashboardState(tab)}
    />
  );
}

const router = createBrowserRouter([
  { path: '/', element: <RoleBasedHome /> },
  { path: '/companies', element: <MainLayout><CompaniesPage /></MainLayout> },
  { path: '/company', element: <MainLayout><CompanyBrandingPage /></MainLayout> },
  { path: '/blog', element: <MainLayout><BlogPage /></MainLayout> },
  { path: '/blog/:slug', element: <MainLayout><BlogDetailPage /></MainLayout> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/jobs/:id', element: <MainLayout><JobDetailPage /></MainLayout> },
  { path: '/verify/:code', element: <MainLayout><VerificationPublicPage /></MainLayout> },
  { path: '/interview-room/:token', element: <InterviewRoomPage /> },
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
  { path: '/seeker/job-alerts', element: <MainLayout><SeekerRoute><JobAlertsPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/cv-builder', element: <MainLayout><SeekerRoute><CVBuilderPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/my-cvs', element: <MainLayout><SeekerRoute><ManageCVsPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/cv-import', element: <MainLayout><SeekerRoute><CVImportImagePage /></SeekerRoute></MainLayout> },
  { path: '/seeker/blockchain-verification', element: <MainLayout><SeekerRoute><BlockchainVerificationPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/onboarding/:id', element: <MainLayout><SeekerRoute><OnboardingPage /></SeekerRoute></MainLayout> },
  { path: '/cv-builder', element: <Navigate to="/seeker/cv-builder" replace /> },
  { path: '/my-cvs', element: <Navigate to="/seeker/my-cvs" replace /> },
  { path: '/cv-import', element: <Navigate to="/seeker/cv-import" replace /> },
  { path: '/blockchain-verification', element: <Navigate to="/seeker/blockchain-verification" replace /> },
  { path: '/employer/dashboard', element: <EmployerRoute><EmployerDashboard /></EmployerRoute> },
  { path: '/employer/meeting-rooms', element: <EmployerRoute><EmployerDashboardTabRedirect tab="meeting-rooms" /></EmployerRoute> },
  { path: '/employer/post-job', element: <EmployerRoute><PostJob /></EmployerRoute> },
  { path: '/employer/ai-tests', element: <EmployerRoute><EmployerDashboardTabRedirect tab="ai-tests" /></EmployerRoute> },
  { path: '/employer/ai-tests/:id/edit', element: <EmployerRoute><EmployerPageLayout activeKey="ai-tests"><AITestEditPage /></EmployerPageLayout></EmployerRoute> },
  { path: '/employer/ai-tests/:id/scores', element: <EmployerRoute><EmployerPageLayout activeKey="ai-tests"><ScoreManagementPage /></EmployerPageLayout></EmployerRoute> },
  { path: '/seeker/ai-tests/:id', element: <ProtectedRoute><CandidateTestUI /></ProtectedRoute> },
  { path: '/candidate-test/:id', element: <ProtectedRoute><CandidateTestUI /></ProtectedRoute> },
  { path: '/test/:id', element: <ProtectedRoute><CandidateTestUI /></ProtectedRoute> },
  { path: '/admin', element: <Navigate to="/admin/dashboard" replace /> },
  { path: '/admin/dashboard', element: <AdminRoute><AdminDashboard /></AdminRoute> },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
