import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { createBackup } from '@/scripts/backup';
export async function GET(request: NextRequest) { try { requireAdmin(request, openDatabase()); const file = await createBackup(); return NextResponse.json({ data: { path: file, message: '备份已生成' } }); } catch (error) { const status = error instanceof AuthError ? error.status : 500; return NextResponse.json({ error: { code: 'EXPORT_FAILED', message: '备份失败' } }, { status }); } }
