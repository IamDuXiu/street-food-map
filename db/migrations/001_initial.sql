PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pilot_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  audience TEXT NOT NULL CHECK (audience IN ('student', 'office_worker')),
  center_lng REAL NOT NULL,
  center_lat REAL NOT NULL,
  boundary_geojson TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES pilot_zones(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  address TEXT NOT NULL,
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  category TEXT NOT NULL,
  access_type TEXT NOT NULL,
  access_note TEXT,
  business_status TEXT NOT NULL DEFAULT 'unknown' CHECK (business_status IN ('open', 'temporarily_closed', 'closed', 'unknown')),
  record_status TEXT NOT NULL DEFAULT 'active' CHECK (record_status IN ('active', 'merged', 'archived')),
  merged_into_place_id TEXT REFERENCES places(id) ON DELETE RESTRICT,
  opening_hours_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(place_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS price_reports (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  price_fen INTEGER NOT NULL CHECK (price_fen > 0),
  observed_at TEXT NOT NULL,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('onsite_menu', 'receipt', 'official_menu', 'phone_check', 'community_confirmed', 'external_lead')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'disputed', 'superseded', 'archived')),
  source_lead_id TEXT,
  note TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS place_tags (
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (place_id, tag_id)
);

CREATE TABLE IF NOT EXISTS source_leads (
  id TEXT PRIMARY KEY,
  source_platform TEXT NOT NULL CHECK (source_platform IN ('douban', 'web', 'user', 'other')),
  source_url TEXT UNIQUE,
  clue_place_name TEXT NOT NULL,
  clue_item_name TEXT,
  clue_price_fen INTEGER CHECK (clue_price_fen IS NULL OR clue_price_fen > 0),
  source_published_at TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'verifying', 'converted', 'rejected', 'duplicate')),
  matched_place_id TEXT REFERENCES places(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('new_place', 'new_price', 'correction', 'closure')),
  target_place_id TEXT REFERENCES places(id) ON DELETE RESTRICT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'needs_verification', 'approved', 'rejected', 'duplicate')),
  lookup_code_hash TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS evidence_media (
  id TEXT PRIMARY KEY,
  price_report_id TEXT REFERENCES price_reports(id) ON DELETE RESTRICT,
  submission_id TEXT REFERENCES submissions(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  ownership TEXT NOT NULL CHECK (ownership IN ('self_shot', 'user_submitted', 'licensed')),
  visibility TEXT NOT NULL DEFAULT 'admin_only' CHECK (visibility IN ('admin_only', 'public')),
  rights_confirmed_at TEXT,
  redaction_status TEXT NOT NULL DEFAULT 'pending' CHECK (redaction_status IN ('pending', 'not_needed', 'completed')),
  replaces_media_id TEXT REFERENCES evidence_media(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_summary TEXT,
  after_summary TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  place_id TEXT REFERENCES places(id) ON DELETE RESTRICT,
  params_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  password_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  source_hash TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  first_failed_at TEXT,
  locked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_places_zone ON places(zone_id);
CREATE INDEX IF NOT EXISTS idx_places_status ON places(business_status, record_status);
CREATE INDEX IF NOT EXISTS idx_places_coordinates ON places(lng, lat);
CREATE INDEX IF NOT EXISTS idx_places_normalized_name ON places(normalized_name);
CREATE INDEX IF NOT EXISTS idx_menu_place ON menu_items(place_id);
CREATE INDEX IF NOT EXISTS idx_prices_menu_status ON price_reports(menu_item_id, status);
CREATE INDEX IF NOT EXISTS idx_prices_observed ON price_reports(observed_at);
CREATE INDEX IF NOT EXISTS idx_prices_price ON price_reports(price_fen);
CREATE INDEX IF NOT EXISTS idx_leads_status ON source_leads(status);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_media_submission ON evidence_media(submission_id);
CREATE INDEX IF NOT EXISTS idx_audit_object ON moderation_actions(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
