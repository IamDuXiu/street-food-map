import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin } from '@/lib/server/auth';
import { saveAdminReplacement } from '@/lib/server/media';

export const runtime = 'nodejs';

/** The replacement is never public on upload; an administrator must run the normal privacy review first. */
export async function POST(request: NextRequest) {
  try {
    const db = openDatabase();
    requireAdmin(request, db, true);
    const form = await request.formData();
    const file = form.get('file');
    const originalMediaId = String(form.get('replacesMediaId') ?? '');
    if (!(file instanceof File) || !originalMediaId)
      throw new Error('REQUEST_INVALID');
    if (
      form.get('rightsConfirmed') !== 'true' &&
      form.get('rightsConfirmed') !== 'on'
    )
      throw new Error('RIGHTS_CONFIRMATION_REQUIRED');
    const data = await saveAdminReplacement(db, originalMediaId, file, true);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const known: Record<string, number> = {
      RIGHTS_CONFIRMATION_REQUIRED: 400,
      FILE_TOO_LARGE: 413,
      MIME_MISMATCH: 415,
      MEDIA_LIMIT_REACHED: 409,
      MEDIA_NOT_FOUND: 404,
    };
    const code = Object.prototype.hasOwnProperty.call(known, raw)
      ? raw
      : 'MEDIA_UPLOAD_FAILED';
    const status = known[code] ?? 400;
    return NextResponse.json(
      {
        error: {
          code,
          message:
            code === 'RIGHTS_CONFIRMATION_REQUIRED'
              ? '请确认替代图已获得使用授权。'
              : '替代图片上传失败，请检查格式后重试。',
        },
      },
      { status },
    );
  }
}
