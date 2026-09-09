import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { createSubmission } from '@/lib/server/services';
import { sourceHash } from '@/lib/server/auth';
import { ZodError } from 'zod';

export const runtime = 'nodejs';
function errorResponse(error: unknown) {
  const code =
    error instanceof ZodError
      ? 'VALIDATION_ERROR'
      : error instanceof Error && error.message === 'RATE_LIMITED'
        ? 'RATE_LIMITED'
        : 'SUBMISSION_FAILED';
  const status = code === 'RATE_LIMITED' ? 429 : 400;
  const message =
    code === 'RATE_LIMITED'
      ? '提交次数较多，请稍后再试。'
      : '投稿内容无法提交，请检查后重试。';
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const honeypot = typeof body.website === 'string' ? body.website : '';
    if (honeypot)
      return NextResponse.json(
        {
          error: {
            code: 'REQUEST_REJECTED',
            message: '投稿内容无法提交，请检查后重试。',
          },
        },
        { status: 400 },
      );
    const { website: _website, rightsConfirmed, ...payload } = body;
    const result = createSubmission(openDatabase(), payload, {
      sourceHash: sourceHash(request),
      rightsConfirmed: rightsConfirmed === true,
    });
    return NextResponse.json(
      {
        data: {
          id: result.id,
          lookupCode: result.lookupCode,
          uploadToken: result.uploadToken,
          uploadTokenExpiresAt: result.uploadTokenExpiresAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
