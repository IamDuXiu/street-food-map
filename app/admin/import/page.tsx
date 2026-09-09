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
    <AdminTitle eyebrow="05 / IMPORT" title="导入一批饭签">
      <span className="demo-pill"><span className="status-dot" />两阶段校验</span>
    </AdminTitle>
    {draft && <CandidateImportPreview draftId={draft} />}
    <div className="import-flow">
      <div className="flow-step active"><span>01</span><h2>上传 CSV</h2><p>原有 CSV 入口仍可用；固定 16 列，服务端先预览再写入。</p><ImportWorkbench /></div>
      <div className="flow-arrow">→</div>
      <div className="flow-step"><span>02</span><h2>逐行检查</h2><p>服务端校验必填、价格、日期、GCJ-02、重复地点和来源。</p><div className="fake-validation"><b>预览结果</b><span>选择文件后显示真实结果</span></div></div>
      <div className="flow-arrow">→</div>
      <div className="flow-step"><span>03</span><h2>确认导入</h2><p>只有全部检查通过，才会一次性写入并留下审计。</p><span className="status-text">全有或全无</span></div>
    </div>
  </AdminShell>;
}
