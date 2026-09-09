'use client';
import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/site-header';

const loginErrorMessage = '账号或密码不正确';

export default function AdminLoginPage() {
  const router = useRouter();
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    let removedSensitiveParams = false;

    // A previous no-JS submission may have left credentials in the address bar.
    // Remove them as soon as this client page is available without reloading.
    for (const key of ['username', 'password']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        removedSensitiveParams = true;
      }
    }
    if (url.searchParams.has('error')) {
      url.searchParams.delete('error');
      removedSensitiveParams = true;
    }
    if (removedSensitiveParams) {
      window.history.replaceState(
        null,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/v1/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: form.get('username'),
          password: form.get('password'),
        }),
      });

      if (response.ok) {
        setNotice('登录成功，正在打开工作台……');
        router.push('/admin');
        return;
      }

      const body = await response.json().catch(() => ({}));
      setNotice(body.error?.message || loginErrorMessage);
    } catch {
      setNotice('登录请求失败，请检查本地服务是否仍在运行');
    }
  }

  return (
    <>
      <AdminHeader />
      <main className="login-shell">
        <div className="login-card">
          <p className="kicker">管理员入口 / DEMO 01</p>
          <h1>
            欢迎回到
            <br />
            <em>饭签后台。</em>
          </h1>
          <p className="login-copy">
            这里管理核验、投稿和每一份公开价格。阶段1将校验真实本地会话；演示数据不会上传到外部服务。
          </p>
          <form
            method="post"
            action="/api/v1/admin/session"
            onSubmit={onSubmit}
          >
            <label>
              管理员账号
              <input
                required
                name="username"
                placeholder="admin"
                defaultValue="admin"
                autoComplete="username"
              />
            </label>
            <label>
              密码
              <input
                required
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            <button className="primary-button" type="submit">
              进入演示工作台 <span>↗</span>
            </button>
          </form>
          {notice && (
            <p className="form-notice" role="status">
              {notice}
            </p>
          )}
        </div>
        <div className="login-aside">
          <span className="big-mark">饭</span>
          <p>
            先把每一条价格
            <br />
            问清楚，再把地图
            <br />
            交给大家。
          </p>
        </div>
      </main>
    </>
  );
}
