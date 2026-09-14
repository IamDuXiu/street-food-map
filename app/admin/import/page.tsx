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
    <ImportWorkbench />
  </AdminShell>;
}
