import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { RegionManager } from '@/components/region-manager';
import { requireAdminPage } from '@/lib/server/page-auth';

export default async function RegionsPage() {
  await requireAdminPage();
  return (
    <AdminShell active="/admin/regions">
      <AdminTitle eyebrow="07 / REGIONS" title="区域目录">
        <span className="demo-pill">
          <span className="status-dot" />
          城市 → 行政区 → 商圈
        </span>
      </AdminTitle>
      <p className="creator-import-intro">
        维护珠三角各市的商圈范围。覆盖状态由数据自动派生；城市与行政区不可停用，仅商圈可停用。
      </p>
      <RegionManager />
    </AdminShell>
  );
}
