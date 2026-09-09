import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { openDatabase } from './db';
import { COOKIE, verifySession } from './auth';

export async function requireAdminPage() {
  const db = openDatabase();
  const setting = db.prepare('SELECT password_version FROM admin_settings WHERE id=1').get() as { password_version: number } | undefined;
  const jar = await cookies();
  let valid = false;
  try { valid = Boolean(verifySession(jar.get(COOKIE)?.value, setting?.password_version ?? (process.env.DEMO_AUTH === '1' ? 1 : 0))); } catch { valid = false; }
  if (!valid) redirect('/admin/login');
}
