import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { RegionManager } from '@/components/region-manager';
import { requireAdminPage } from '@/lib/server/page-auth';

export default async function RegionsPage() {
  await requireAdminPage();
  return (
    <AdminShell active="/admin/regions">
      <AdminTitle eyebrow="07 / REGIONS" title="区域目录" />
      <RegionManager />
    </AdminShell>
  );
}
