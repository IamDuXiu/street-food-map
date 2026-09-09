'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function SubmissionStatusPage() {
  const [code, setCode] = useState('');
  const [data, setData] = useState<{
    idSuffix: string;
    type: string;
    status: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const initialCode =
      new URLSearchParams(window.location.search).get('code') ?? '';
    queueMicrotask(() => setCode(initialCode));
  }, []);
  async function search(event: FormEvent) {
    event.preventDefault();
    setError('');
    setData(null);
    setBusy(true);
    try {
      const response = await fetch(
        `/api/v1/submissions/status?lookupCode=${encodeURIComponent(code.trim())}`,
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) setError(body.error?.message || '查询码不正确。');
      else setData(body.data);
    } catch {
      setError('暂时无法查询，请检查本地服务后重试。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="form-shell">
        <Link href="/" className="back-link">
          ← 回到地图
        </Link>
        <div className="form-heading">
          <p className="kicker">投稿状态查询</p>
          <h1>
            看看这条情报，
            <br />
            <em>走到哪一步了。</em>
          </h1>
          <p>
            只需要投稿成功时保存的查询码。我们不会通过查询码展示你的投稿内容。
          </p>
        </div>
        <form className="submission-form" onSubmit={search} aria-describedby="status-form-error">
          <label>
            查询码
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              autoComplete="off"
              aria-invalid={Boolean(error)}
            />
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? '查询中…' : '查询状态'}
          </button>
        </form>
        <p id="status-form-error" className="form-notice" role="alert" aria-live="assertive" hidden={!error}>
          {error || ' '}
        </p>
        {data && (
          <section className="review-detail status-result" aria-live="polite">
            <p className="kicker">编号尾号 · {data.idSuffix}</p>
            <h2>{data.message}</h2>
            <dl>
              <dt>类型</dt>
              <dd>{data.type}</dd>
              <dt>状态</dt>
              <dd>{data.status}</dd>
            </dl>
          </section>
        )}
      </main>
    </>
  );
}
