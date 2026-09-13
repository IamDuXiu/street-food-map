-- Region catalog (2026-09-13): browsable city / district / business-area tree,
-- extended from Shenzhen-only to the Pearl River Delta (9 cities).  Coverage
-- (live / planned) is intentionally NOT stored: it is derived at query time
-- from whether a bbox contains public points.  Seeded from lib/regions.ts by
-- scripts/seed-regions.ts; runtime reads this table (with static fallback).
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL DEFAULT '',  -- top-level city rows use empty string
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('city', 'district', 'business_area')),
  center_lng REAL NOT NULL,
  center_lat REAL NOT NULL,
  bbox_west REAL NOT NULL,
  bbox_south REAL NOT NULL,
  bbox_east REAL NOT NULL,
  bbox_north REAL NOT NULL,
  zoom INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_regions_level ON regions(level, active);
