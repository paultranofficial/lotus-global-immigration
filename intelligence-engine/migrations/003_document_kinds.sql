ALTER TABLE retrieval_documents ADD COLUMN content_kind TEXT NOT NULL DEFAULT 'live_page';
UPDATE retrieval_documents SET content_kind = 'reviewed_summary' WHERE title LIKE 'Reviewed summary:%';
