import EmployerPageLayout from '@widgets/employer/EmployerPageLayout';
import AITestManagementContent from '@widgets/employer/AITestManagementContent';

export default function AITestManagementPage() {
  return (
    <EmployerPageLayout activeKey="ai-tests">
      <AITestManagementContent />
    </EmployerPageLayout>
  );
}
