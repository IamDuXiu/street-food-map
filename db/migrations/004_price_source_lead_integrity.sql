CREATE TRIGGER IF NOT EXISTS price_reports_source_lead_insert
BEFORE INSERT ON price_reports
WHEN NEW.source_lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM source_leads WHERE id = NEW.source_lead_id)
BEGIN SELECT RAISE(ABORT, 'price_reports.source_lead_id does not reference a source lead'); END;
CREATE TRIGGER IF NOT EXISTS price_reports_source_lead_update
BEFORE UPDATE OF source_lead_id ON price_reports
WHEN NEW.source_lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM source_leads WHERE id = NEW.source_lead_id)
BEGIN SELECT RAISE(ABORT, 'price_reports.source_lead_id does not reference a source lead'); END;
