import { AdminHeader } from '@/components/site-header';

export default function AdminLoading() {
  return <><AdminHeader /><main className="page-status admin-status" aria-busy="true" aria-live="polite"><p className="kicker">后台工作台</p><h1>正在打开工作台。</h1><p>正在读取数据，请稍等。</p></main></>;
}
