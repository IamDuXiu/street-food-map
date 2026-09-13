import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { CandidateImportPreview } from '@/components/candidate-import-preview';
import { ImportWorkbench } from '@/components/import-workbench';
import { requireAdminPage } from '@/lib/server/page-auth';
export default async function ImportPage({
  searchParams,
}: {
  searchParams?: Promise<{ draft?: string | string[] }>;
}) {
  await requireAdminPage();
  const params = searchParams ? await searchParams : {};
  const draft = typeof params.draft === 'string' ? params.draft : undefined;
  return <AdminShell active="/admin/import">
    <AdminTitle eyebrow="05 / IMPORT" title="导入一批饭签" />
    {draft && <CandidateImportPreview draftId={draft} />}
    <div className="import-flow">
      <div className="flow-step active"><span>01</span><h2>上传 CSV</h2><ImportWorkbench /></div>
      <div className="flow-arrow">→</div>
      <div className="flow-step"><span>02</span><h2>逐行检查</h2></div>
      <div className="flow-arrow">→</div>
      <div className="flow-step"><span>03</span><h2>确认导入</h2><span className="status-text">全有或全无</span></div>
    </div>
  </AdminShell>;
}
