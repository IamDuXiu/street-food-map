import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { previewCreatorImport } from '@/lib/server/creator-import';

export async function POST(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db);
    const body = (await request.json()) as { records?: unknown };
    const records = Array.isArray(body.records) ? body.records : [];
    const result = await previewCreatorImport(db, records);
    return NextResponse.json({ data: result });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json(
      {
        error: {
          code: error instanceof AuthError ? error.code : 'PREVIEW_FAILED',
          message: '创作者内容预览失败',
        },
      },
      { status },
    );
  }
}
