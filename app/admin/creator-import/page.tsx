import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { CreatorImportWorkbench } from '@/components/creator-import-workbench';
import { requireAdminPage } from '@/lib/server/page-auth';

export default async function CreatorImportPage() {
  await requireAdminPage();
  return (
    <AdminShell active="/admin/creator-import">
      <AdminTitle eyebrow="06 / CREATOR" title="导入创作者内容" />
      <CreatorImportWorkbench />
    </AdminShell>
  );
}
