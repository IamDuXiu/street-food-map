import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin } from '@/lib/server/auth';
import { readAdminMedia } from '@/lib/server/media';

export const runtime = 'nodejs';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = openDatabase();
    requireAdmin(request, db);
    const media = await readAdminMedia(db, (await params).id);
    return new NextResponse(media.body, {
      headers: {
        'content-type': media.mimeType,
        'cache-control': 'no-store',
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
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = openDatabase();
  try {
    requireAdmin(request, db, true);
    const body = (await request.json()) as {
      redactionStatus?: string;
      visibility?: string;
    };
    const id = (await params).id;
    const media = db
      .prepare(
        'SELECT rights_confirmed_at,price_report_id,redaction_status,visibility FROM evidence_media WHERE id=?',
      )
      .get(id) as
      | {
          rights_confirmed_at: string | null;
          price_report_id: string | null;
          redaction_status: string;
          visibility: string;
        }
      | undefined;
    if (!media) throw new Error('NOT_FOUND');
    const redaction = body.redactionStatus ?? media.redaction_status;
    const visibility = body.visibility ?? media.visibility;
    if (
      !['completed', 'not_needed', 'pending'].includes(redaction) ||
      !['public', 'admin_only'].includes(visibility)
    )
      throw new Error('MEDIA_UPDATE_INVALID');
    const publicFact =
      media.price_report_id &&
      db
        .prepare(
          "SELECT 1 FROM price_reports pr JOIN menu_items mi ON mi.id=pr.menu_item_id JOIN places p ON p.id=mi.place_id WHERE pr.id=? AND pr.status='verified' AND pr.verification_method <> 'external_lead' AND pr.price_fen<=2500 AND p.record_status='active' AND p.business_status IN ('open','unknown')",
        )
        .get(media.price_report_id);
    if (
      visibility === 'public' &&
      (!media.rights_confirmed_at ||
        !publicFact ||
        !['completed', 'not_needed'].includes(redaction))
    )
      throw new Error('MEDIA_PUBLIC_REVIEW_REQUIRED');
    db.prepare(
      'UPDATE evidence_media SET redaction_status=?,visibility=? WHERE id=?',
    ).run(redaction, visibility, id);
    return NextResponse.json({
      data: { id, visibility, redactionStatus: redaction },
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const code = [
      'MEDIA_PUBLIC_REVIEW_REQUIRED',
      'MEDIA_UPDATE_INVALID',
    ].includes(raw)
      ? raw
      : 'MEDIA_UPDATE_FAILED';
    return NextResponse.json(
      {
        error: {
          code,
          message:
            code === 'MEDIA_PUBLIC_REVIEW_REQUIRED'
              ? '请先确认权利、隐私检查和正式事实关联。'
              : '图片更新失败。',
        },
      },
      {
        status:
          code === 'MEDIA_PUBLIC_REVIEW_REQUIRED' ||
          code === 'MEDIA_UPDATE_INVALID'
            ? 400
            : 404,
      },
    );
  }
}
