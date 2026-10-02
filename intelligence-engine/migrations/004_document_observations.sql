DROP INDEX idx_document_version;
CREATE INDEX idx_document_version ON retrieval_documents(source_id, module, content_kind, content_hash);
