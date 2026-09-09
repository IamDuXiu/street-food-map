import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { AuthError, requireAdmin } from '@/lib/server/auth';
import {
  CandidatePoolError,
  getCandidateDraft,
  saveCandidateDraft,
} from '@/lib/candidate-pool';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = openDatabase();
  try {
    requireAdmin(request, db);
    const { id } = await params;
    const data = getCandidateDraft(db, id);
    if (!data)
      throw new CandidatePoolError('DRAFT_NOT_FOUND', '草稿不存在', 404);
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = openDatabase();
  try {
    requireAdmin(request, db, true);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const payload = body.payload ?? body;
    const version =
      typeof body.version === 'number' ? body.version : Number(body.version);
    return NextResponse.json({
      data: saveCandidateDraft(db, {
        id,
        payload,
        version: Number.isFinite(version) ? version : undefined,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError)
    return NextResponse.json(
      { error: { code: error.code, message: '未授权或请求来源不受信任' } },
      { status: error.status },
    );
  if (error instanceof CandidatePoolError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  return NextResponse.json(
    { error: { code: 'DRAFT_REQUEST_FAILED', message: '草稿无法保存' } },
    { status: 400 },
  );
}
