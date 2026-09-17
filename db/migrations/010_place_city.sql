-- City attribution (2026-09-15): give pilot zones and places an explicit city
-- id so overlapping neighbouring-city bboxes can no longer leak a place into
-- another city's view (e.g. a Foshan place showing up inside the Guangzhou
-- bbox).  This is the structural fix for HANDOFF §12 "城市/商圈以近似 bbox 划分".
--
-- `pilot_zones.city` records the city a zone belongs to (demo zones are
-- Shenzhen; creator zones use the `creator-<cityId>` id).  `places.city`
-- mirrors its zone's city and is the column the public map filters on.  Both
-- stay nullable for legacy/unresolved rows; the map treats NULL as "unknown"
-- and does not exclude those places, keeping the change backward compatible.
ALTER TABLE pilot_zones ADD COLUMN city TEXT;
ALTER TABLE places ADD COLUMN city TEXT;

CREATE INDEX IF NOT EXISTS idx_places_city ON places(city);

-- Backfill creator zones from the unambiguous id prefix, then resolve any
-- remaining zone by the smallest containing city region bbox.
UPDATE pilot_zones SET city = substr(id, 9)
 WHERE id LIKE 'creator-%' AND city IS NULL;

UPDATE pilot_zones SET city = (
  SELECT r.id FROM regions r
   WHERE r.level = 'city'
     AND pilot_zones.center_lng BETWEEN r.bbox_west AND r.bbox_east
     AND pilot_zones.center_lat BETWEEN r.bbox_south AND r.bbox_north
   ORDER BY (r.bbox_east - r.bbox_west) * (r.bbox_north - r.bbox_south) ASC
   LIMIT 1
) WHERE city IS NULL;

UPDATE places SET city = (SELECT z.city FROM pilot_zones z WHERE z.id = places.zone_id)
 WHERE city IS NULL;
