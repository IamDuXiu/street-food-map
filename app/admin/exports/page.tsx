import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { ExportButton } from '@/components/admin-actions';
import { requireAdminPage } from '@/lib/server/page-auth';
export default async function ExportsPage() { await requireAdminPage(); return <AdminShell active="/admin/exports"><AdminTitle eyebrow="06 / EXPORTS" title="导出与备份"><ExportButton /></AdminTitle><div className="backup-card"><div className="backup-icon">ZIP</div><div><h2>完整数据备份</h2><p>地点、餐食、价格历史、投稿、审计记录与文件清单，生成前会做 SQLite 一致性快照。</p></div><span className="backup-state">可随时从命令行校验恢复</span></div><div className="restore-note"><span>↗</span><div><strong>恢复是保护性操作</strong><p>先只读校验 ZIP 和 SHA-256，再自动备份当前数据；最后必须输入 RESTORE-BUDGET-MAP 才会原子替换。</p></div></div></AdminShell>; }
