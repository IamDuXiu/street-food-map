CREATE INDEX IF NOT EXISTS idx_moderation_actions_created ON moderation_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status_created ON submissions(status,created_at DESC);
