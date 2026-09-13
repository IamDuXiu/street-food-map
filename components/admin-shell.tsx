import Link from 'next/link';
import { AdminHeader } from './site-header';
import { AdminLogout } from './admin-actions';
import { requireAdminPage } from '@/lib/server/page-auth';
import { openDatabase } from '@/lib/server/db';
import { dashboardSummary } from '@/lib/server/repository';

const links: Array<[string, string]> = [['/admin', '总览'], ['/admin/leads', '线索池'], ['/admin/submissions', '投稿审核'], ['/admin/places', '地点与餐食'], ['/admin/import', '导入'], ['/admin/creator-import', '创作者导入'], ['/admin/regions', '区域目录'], ['/admin/exports', '导出备份'], ['/admin/audit-log', '审计记录']];

const badgeKeys: Record<string, 'activeLeads' | 'pendingSubmissions'> = {
  '/admin/leads': 'activeLeads',
  '/admin/submissions': 'pendingSubmissions',
};

export async function AdminShell({ children, active = '/admin' }: { children: React.ReactNode; active?: string }) {
  await requireAdminPage();
  const summary = dashboardSummary(openDatabase());
  return <><AdminHeader /><a className="skip-to-content" href="#admin-main">跳到主内容</a><div className="admin-layout"><aside className="admin-sidebar"><div className="admin-nav-label">工作台 / 深圳试点</div><nav aria-label="后台导航">{links.map(([href, label], index) => { const isActive = active === href; const badgeKey = badgeKeys[href]; const badge = badgeKey ? summary[badgeKey] : 0; return <Link className={isActive ? 'active' : ''} aria-current={isActive ? 'page' : undefined} key={href} href={href}><span className="nav-index">{String(index + 1).padStart(2, '0')}</span>{label}{badge > 0 ? <b>{badge}</b> : null}</Link>; })}</nav><div className="admin-sidebar-bottom"><span>LOCAL DATASET</span><p>本地数据环境 · 所有写入均可审计</p><Link href="/">← 回到用户端</Link><AdminLogout /></div><div className="admin-mobile-actions" aria-label="后台账户操作"><Link href="/">回到用户端</Link><AdminLogout /></div></aside><main className="admin-content" id="admin-main" tabIndex={-1}>{children}</main></div></>;
}

export function AdminTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) { return <div className="admin-title"><div><p className="kicker">{eyebrow}</p><h1>{title}</h1></div>{children}</div>; }
