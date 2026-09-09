'use client';

import Link from 'next/link';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-status" role="alert">
      <p className="kicker">页面暂时走神了</p>
      <h1>这页没能打开。</h1>
      <p>本地数据可能正在维护。你可以重试，或回到地图继续浏览。</p>
      <div className="page-status-actions">
        <button className="primary-button" type="button" onClick={reset}>重新加载</button>
        <Link className="secondary-button" href="/">回到地图</Link>
      </div>
    </main>
  );
}
