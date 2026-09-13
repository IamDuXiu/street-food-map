import { SiteHeader } from '@/components/site-header';

export default function PlaceLoading() {
  return <><SiteHeader /><main className="page-status public-shell public-page" aria-busy="true" aria-live="polite"><p className="kicker">饭签详情</p><h1>正在打开饭点。</h1><p>正在读取最新核验信息。</p></main></>;
}
