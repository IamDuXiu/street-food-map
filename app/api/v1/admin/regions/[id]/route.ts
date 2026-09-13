import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { patchRegion, RegionError } from '@/lib/server/region-repository';
import { regionPatchSchema } from '@/lib/server/validation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = openDatabase();
  try {
    requireAdmin(request, db, true);
    const { id } = await params;
    const parsed = regionPatchSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: {
            code: 'REGION_INVALID',
            message: parsed.error.issues[0]?.message ?? '区域数据无效',
          },
        },
        { status: 400 },
      );
    patchRegion(db, id, parsed.data, 'admin');
    return NextResponse.json({ data: { id } });
  } catch (error) {
    if (error instanceof AuthError)
      return NextResponse.json(
        { error: { code: error.code, message: '未授权或请求来源不受信任' } },
        { status: error.status },
      );
    if (error instanceof RegionError)
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 400 },
      );
    return NextResponse.json(
      { error: { code: 'REGION_REQUEST_INVALID', message: '区域请求无效' } },
      { status: 400 },
    );
  }
}
