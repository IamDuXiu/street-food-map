import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { AuthError, requireAdmin } from '@/lib/server/auth';
import {
  CandidatePoolError,
  commitCandidateDraft,
  parseCandidateCommitRequest,
} from '@/lib/candidate-pool';

export async function POST(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db, true);
    const body = parseCandidateCommitRequest(await request.json());
    return NextResponse.json({ data: commitCandidateDraft(db, body) });
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
    {
      error: {
        code: 'CANDIDATE_COMMIT_FAILED',
        message: '导入未写入，数据已回滚',
      },
    },
    { status: 400 },
  );
}
