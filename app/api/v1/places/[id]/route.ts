import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { PlaceRepository } from '@/lib/server/repository';
import { publicPlaceIsEligible, toPublicPlace } from '@/lib/server/public';
import { PLACES, VIEWPORTS } from '@/lib/fixtures';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const place = new PlaceRepository(openDatabase()).get(id);
    if (!place || !publicPlaceIsEligible(place))
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '地点不存在或暂不可公开' } },
        { status: 404 },
      );
    const data = toPublicPlace(place);
    if (
      !data.meals.length ||
      !      place.meals.some(
        (meal) => meal.priceFen <= 2500 && meal.freshness !== '已过期',
      )
    )
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '地点不存在或暂不可公开' } },
        { status: 404 },
      );
    return NextResponse.json({ data });
  } catch {
    const place = PLACES.find((item) => item.id === id);
    if (!place)
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '地点不存在或暂不可公开' } },
        { status: 404 },
      );
    return NextResponse.json({
      data: {
        ...place,
        zoneName:
          VIEWPORTS.find((zone) => zone.id === place.zoneId)?.label ??
          place.zoneId,
        evidence: [],
      },
    });
  }
}
