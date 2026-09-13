import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import {
  createRegion,
  listAdminRegions,
  RegionError,
} from '@/lib/server/region-repository';
import { regionCreateSchema } from '@/lib/server/validation';

function errorResponse(error: unknown) {
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

export async function GET(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db);
    return NextResponse.json({ data: listAdminRegions(db) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db, true);
    const parsed = regionCreateSchema.safeParse(await request.json());
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
    const id = createRegion(db, parsed.data, 'admin');
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
