import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { priceSchema, priceStatusRequestSchema } from '@/lib/server/validation';
import { replacePrice, updatePriceStatus } from '@/lib/server/repository';
export async function POST(request: NextRequest) { const db = openDatabase(); try { requireAdmin(request, db, true); const input = priceSchema.parse(await request.json()); return NextResponse.json({ id: replacePrice(db, input) }, { status: 201 }); } catch (error) { const status = error instanceof AuthError ? error.status : 400; return NextResponse.json({ error: { code: error instanceof AuthError ? error.code : 'VALIDATION_ERROR', message: '价格无法保存' } }, { status }); } }
export async function PATCH(request: NextRequest) { const db = openDatabase(); try { requireAdmin(request, db, true); const input = priceStatusRequestSchema.parse(await request.json()); return NextResponse.json({ status: updatePriceStatus(db, input.id, input.status) }); } catch (error) { const status = error instanceof AuthError ? error.status : 400; return NextResponse.json({ error: { code: error instanceof AuthError ? error.code : 'VALIDATION_ERROR', message: '价格状态无法更新' } }, { status }); } }
