import { SiteHeader } from '@/components/site-header';

export default function StatusLoading() {
  return <><SiteHeader /><main className="page-status public-shell public-page" aria-busy="true" aria-live="polite"><p className="kicker">投稿状态查询</p><h1>正在准备查询。</h1><p>请稍等。</p></main></>;
}
