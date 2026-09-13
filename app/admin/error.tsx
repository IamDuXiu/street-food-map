'use client';

import Link from 'next/link';
import { AdminHeader } from '@/components/site-header';

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <><AdminHeader /><main className="page-status admin-status" role="alert"><p className="kicker">后台暂时不可用</p><h1>工作台没能打开。</h1><p>请先检查本地服务是否仍在运行，再重试。页面操作的结果会以实际状态为准。</p><div className="page-status-actions"><button className="primary-button" type="button" onClick={reset}>重新加载</button><Link className="secondary-button" href="/admin/login">回到登录</Link></div></main></>;
}
