import { NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { readPublicMedia } from '@/lib/server/media';

export const runtime = 'nodejs';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const media = await readPublicMedia(openDatabase(), id);
    return new NextResponse(media.body, {
      headers: {
        'content-type': media.mimeType,
        'cache-control': 'public, max-age=300',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '图片不存在。' } },
      { status: 404 },
    );
  }
}
