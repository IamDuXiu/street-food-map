import { NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { TAGS, VIEWPORTS } from '@/lib/fixtures';
import { SHENZHEN_REGION_CATALOG } from '@/lib/regions';

export const dynamic = 'force-dynamic';

const fallbackZones = VIEWPORTS.map(({ id, label, subtitle, centerLng, centerLat }) => ({
  id,
  name: label,
  subtitle,
  centerLng,
  centerLat,
}));

export async function GET() {
  try {
    const db = openDatabase();
    const zones = db.prepare('SELECT id,name,audience,center_lng centerLng,center_lat centerLat FROM pilot_zones WHERE active=1 ORDER BY id').all();
    const tags = db.prepare('SELECT name FROM tags ORDER BY name').all() as Array<{ name: string }>;
    return NextResponse.json({ data: {
      priceOptionsFen: [1500, 2000, 2500],
      tags: tags.length ? tags.map((tag) => tag.name) : TAGS,
      zones: zones.length ? zones : fallbackZones,
      regions: SHENZHEN_REGION_CATALOG,
      map: { mode: process.env.NEXT_PUBLIC_MAP_MODE === 'tencent' && process.env.NEXT_PUBLIC_TENCENT_MAP_KEY ? 'tencent' : 'demo', hasMapKey: Boolean(process.env.NEXT_PUBLIC_TENCENT_MAP_KEY) },
    } });
  } catch {
    return NextResponse.json({ data: { priceOptionsFen: [1500, 2000, 2500], tags: TAGS, zones: fallbackZones, regions: SHENZHEN_REGION_CATALOG, map: { mode: 'demo', hasMapKey: false } } });
  }
}
