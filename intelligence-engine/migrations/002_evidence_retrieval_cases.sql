ALTER TABLE policy_rules ADD COLUMN rule_key TEXT;
ALTER TABLE policy_rules ADD COLUMN evidence_id TEXT REFERENCES evidence(id);
ALTER TABLE policy_rules ADD COLUMN effective_date_basis TEXT NOT NULL DEFAULT 'unconfirmed';
ALTER TABLE policy_rules ADD COLUMN reviewed_by TEXT;
ALTER TABLE policy_rules ADD COLUMN reviewed_at TEXT;
UPDATE policy_rules SET rule_key = jurisdiction || ':' || applicant_scope || ':' || module || ':' || rule_type;

CREATE TABLE evidence (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    url TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    method TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    document_id TEXT REFERENCES retrieval_documents(id)
);
CREATE TRIGGER immutable_evidence_update BEFORE UPDATE ON evidence
BEGIN SELECT RAISE(ABORT, 'evidence is immutable'); END;
CREATE TRIGGER immutable_evidence_delete BEFORE DELETE ON evidence
BEGIN SELECT RAISE(ABORT, 'evidence is immutable'); END;

CREATE TABLE source_targets (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    module TEXT NOT NULL,
    interval_hours INTEGER NOT NULL DEFAULT 24 CHECK(interval_hours >= 1),
    last_attempt TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    UNIQUE(source_id, module)
);
ALTER TABLE retrieval_documents ADD COLUMN effective_to TEXT;
ALTER TABLE retrieval_documents ADD COLUMN reviewed_by TEXT;
CREATE UNIQUE INDEX idx_document_version ON retrieval_documents(source_id, module, content_hash);
CREATE VIRTUAL TABLE chunk_search USING fts5(chunk_id UNINDEXED, text, tokenize='unicode61');
CREATE TRIGGER chunk_search_insert AFTER INSERT ON retrieval_chunks
BEGIN INSERT INTO chunk_search(chunk_id, text) VALUES (new.id, new.text); END;
CREATE TRIGGER chunk_search_delete AFTER DELETE ON retrieval_chunks
BEGIN DELETE FROM chunk_search WHERE chunk_id = old.id; END;
CREATE TRIGGER chunk_search_update AFTER UPDATE OF text ON retrieval_chunks
BEGIN UPDATE chunk_search SET text = new.text WHERE chunk_id = new.id; END;
INSERT INTO chunk_search(chunk_id, text) SELECT id, text FROM retrieval_chunks;

CREATE TABLE case_snapshots (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    as_of TEXT NOT NULL,
    created_at TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    payload TEXT NOT NULL
);
CREATE INDEX idx_case_snapshots ON case_snapshots(case_id, created_at);
CREATE TRIGGER immutable_snapshot_update BEFORE UPDATE ON case_snapshots
BEGIN SELECT RAISE(ABORT, 'snapshots are immutable'); END;
CREATE TRIGGER immutable_snapshot_delete BEFORE DELETE ON case_snapshots
BEGIN SELECT RAISE(ABORT, 'snapshots are immutable'); END;

CREATE TABLE audit_events (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at TEXT NOT NULL,
    payload TEXT NOT NULL
);
CREATE TRIGGER immutable_audit_update BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit events are immutable'); END;
CREATE TRIGGER immutable_audit_delete BEFORE DELETE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit events are immutable'); END;

CREATE TABLE knowledge_records (
    id TEXT PRIMARY KEY,
    record_key TEXT NOT NULL,
    module TEXT NOT NULL CHECK(module IN ('institutions', 'programs', 'admissions', 'scholarships', 'english', 'immigration')),
    jurisdiction TEXT NOT NULL REFERENCES countries(code),
    applicant_scope TEXT NOT NULL,
    title TEXT NOT NULL,
    payload TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    source_id TEXT NOT NULL REFERENCES sources(id),
    source_url TEXT NOT NULL,
    evidence_id TEXT NOT NULL REFERENCES evidence(id),
    last_verified TEXT NOT NULL,
    confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
    status TEXT NOT NULL CHECK(status IN ('active', 'under_review', 'archived')),
    reviewed_by TEXT NOT NULL
);
CREATE INDEX idx_knowledge_lookup ON knowledge_records(module, jurisdiction, effective_from, effective_to);
ALTER TABLE knowledge_records ADD COLUMN effective_date_basis TEXT NOT NULL DEFAULT 'unconfirmed';
UPDATE policy_rules SET status = 'under_review' WHERE evidence_id IS NULL;
CREATE TRIGGER immutable_rule_content BEFORE UPDATE OF payload, source_id, source_url, evidence_id,
    effective_from, last_verified, confidence, rule_key, reviewed_by, reviewed_at ON policy_rules
BEGIN SELECT RAISE(ABORT, 'publish a new rule version instead'); END;
CREATE TRIGGER immutable_rule_delete BEFORE DELETE ON policy_rules
BEGIN SELECT RAISE(ABORT, 'policy versions are immutable'); END;
CREATE TRIGGER immutable_knowledge_update BEFORE UPDATE OF payload, source_id, source_url, evidence_id,
    effective_from, last_verified, confidence, record_key, reviewed_by ON knowledge_records
BEGIN SELECT RAISE(ABORT, 'publish a new knowledge version instead'); END;
