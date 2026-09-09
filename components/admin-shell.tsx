import Link from 'next/link';
import { AdminHeader } from './site-header';
import { AdminLogout } from './admin-actions';
import { requireAdminPage } from '@/lib/server/page-auth';

const links = [['/admin', '总览'], ['/admin/leads', '线索池'], ['/admin/submissions', '投稿审核'], ['/admin/places', '地点与餐食'], ['/admin/import', '导入'], ['/admin/exports', '导出备份'], ['/admin/audit-log', '审计记录']];

export async function AdminShell({ children, active = '/admin' }: { children: React.ReactNode; active?: string }) {
  await requireAdminPage();
  return <><AdminHeader /><div className="admin-layout"><aside className="admin-sidebar"><div className="admin-nav-label">工作台 / 深圳试点</div><nav aria-label="后台导航">{links.map(([href, label]) => <Link className={active === href ? 'active' : ''} key={href} href={href}><span className="nav-index">{String(links.findIndex((item) => item[0] === href) + 1).padStart(2, '0')}</span>{label}</Link>)}</nav><div className="admin-sidebar-bottom"><span>LOCAL DATASET</span><p>本地数据环境 · 所有写入均可审计</p><Link href="/">← 回到用户端</Link><AdminLogout /></div></aside><main className="admin-content">{children}</main></div></>;
}

export function AdminTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) { return <div className="admin-title"><div><p className="kicker">{eyebrow}</p><h1>{title}</h1></div>{children}</div>; }
