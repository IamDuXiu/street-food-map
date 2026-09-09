import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import {
  PlaceRepository,
  type PublicMapFilters,
} from '@/lib/server/repository';
import { TAGS, PLACES, VIEWPORTS } from '@/lib/fixtures';
import { toPublicPlace } from '@/lib/server/public';

export const dynamic = 'force-dynamic';

function bad(message: string) {
  return NextResponse.json(
    { error: { code: 'INVALID_QUERY', message } },
    { status: 400 },
  );
}
function parse(
  request: NextRequest,
  allowedZoneIds: string[],
  allowedTags: string[],
): PublicMapFilters | Response {
  const params = request.nextUrl.searchParams;
  const q = params.get('q')?.trim() || undefined;
  if (q && q.length > 100) return bad('关键词过长');
  const zoneId = params.get('zoneId') || undefined;
  if (zoneId && !allowedZoneIds.includes(zoneId)) return bad('片区不存在');
  const maxRaw = params.get('maxPriceFen');
  const maxPriceFen = maxRaw === null ? undefined : Number(maxRaw);
  if (
    maxRaw !== null &&
    (maxPriceFen === undefined ||
      !Number.isInteger(maxPriceFen) ||
      maxPriceFen < 1 ||
      maxPriceFen > 2500)
  )
    return bad('价格上限无效');
  const sort = params.get('sort') as PublicMapFilters['sort'] | null;
  if (sort && !['distance', 'price', 'freshness'].includes(sort))
    return bad('排序方式无效');
  const tags = [
    ...params.getAll('tag'),
    ...(params.get('tags')?.split(',').filter(Boolean) ?? []),
  ];
  if (tags.some((tag) => !allowedTags.includes(tag))) return bad('标签无效');
  let bbox: [number, number, number, number] | undefined;
  const bboxRaw = params.get('bbox');
  if (bboxRaw) {
    const values = bboxRaw.split(',').map(Number);
    if (
      values.length !== 4 ||
      values.some((value) => !Number.isFinite(value)) ||
      values[0] > values[2] ||
      values[1] > values[3]
    )
      return bad('视野范围无效');
    bbox = [values[0], values[1], values[2], values[3]];
  }
  if (params.has('origin')) return bad('精确定位只在当前页面使用');
  const origin =
    sort === 'distance' && bbox
      ? { lng: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 }
      : undefined;
  if (sort === 'distance' && !bbox) return bad('按距离排序需要视野范围');
  return {
    q,
    zoneId,
    maxPriceFen,
    sort: sort ?? undefined,
    tags: [...new Set(tags)],
    bbox,
    origin,
  };
}

export async function GET(request: NextRequest) {
  let db: ReturnType<typeof openDatabase> | null = null;
  try {
    db = openDatabase();
  } catch {
    db = null;
  }
  const databaseZoneIds = db
    ? (
        db.prepare('SELECT id FROM pilot_zones WHERE active=1').all() as Array<{
          id: string;
        }>
      ).map((row) => row.id)
    : [];
  const databaseTags = db
    ? (
        db.prepare('SELECT name FROM tags').all() as Array<{ name: string }>
      ).map((row) => row.name)
    : [];
  const allowedZoneIds = databaseZoneIds.length
    ? databaseZoneIds
    : VIEWPORTS.map((zone) => zone.id);
  const allowedTags = databaseTags.length ? databaseTags : TAGS;
  const parsed = parse(request, allowedZoneIds, allowedTags);
  if (parsed instanceof Response) return parsed;
  const now = new Date();
  try {
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const rows = new PlaceRepository(db).listPublic({
      ...parsed,
      now,
      limit: 500,
    });
    const data = rows
      .map((row) => ({
        ...toPublicPlace(row, now, parsed.maxPriceFen),
        ...(row.distanceMeters === undefined
          ? {}
          : { distanceMeters: Math.round(row.distanceMeters) }),
      }))
      .filter((place) => place.meals.length);
    return NextResponse.json({
      data,
      meta: { count: data.length, limit: 500 },
    });
  } catch {
    // Fixture fallback is deliberately limited to safe, already-public demo data.
    const max = Math.min(parsed.maxPriceFen ?? 2500, 2500);
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - 180);
    const fallback = PLACES.filter(
      (place) =>
        (!parsed.zoneId || place.zoneId === parsed.zoneId) &&
        (!parsed.bbox ||
          (place.lng >= parsed.bbox[0] &&
            place.lng <= parsed.bbox[2] &&
            place.lat >= parsed.bbox[1] &&
            place.lat <= parsed.bbox[3])) &&
        (!parsed.q ||
          `${place.name} ${place.meals.map((meal) => meal.name).join(' ')}`.includes(
            parsed.q,
          )) &&
        (!parsed.tags?.length ||
          parsed.tags.every((tag) => place.tags.includes(tag as never))) &&
        place.meals.some(
          (meal) =>
            meal.priceFen <= max &&
            new Date(`${meal.observedAt}T00:00:00Z`) >= cutoff,
        ),
    );
    return NextResponse.json({
      data: fallback
        .map((place) => ({
          ...place,
          zoneName:
            VIEWPORTS.find((zone) => zone.id === place.zoneId)?.label ??
            place.zoneId,
          meals: place.meals.filter((meal) => meal.priceFen <= max),
          evidence: [],
        }))
        .slice(0, 500),
      meta: {
        count: Math.min(fallback.length, 500),
        limit: 500,
        fallback: true,
      },
    });
  }
}
