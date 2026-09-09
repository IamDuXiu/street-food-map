import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { clearSession, csrfToken, issueSession, requireAdmin, setSession, sourceHash, verifyPassword, AuthError } from '@/lib/server/auth';

const adminUsername = () => process.env.ADMIN_USERNAME || 'admin';

function isHtmlFormRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  const accept = request.headers.get('accept') || '';
  return !contentType.toLowerCase().includes('application/json') && accept.includes('text/html');
}

async function readLoginBody(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('application/json'))
    return request.json().catch(() => ({}));
  const form = await request.formData().catch(() => null);
  return form
    ? { username: form.get('username'), password: form.get('password') }
    : {};
}

function relativeRedirect(location: string) {
  const response = new NextResponse(null, { status: 303 });
  response.headers.set('Location', location);
  return response;
}

function redirectToLogin(error: string) {
  const params = new URLSearchParams({ error });
  return relativeRedirect(`/admin/login?${params.toString()}`);
}

function responseForFailure(
  request: NextRequest,
  code: string,
  message: string,
  status: number,
) {
  if (isHtmlFormRequest(request)) return redirectToLogin(code.toLowerCase());
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const db = openDatabase(); const body = await readLoginBody(request);
    const username = typeof body.username === 'string' ? body.username : ''; const password = typeof body.password === 'string' ? body.password : '';
    const source = sourceHash(request); const now = new Date();
    const attempt = db.prepare('SELECT * FROM login_attempts WHERE source_hash=?').get(source) as { failed_count: number; first_failed_at: string | null; locked_until: string | null } | undefined;
    if (attempt?.locked_until && new Date(attempt.locked_until) > now) return responseForFailure(request, 'LOGIN_LOCKED', '登录失败次数过多，请 15 分钟后重试', 429);
    const setting = db.prepare('SELECT password_hash,password_version FROM admin_settings WHERE id=1').get() as { password_hash: string; password_version: number } | undefined;
    const demoPassword = process.env.DEMO_AUTH === '1' ? process.env.DEMO_ADMIN_PASSWORD : undefined;
    const validPassword = Boolean(setting?.password_hash && verifyPassword(password, setting.password_hash)) || Boolean(demoPassword && password === demoPassword);
    if (username !== adminUsername() || !validPassword) {
      const withinWindow = Boolean(attempt?.first_failed_at && new Date(attempt.first_failed_at).getTime() > now.getTime() - 900000);
      const first = withinWindow ? attempt!.first_failed_at! : now.toISOString();
      const count = withinWindow ? attempt!.failed_count + 1 : 1;
      const locked = count >= 5 ? new Date(now.getTime() + 900000).toISOString() : null;
      db.prepare('INSERT INTO login_attempts(source_hash,failed_count,first_failed_at,locked_until) VALUES (?,?,?,?) ON CONFLICT(source_hash) DO UPDATE SET failed_count=excluded.failed_count,first_failed_at=excluded.first_failed_at,locked_until=excluded.locked_until').run(source, count, first, locked);
      return responseForFailure(request, 'INVALID_CREDENTIALS', '账号或密码不正确', 401);
    }
    db.prepare('DELETE FROM login_attempts WHERE source_hash=?').run(source);
    const response = isHtmlFormRequest(request)
      ? relativeRedirect('/admin')
      : NextResponse.json({ ok: true });
    setSession(response, issueSession(setting?.password_version || 1), csrfToken()); return response;
  } catch (error) { return authResponse(error, request); }
}

export async function GET(request: NextRequest) { const db = openDatabase(); try { requireAdmin(request, db); return NextResponse.json({ ok: true }); } catch (error) { return authResponse(error); } }
export async function DELETE(request: NextRequest) { const db = openDatabase(); const response = NextResponse.json({ ok: true }); try { requireAdmin(request, db, true); clearSession(response); return response; } catch (error) { return authResponse(error); } }
function authResponse(error: unknown, request?: NextRequest) { if (request && isHtmlFormRequest(request)) return redirectToLogin(error instanceof AuthError ? error.code.toLowerCase() : 'request_failed'); if (error instanceof AuthError) return NextResponse.json({ error: { code: error.code, message: error.code === 'SESSION_SECRET_MISSING' ? '服务端会话密钥未配置' : '未授权或请求校验失败' } }, { status: error.status }); return NextResponse.json({ error: { code: 'AUTH_ERROR', message: '请求失败' } }, { status: 500 }); }
