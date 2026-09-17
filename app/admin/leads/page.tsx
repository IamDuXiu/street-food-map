import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { CandidatePoolWorkspace } from '@/components/candidate-pool';
import { requireAdminPage } from '@/lib/server/page-auth';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ draft?: string | string[] }>;
}) {
  await requireAdminPage();
  const params = searchParams ? await searchParams : {};
  const draft = typeof params.draft === 'string' ? params.draft : undefined;
  return <AdminShell active="/admin/leads">
    <AdminTitle eyebrow="02 / LEADS" title="线索池" />
    <CandidatePoolWorkspace initialDraftId={draft} />
  </AdminShell>;
}
