import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import {
  commitCreatorImport,
  creatorImportRecordSchema,
  previewCreatorImport,
} from '@/lib/server/creator-import';

export async function POST(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db, true);
    const body = (await request.json()) as { records?: unknown };
    if (!Array.isArray(body.records)) throw new Error('RECORDS_REQUIRED');
    const checked = await previewCreatorImport(db, body.records);
    if (!checked.valid)
      return NextResponse.json(
        {
          error: {
            code: 'IMPORT_INVALID',
            message: '请先修正全部错误',
            errors: checked.errors,
          },
        },
        { status: 422 },
      );
    const records = body.records.map((raw, index) => {
      const row = checked.rows[index];
      const base = { ...(raw as Record<string, unknown>) };
      delete base.matchedPlaceId;
      return creatorImportRecordSchema.parse({
        ...base,
        lng: row.lng,
        lat: row.lat,
        ...(row.matchedPlaceId ? { matchedPlaceId: row.matchedPlaceId } : {}),
      });
    });
    const results = commitCreatorImport(db, records, 'admin');
    return NextResponse.json({
      data: {
        imported: results.length,
        created: results.filter((item) => item.created).length,
        results,
      },
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json(
      {
        error: {
          code: error instanceof AuthError ? error.code : 'IMPORT_FAILED',
          message: '导入未写入，数据库已回滚',
        },
      },
      { status },
    );
  }
}
