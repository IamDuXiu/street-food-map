import { SiteHeader } from '@/components/site-header';

export default function SubmitLoading() {
  return <><SiteHeader /><main className="page-status public-shell public-page" aria-busy="true" aria-live="polite"><p className="kicker">匿名投稿</p><h1>正在准备投稿。</h1><p>请稍等。</p></main></>;
}
