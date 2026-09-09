import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { AuthError, requireAdmin } from '@/lib/server/auth';
import {
  CandidatePoolError,
  createCandidateDraft,
  listCandidateDrafts,
} from '@/lib/candidate-pool';

export async function GET(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db);
    const limit = Number(new URL(request.url).searchParams.get('limit') || 8);
    return NextResponse.json({ data: listCandidateDrafts(db, limit) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db, true);
    const body = await request.json();
    const payload =
      body && typeof body === 'object' && 'payload' in body
        ? (body as { payload: unknown }).payload
        : body;
    return NextResponse.json(
      { data: createCandidateDraft(db, payload) },
      { status: 201 },
    );
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
