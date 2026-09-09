import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { addMenuItem } from '@/lib/server/repository';
import { mealSchema } from '@/lib/server/validation';

export async function POST(request: NextRequest) {
  const db = openDatabase();
  try { requireAdmin(request, db, true); return NextResponse.json({ id: addMenuItem(db, mealSchema.parse(await request.json())) }, { status: 201 }); }
  catch (error) { const status = error instanceof AuthError ? error.status : 400; return NextResponse.json({ error: { code: error instanceof AuthError ? error.code : 'VALIDATION_ERROR', message: '餐食无法保存' } }, { status }); }
}
