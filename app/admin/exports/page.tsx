import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { ExportButton } from '@/components/admin-actions';
import { requireAdminPage } from '@/lib/server/page-auth';
export default async function ExportsPage() { await requireAdminPage(); return <AdminShell active="/admin/exports"><AdminTitle eyebrow="08 / EXPORTS" title="导出与备份"><ExportButton /></AdminTitle><div className="backup-card"><div className="backup-icon">ZIP</div><div><h2>完整数据备份</h2><p>包含地点、餐食、价格、投稿与审计记录。</p></div><span className="backup-state">可校验后恢复</span></div><div className="restore-note"><span>↗</span><div><strong>恢复是保护性操作</strong><p>恢复前会校验备份文件并自动备份当前数据，确认后才会替换。</p></div></div></AdminShell>; }
