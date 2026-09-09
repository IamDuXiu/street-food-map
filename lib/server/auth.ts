import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import type { SqliteDatabase } from './db';

const COOKIE = 'budget_admin_session';
const CSRF_COOKIE = 'budget_csrf';
const SESSION_HOURS = 8;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new AuthError('SESSION_SECRET_MISSING', 500);
  return value;
}
export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
}
export function verifyPassword(password: string, encoded: string) {
  const [, n, r, p, saltText, digestText] = encoded.split('$');
  if (!n || !r || !p || !saltText || !digestText) return false;
  try {
    const actual = scryptSync(
      password,
      Buffer.from(saltText, 'base64url'),
      32,
      { N: Number(n), r: Number(r), p: Number(p) },
    );
    const expected = Buffer.from(digestText, 'base64url');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
/** Rotating, irreversible source fingerprint. The raw source is never persisted. */
export function sourceHash(request: Request) {
  const forwarded =
    process.env.TRUST_PROXY === '1'
      ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      : '';
  const source = forwarded || request.headers.get('user-agent') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  return createHmac('sha256', secret())
    .update(`${day}:${source}`)
    .digest('hex');
}
export function issueSession(passwordVersion: number) {
  const payload = `${Date.now() + SESSION_HOURS * 3600000}.${passwordVersion}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}
function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}
export function verifySession(
  value: string | undefined,
  currentVersion: number,
) {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length < 4) return false;
  const signature = parts.pop();
  const payload = parts.join('.');
  const expected = sign(payload);
  if (!signature) return false;
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  )
    return false;
  const [expires, version] = parts;
  return Number(expires) > Date.now() && Number(version) === currentVersion;
}
export function csrfToken() {
  return randomBytes(24).toString('base64url');
}
export function setSession(
  response: NextResponse,
  token: string,
  csrf: string,
) {
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_HOURS * 3600,
    path: '/',
  });
  response.cookies.set(CSRF_COOKIE, csrf, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_HOURS * 3600,
    path: '/',
  });
}
export function clearSession(response: NextResponse) {
  response.cookies.set(COOKIE, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  response.cookies.set(CSRF_COOKIE, '', { expires: new Date(0), path: '/' });
}
export async function currentSession(currentVersion: number) {
  const jar = await cookies();
  return verifySession(jar.get(COOKIE)?.value, currentVersion);
}
export function requireAdmin(
  request: NextRequest,
  db: SqliteDatabase,
  write = false,
) {
  const setting = db
    .prepare('SELECT password_version FROM admin_settings WHERE id=1')
    .get() as { password_version: number } | undefined;
  const currentVersion =
    setting?.password_version ?? (process.env.DEMO_AUTH === '1' ? 1 : 0);
  if (
    !currentVersion ||
    !verifySession(request.cookies.get(COOKIE)?.value, currentVersion)
  )
    throw new AuthError('UNAUTHORIZED', 401);
  if (write) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (!origin || !host) throw new AuthError('ORIGIN_REQUIRED', 403);
    try {
      if (new URL(origin).host !== host)
        throw new AuthError('ORIGIN_FORBIDDEN', 403);
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('ORIGIN_FORBIDDEN', 403);
    }
    const csrf = request.headers.get('x-csrf-token');
    const cookieCsrf = request.cookies.get(CSRF_COOKIE)?.value;
    if (!csrf || !cookieCsrf || csrf !== cookieCsrf || csrf.length < 16)
      throw new AuthError('CSRF_FORBIDDEN', 403);
  }
  return true;
}
export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}
export { COOKIE, CSRF_COOKIE };
