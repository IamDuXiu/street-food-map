import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { commitCsv, previewCsv } from '@/lib/server/services';

export async function POST(request: NextRequest) { const db = openDatabase(); try { requireAdmin(request, db, true); const body = await request.json(); if (!Array.isArray(body.rows)) throw new Error('ROWS_REQUIRED'); const checked = previewCsv(db, body.rows); if (!checked.valid) return NextResponse.json({ error: { code: 'IMPORT_INVALID', message: '请先修正全部错误', errors: checked.errors } }, { status: 422 }); return NextResponse.json({ data: { created: commitCsv(db, checked.rows, 'admin') } }); } catch (error) { const status = error instanceof AuthError ? error.status : 400; return NextResponse.json({ error: { code: error instanceof AuthError ? error.code : 'IMPORT_FAILED', message: '导入未写入，数据已回滚' } }, { status }); } }
