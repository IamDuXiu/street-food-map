'use client';

import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <><SiteHeader /><main className="page-status public-shell public-page" role="alert">
      <p className="kicker">页面暂时走神了</p>
      <h1>这页没能打开。</h1>
      <p>你可以重试，或回到地图继续浏览。</p>
      <div className="page-status-actions">
        <button className="primary-button" type="button" onClick={reset}>重新加载</button>
        <Link className="secondary-button" href="/">回到地图</Link>
      </div>
    </main></>
  );
}
