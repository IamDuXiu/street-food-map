-- Candidate workflow storage.  A source URL may contain several menu-item
-- clues; the old source_leads columns remain as a compatibility projection.
CREATE TABLE IF NOT EXISTS source_lead_items (
  id TEXT PRIMARY KEY,
  source_lead_id TEXT NOT NULL REFERENCES source_leads(id) ON DELETE RESTRICT,
  clue_item_name TEXT NOT NULL,
  clue_price_fen INTEGER CHECK (clue_price_fen IS NULL OR clue_price_fen > 0),
  clue_metadata_json TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'verifying', 'converted', 'rejected', 'duplicate')),
  matched_menu_item_id TEXT REFERENCES menu_items(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_lead_id, clue_item_name)
);

ALTER TABLE source_leads ADD COLUMN discovery_method TEXT;

-- Existing rows used source_platform as their discovery channel.  Keep that
-- information explicit so verification_method can no longer double as a
-- discovery/source label.
UPDATE source_leads
SET discovery_method = CASE
  WHEN source_platform = 'douban' THEN 'community'
  WHEN source_platform = 'user' THEN 'user_submission'
  WHEN source_platform = 'web' THEN 'web'
  ELSE 'manual'
END
WHERE discovery_method IS NULL;

-- Preserve the old one-item shape when upgrading an existing database.  The
-- deterministic id makes this statement safe to run once during migration and
-- gives operators a stable item to edit afterwards.
INSERT OR IGNORE INTO source_lead_items(
  id, source_lead_id, clue_item_name, clue_price_fen, status, created_at, updated_at
)
SELECT
  'legacy-item-' || id,
  id,
  clue_item_name,
  clue_price_fen,
  status,
  created_at,
  updated_at
FROM source_leads
WHERE clue_item_name IS NOT NULL AND trim(clue_item_name) <> '';

-- Keep the legacy projection populated from the first item when an older
-- database already had item-level data but a blank compatibility column.
UPDATE source_leads
SET clue_item_name = COALESCE(
      clue_item_name,
      (SELECT clue_item_name FROM source_lead_items i
       WHERE i.source_lead_id=source_leads.id ORDER BY i.created_at,i.id LIMIT 1)
    ),
    clue_price_fen = COALESCE(
      clue_price_fen,
      (SELECT clue_price_fen FROM source_lead_items i
       WHERE i.source_lead_id=source_leads.id ORDER BY i.created_at,i.id LIMIT 1)
    )
WHERE EXISTS (SELECT 1 FROM source_lead_items i WHERE i.source_lead_id=source_leads.id);

-- Old databases could already contain an external clue incorrectly marked as
-- verified before the candidate workflow existed.  Keep the row for audit,
-- but make it pending so it cannot be exposed as a public price.
UPDATE price_reports
SET status='pending', reviewed_at=NULL
WHERE status='verified' AND verification_method='external_lead';

CREATE TABLE IF NOT EXISTS lead_conversion_drafts (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  source_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_source_lead_items_lead_status
  ON source_lead_items(source_lead_id, status);
CREATE INDEX IF NOT EXISTS idx_source_lead_items_updated
  ON source_lead_items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_leads_discovery_method
  ON source_leads(discovery_method);
CREATE INDEX IF NOT EXISTS idx_lead_conversion_drafts_updated
  ON lead_conversion_drafts(updated_at DESC);

-- A discovery/source clue can never be represented as a public verified price.
-- These triggers also protect direct SQL writers and old admin endpoints.
CREATE TRIGGER IF NOT EXISTS price_reports_no_external_verified_insert
BEFORE INSERT ON price_reports
WHEN NEW.verification_method = 'external_lead' AND NEW.status = 'verified'
BEGIN
  SELECT RAISE(ABORT, 'external_lead cannot create a verified price');
END;
CREATE TRIGGER IF NOT EXISTS price_reports_no_external_verified_update
BEFORE UPDATE OF verification_method, status ON price_reports
WHEN NEW.verification_method = 'external_lead' AND NEW.status = 'verified'
BEGIN
  SELECT RAISE(ABORT, 'external_lead cannot create a verified price');
END;
