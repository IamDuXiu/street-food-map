-- Reconcile candidate-pool schema drift observed in databases that reached
-- schema 6 before matched_place_id was added by the application.
-- The runner adds that column conditionally before this file is executed.
CREATE TRIGGER IF NOT EXISTS source_leads_referenced_delete
BEFORE DELETE ON source_leads
WHEN EXISTS (SELECT 1 FROM price_reports WHERE source_lead_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'source lead is referenced by a price report');
END;
