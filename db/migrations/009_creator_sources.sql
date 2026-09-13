-- Creator-sourced data (2026-09-13): places and menu items discovered from
-- creator content on B站 / YouTube / 小红书 / 抖音 / 大众点评.
--
-- `entity_sources` attributes one entity (place or menu_item) to many creators.
-- Source labels are rendered as "platform@creator" joined by ";" (deduped).
-- A creator price stays an `external_lead` and can never become a verified
-- price (enforced by the migration-006 triggers); it is public but always
-- marked "未核验".
CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_account_id TEXT,
  display_name TEXT NOT NULL,
  profile_url TEXT,
  primary_city TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(platform, platform_account_id)
);

-- Cross-platform accounts for one canonical creator (e.g. Bilibili mid ↔
-- YouTube channel id).  `ownership` records whether the binding is verified.
CREATE TABLE IF NOT EXISTS creator_accounts (
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  handle TEXT,
  channel_id TEXT,
  url TEXT,
  ownership TEXT CHECK (ownership IN ('official', 'suspected', 'third_party')),
  PRIMARY KEY (creator_id, platform)
);

CREATE TABLE IF NOT EXISTS entity_sources (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('place', 'menu_item')),
  entity_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  content_url TEXT,
  observed_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id, platform, creator_name)
);

-- Creator metadata attached to a discovery lead.  `source_url` (the legacy
-- column) stays private; `content_url` is the only URL allowed to be linked
-- publicly.  `public_visibility` controls whether the lead may be surfaced as
-- a creator recommendation; it never implies independent verification.
ALTER TABLE source_leads ADD COLUMN creator_id TEXT;
ALTER TABLE source_leads ADD COLUMN platform TEXT;
ALTER TABLE source_leads ADD COLUMN content_title TEXT;
ALTER TABLE source_leads ADD COLUMN content_url TEXT;
ALTER TABLE source_leads ADD COLUMN published_at TEXT;
ALTER TABLE source_leads ADD COLUMN city TEXT;
ALTER TABLE source_leads ADD COLUMN play_count INTEGER;
ALTER TABLE source_leads ADD COLUMN public_visibility TEXT NOT NULL DEFAULT 'hidden'
  CHECK (public_visibility IN ('hidden', 'listed'));

CREATE INDEX IF NOT EXISTS idx_entity_sources_entity
  ON entity_sources(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_sources_creator
  ON entity_sources(platform, creator_name);
CREATE INDEX IF NOT EXISTS idx_source_leads_visibility
  ON source_leads(public_visibility);
CREATE INDEX IF NOT EXISTS idx_source_leads_creator
  ON source_leads(creator_id);
