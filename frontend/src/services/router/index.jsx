import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import { useAuth } from '@components/providers/AuthContext';
import MainLayout from '@components/layouts/MainLayout';
import { AdminRoute, EmployerRoute, ProtectedRoute, SeekerRoute } from '@services/router/guards';
import { getEmployerDashboardPath, getEmployerDashboardState } from '@services/employer/dashboardRoutes';

const EmployerPageLayout = lazy(() => import('@components/employer/EmployerPageLayout'));
const HomePage = lazy(() => import('@pages/HomePage'));
const CompaniesPage = lazy(() => import('@pages/CompaniesPage'));
const BlogPage = lazy(() => import('@pages/BlogPage'));
const BlogDetailPage = lazy(() => import('@pages/BlogDetailPage'));
const LoginPage = lazy(() => import('@pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@pages/auth/RegisterPage'));
const ChangePasswordPage = lazy(() => import('@pages/auth/ChangePasswordPage'));
const ForgotPasswordPage = lazy(() => import('@pages/auth/ForgotPasswordPage'));
const ProfilePage = lazy(() => import('@pages/ProfilePage'));
const MessagesPage = lazy(() => import('@pages/MessagesPage'));
const JobDetailPage = lazy(() => import('@pages/JobDetailPage'));
const SavedJobsPage = lazy(() => import('@pages/seeker/SavedJobsPage'));
const AppliedJobsPage = lazy(() => import('@pages/seeker/AppliedJobsPage'));
const AdminDashboard = lazy(() => import('@pages/admin/AdminDashboard'));
const CVBuilderPage = lazy(() => import('@pages/seeker/CVBuilderPage'));
const ManageCVsPage = lazy(() => import('@pages/seeker/ManageCVsPage'));
const CVImportImagePage = lazy(() => import('@pages/seeker/CVImportImagePage'));
const BlockchainVerificationPage = lazy(() => import('@pages/seeker/BlockchainVerificationPage'));
const SkillPassportPage = lazy(() => import('@pages/seeker/SkillPassportPage'));
const InterviewCopilotPage = lazy(() => import('@pages/seeker/InterviewCopilotPage'));
const WorkSimulationPage = lazy(() => import('@pages/seeker/WorkSimulationPage'));
const JobAlertsPage = lazy(() => import('@pages/seeker/JobAlertsPage'));
const OnboardingPage = lazy(() => import('@pages/seeker/OnboardingPage'));
const MyScoresPage = lazy(() => import('@pages/seeker/MyScoresPage'));
const EmployerDashboard = lazy(() => import('@pages/employer/EmployerDashboard'));
const PostJob = lazy(() => import('@pages/employer/PostJob'));
const AITestEditPage = lazy(() => import('@pages/employer/AITestEditPage'));
const ScoreManagementPage = lazy(() => import('@pages/employer/ScoreManagementPage'));
const CandidateTestUI = lazy(() => import('@pages/seeker/CandidateTestUI'));
const VerificationPublicPage = lazy(() => import('@pages/VerificationPublicPage'));
const PublicSkillPassportPage = lazy(() => import('@pages/PublicSkillPassportPage'));
const CompanyBrandingPage = lazy(() => import('@pages/CompanyBrandingPage'));
const InterviewRoomPage = lazy(() => import('@pages/InterviewRoomPage'));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-500"></div>
    </div>
  );
}

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
  { path: '/passport/:token', element: <MainLayout><PublicSkillPassportPage /></MainLayout> },
  { path: '/interview-room/:token', element: <InterviewRoomPage /> },
  { path: '/profile', element: <MainLayout><ProtectedRoute><ProfilePage /></ProtectedRoute></MainLayout> },
  { path: '/change-password', element: <MainLayout><ProtectedRoute><ChangePasswordPage /></ProtectedRoute></MainLayout> },
  { path: '/employer/change-password', element: <MainLayout><EmployerRoute><ChangePasswordPage /></EmployerRoute></MainLayout> },
  { path: '/admin/change-password', element: <MainLayout><AdminRoute><ChangePasswordPage /></AdminRoute></MainLayout> },
  { path: '/saved-jobs', element: <MainLayout><ProtectedRoute><SavedJobsPage /></ProtectedRoute></MainLayout> },
  { path: '/applied-jobs', element: <MainLayout><ProtectedRoute><AppliedJobsPage /></ProtectedRoute></MainLayout> },
  { path: '/messages', element: <MainLayout><ProtectedRoute><MessagesPage /></ProtectedRoute></MainLayout> },
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
  { path: '/seeker/messages', element: <MainLayout><SeekerRoute><MessagesPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/job-alerts', element: <MainLayout><SeekerRoute><JobAlertsPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/cv-builder', element: <MainLayout><SeekerRoute><CVBuilderPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/my-cvs', element: <MainLayout><SeekerRoute><ManageCVsPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/cv-import', element: <MainLayout><SeekerRoute><CVImportImagePage /></SeekerRoute></MainLayout> },
  { path: '/seeker/blockchain-verification', element: <MainLayout><SeekerRoute><BlockchainVerificationPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/skill-passport', element: <MainLayout><SeekerRoute><SkillPassportPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/interview-copilot/:jobId', element: <MainLayout><SeekerRoute><InterviewCopilotPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/work-simulation/:jobId', element: <MainLayout><SeekerRoute><WorkSimulationPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/onboarding/:id', element: <MainLayout><SeekerRoute><OnboardingPage /></SeekerRoute></MainLayout> },
  { path: '/seeker/my-scores', element: <MainLayout><SeekerRoute><MyScoresPage /></SeekerRoute></MainLayout> },
  { path: '/cv-builder', element: <Navigate to="/seeker/cv-builder" replace /> },
  { path: '/my-cvs', element: <Navigate to="/seeker/my-cvs" replace /> },
  { path: '/cv-import', element: <Navigate to="/seeker/cv-import" replace /> },
  { path: '/blockchain-verification', element: <Navigate to="/seeker/blockchain-verification" replace /> },
  { path: '/skill-passport', element: <Navigate to="/seeker/skill-passport" replace /> },
  { path: '/employer/dashboard', element: <EmployerRoute><EmployerDashboard /></EmployerRoute> },
  { path: '/employer/messages', element: <EmployerRoute><EmployerPageLayout activeKey="messages"><MessagesPage /></EmployerPageLayout></EmployerRoute> },
  { path: '/employer/meeting-rooms', element: <EmployerRoute><EmployerDashboardTabRedirect tab="meeting-rooms" /></EmployerRoute> },
  { path: '/employer/post-job', element: <EmployerRoute><PostJob /></EmployerRoute> },
  { path: '/employer/ai-tests', element: <EmployerRoute><EmployerDashboardTabRedirect tab="ai-tests" /></EmployerRoute> },
  { path: '/employer/ai-tests/:id/edit', element: <EmployerRoute><EmployerPageLayout activeKey="ai-tests"><AITestEditPage /></EmployerPageLayout></EmployerRoute> },
  { path: '/employer/ai-tests/:id/scores', element: <EmployerRoute><EmployerPageLayout activeKey="ai-tests"><ScoreManagementPage /></EmployerPageLayout></EmployerRoute> },
  { path: '/seeker/ai-tests/:testKind/:id', element: <ProtectedRoute><CandidateTestUI /></ProtectedRoute> },
  { path: '/seeker/ai-tests/:id', element: <ProtectedRoute><CandidateTestUI /></ProtectedRoute> },
  { path: '/candidate-test/:id', element: <ProtectedRoute><CandidateTestUI /></ProtectedRoute> },
  { path: '/test/:id', element: <ProtectedRoute><CandidateTestUI /></ProtectedRoute> },
  { path: '/admin', element: <Navigate to="/admin/dashboard" replace /> },
  { path: '/admin/dashboard', element: <AdminRoute><AdminDashboard /></AdminRoute> },
]);

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
