import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { CreatorImportWorkbench } from '@/components/creator-import-workbench';
import { requireAdminPage } from '@/lib/server/page-auth';

export default async function CreatorImportPage() {
  await requireAdminPage();
  return (
    <AdminShell active="/admin/creator-import">
      <AdminTitle eyebrow="06 / CREATOR" title="导入创作者内容">
        <span className="demo-pill">
          <span className="status-dot" />
          来源：B站 / YouTube
        </span>
      </AdminTitle>
      <p className="creator-import-intro">
        把创作者的探店视频整理成「门店 / 菜品 / 价格」；缺坐标时先解析地址再人工核对。
        导入后自动聚合来源标签并标「未核验」，不计入已核验。
      </p>
      <CreatorImportWorkbench />
    </AdminShell>
  );
}
