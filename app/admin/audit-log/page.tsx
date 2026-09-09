import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { openDatabase } from '@/lib/server/db';
import { listAuditEntries } from '@/lib/server/repository';
import { requireAdminPage } from '@/lib/server/page-auth';

export default async function AuditLogPage() { await requireAdminPage(); const entries = listAuditEntries(openDatabase()); return <AdminShell active="/admin/audit-log"><AdminTitle eyebrow="07 / AUDIT LOG" title="每一步都有记录"><span className="date-stamp">只读 · 数据库审计</span></AdminTitle><div className="audit-list">{entries.map((entry) => <div className="audit-row" key={entry.id}><time>{entry.created_at.slice(0, 16).replace('T', ' ')}</time><span className={`audit-icon audit-${entry.object_type === 'price_report' ? 'price' : entry.object_type === 'place' ? 'place' : 'submission'}`}>{entry.object_type === 'price_report' ? '¥' : entry.object_type === 'place' ? '＋' : '↗'}</span><div><strong>{entry.action}</strong><p>{entry.object_type} · {entry.object_id}</p></div><small>{entry.actor}</small></div>)}</div></AdminShell>; }
