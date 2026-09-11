import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { PlaceRepository } from '@/lib/server/repository';
import { toPublicPlace } from '@/lib/server/public';

export const dynamic = 'force-dynamic';

function bad(message: string) {
  return NextResponse.json(
    { error: { code: 'INVALID_QUERY', message } },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const daysRaw = params.get('days');
  const limitRaw = params.get('limit');
  let days = 7;
  let limit = 5;
  if (daysRaw !== null) {
    days = Number(daysRaw);
    if (!Number.isInteger(days) || days < 1 || days > 30)
      return bad('天数越界（1–30）');
  }
  if (limitRaw !== null) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      return bad('条数越界（1–20）');
  }
  try {
    const rows = new PlaceRepository(openDatabase()).listRecentlyVerified({
      days,
      limit,
    });
    const data = rows
      .map((row) => toPublicPlace(row))
      .filter((place) => place.meals.length);
    return NextResponse.json({ data, meta: { count: data.length, days, limit } });
  } catch {
    return NextResponse.json({
      data: [],
      meta: { count: 0, days, limit },
    });
  }
}
