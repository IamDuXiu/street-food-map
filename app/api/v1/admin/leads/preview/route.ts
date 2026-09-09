import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { AuthError, requireAdmin } from '@/lib/server/auth';
import {
  CandidatePoolError,
  previewCandidateDraft,
} from '@/lib/candidate-pool';

export async function POST(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db, true);
    const body = await request.json();
    return NextResponse.json({ data: previewCandidateDraft(db, body) });
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
    { error: { code: 'CANDIDATE_PREVIEW_FAILED', message: '候选预览失败' } },
    { status: 400 },
  );
}
