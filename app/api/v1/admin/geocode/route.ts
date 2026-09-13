import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { geocodeAddress } from '@/lib/server/geocode';

export async function POST(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db);
    const body = (await request.json()) as { address?: unknown };
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    if (!address)
      return NextResponse.json(
        { error: { code: 'ADDRESS_REQUIRED', message: '请提供地址' } },
        { status: 400 },
      );
    const candidates = await geocodeAddress(address);
    return NextResponse.json({
      data: {
        address,
        candidates,
        hasKey: Boolean(
          process.env.TENCENT_MAP_WEB_SERVICE_KEY ??
            process.env.TENCENT_MAP_KEY,
        ),
      },
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json(
      {
        error: {
          code: error instanceof AuthError ? error.code : 'GEOCODE_FAILED',
          message: '地址解析失败',
        },
      },
      { status },
    );
  }
}
