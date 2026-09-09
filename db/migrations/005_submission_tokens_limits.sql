ALTER TABLE submissions ADD COLUMN upload_token_hash TEXT;
ALTER TABLE submissions ADD COLUMN upload_token_expires_at TEXT;
ALTER TABLE submissions ADD COLUMN source_hash TEXT;
ALTER TABLE submissions ADD COLUMN rights_confirmed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_submissions_lookup_code ON submissions(lookup_code_hash);
CREATE INDEX IF NOT EXISTS idx_submissions_source_created ON submissions(source_hash,created_at);
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_buckets(window_start);
