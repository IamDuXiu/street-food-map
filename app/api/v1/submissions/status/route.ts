import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { getSubmissionStatus } from '@/lib/server/services';
import { sourceHash } from '@/lib/server/auth';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    const lookupCode =
      request.nextUrl.searchParams.get('lookupCode') ??
      request.nextUrl.searchParams.get('code') ??
      '';
    const data = getSubmissionStatus(
      openDatabase(),
      lookupCode,
      sourceHash(request),
    );
    return NextResponse.json({ data });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'NOT_FOUND';
    const status = code === 'RATE_LIMITED' ? 429 : 404;
    return NextResponse.json(
      {
        error: {
          code,
          message:
            code === 'RATE_LIMITED'
              ? '查询次数较多，请稍后再试。'
              : '查询码不正确或已失效。',
        },
      },
      { status },
    );
  }
}
