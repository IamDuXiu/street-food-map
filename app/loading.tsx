import { SiteHeader } from '@/components/site-header';

export default function Loading() {
  return <><SiteHeader /><main className="page-status public-shell public-page" aria-busy="true" aria-live="polite"><p className="kicker">正在打开</p><h1>正在读取饭签。</h1><p>请稍等，正在读取当前可公开的信息。</p></main></>;
}
