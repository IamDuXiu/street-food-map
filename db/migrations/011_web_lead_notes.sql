-- Web / search-engine leads may carry a short review excerpt for admin
-- preview only.  The public DTO never reads this column.
ALTER TABLE source_leads ADD COLUMN review_notes TEXT;
