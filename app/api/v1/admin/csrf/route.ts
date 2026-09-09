import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { csrfToken, requireAdmin, AuthError } from '@/lib/server/auth';
export async function GET(request: NextRequest) { try { requireAdmin(request, openDatabase()); const token = csrfToken(); const response = NextResponse.json({ csrfToken: token }); response.cookies.set('budget_csrf', token, { httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 28800, path: '/' }); return response; } catch (error) { const status = error instanceof AuthError ? error.status : 500; return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '请先登录' } }, { status }); } }
