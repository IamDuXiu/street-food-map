import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="饭签首页">
        <span className="wordmark-mark">饭</span>
        <span>街头饭签</span>
      </Link>
      <nav className="site-nav" aria-label="主要导航">
        <Link href="/about">规则</Link>
        <Link href="/submit" className="nav-submit">报一笔 <span aria-hidden="true">↗</span></Link>
      </nav>
    </header>
  );
}

export function AdminHeader() {
  return (
    <header className="admin-header">
      <Link className="wordmark" href="/admin" aria-label="饭签后台总览"><span className="wordmark-mark">饭</span><span>饭签后台</span></Link>
    </header>
  );
}
