import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { saveSubmissionMedia } from '@/lib/server/media';

export const runtime = 'nodejs';
function errorResponse(error: unknown) {
  const raw = error instanceof Error ? error.message : '';
  const known: Record<string, number> = {
    FILE_TOO_LARGE: 413,
    MEDIA_LIMIT_REACHED: 409,
    UPLOAD_TOKEN_INVALID: 401,
    MIME_MISMATCH: 415,
    RIGHTS_CONFIRMATION_REQUIRED: 400,
    PATH_TRAVERSAL: 400,
    FILE_REQUIRED: 400,
  };
  const code = Object.prototype.hasOwnProperty.call(known, raw)
    ? raw
    : 'MEDIA_UPLOAD_FAILED';
  return NextResponse.json(
    {
      error: {
        code,
        message:
          code === 'FILE_TOO_LARGE'
            ? '图片不能超过 10MB。'
            : code === 'RIGHTS_CONFIRMATION_REQUIRED'
              ? '请确认你有权提交这张图片。'
              : '图片上传失败，请检查格式后重试。',
      },
    },
    { status: known[code] ?? 400 },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('FILE_REQUIRED');
    const token =
      request.headers.get('x-upload-token') ??
      String(form.get('uploadToken') ?? '');
    const rightsConfirmed =
      form.get('rightsConfirmed') === 'true' ||
      form.get('rightsConfirmed') === 'on';
    const data = await saveSubmissionMedia(
      openDatabase(),
      id,
      token,
      file,
      rightsConfirmed,
    );
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
