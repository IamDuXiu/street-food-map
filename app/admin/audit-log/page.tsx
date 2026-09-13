import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { openDatabase } from '@/lib/server/db';
import { listAuditEntries } from '@/lib/server/repository';
import { requireAdminPage } from '@/lib/server/page-auth';

const objectTypeLabels: Record<string, string> = {
  price_report: '价格核验',
  place: '地点',
  submission: '投稿',
  lead: '线索',
  menu_item: '餐食',
  candidate_draft: '候选草稿',
  source_lead_item: '候选餐食',
};
const actionLabels: Record<string, string> = {
  create: '新增',
  update: '更新',
  approve: '通过',
  reject: '拒绝',
  archive: '归档',
  merge: '合并',
  replace: '替换价格',
  candidate_seed: '导入线索',
  status_change: '更新状态',
  candidate_converted: '导入候选',
  needs_verification: '转待核验',
  duplicate: '标记重复',
};

export default async function AuditLogPage() { await requireAdminPage(); const entries = listAuditEntries(openDatabase()); return <AdminShell active="/admin/audit-log"><AdminTitle eyebrow="07 / AUDIT LOG" title="每一步都有记录"><span className="date-stamp">只读 · 数据库审计</span></AdminTitle><div className="audit-list">{entries.map((entry) => <div className="audit-row" key={entry.id}><time>{entry.created_at.slice(0, 16).replace('T', ' ')}</time><span className={`audit-icon audit-${entry.object_type === 'price_report' ? 'price' : entry.object_type === 'place' ? 'place' : 'submission'}`}>{entry.object_type === 'price_report' ? '¥' : entry.object_type === 'place' ? '＋' : '↗'}</span><div><strong>{actionLabels[entry.action] ?? entry.action}</strong><p>{objectTypeLabels[entry.object_type] ?? entry.object_type} · {entry.object_id}</p></div><small>{entry.actor}</small></div>)}</div></AdminShell>; }
