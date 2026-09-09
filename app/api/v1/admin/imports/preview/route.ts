import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { previewCsv } from '@/lib/server/services';
import { BUDGET_IMPORT_HEADERS, parseCsvRFC4180 } from '@/lib/csv';

export async function POST(request: NextRequest) { try { requireAdmin(request, openDatabase()); const body = await request.json(); const rows = Array.isArray(body.rows) ? body.rows : parseCsvRFC4180(String(body.csv ?? ''), BUDGET_IMPORT_HEADERS); const result = previewCsv(openDatabase(), rows); return NextResponse.json({ data: result }); } catch (error) { const status = error instanceof AuthError ? error.status : 400; return NextResponse.json({ error: { code: error instanceof AuthError ? error.code : 'VALIDATION_ERROR', message: 'CSV 预览失败' } }, { status }); } }
