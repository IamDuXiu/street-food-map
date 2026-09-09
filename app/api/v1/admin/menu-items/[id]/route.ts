import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { updateMenuItem } from '@/lib/server/repository';
import { menuPatchSchema } from '@/lib/server/validation';
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const db = openDatabase(); try { requireAdmin(request, db, true); const { id } = await params; updateMenuItem(db, id, menuPatchSchema.parse(await request.json())); return NextResponse.json({ ok: true }); } catch (error) { const status = error instanceof AuthError ? error.status : 400; return NextResponse.json({ error: { code: error instanceof AuthError ? error.code : 'VALIDATION_ERROR', message: '餐食无法更新' } }, { status }); } }
