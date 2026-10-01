CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    authority TEXT NOT NULL,
    authority_type TEXT NOT NULL CHECK (authority_type IN (
        'government_immigration',
        'government_education',
        'official_study_portal',
        'statutory_body',
        'institution',
        'trusted_sector_source'
    )),
    jurisdiction TEXT NOT NULL,
    url TEXT NOT NULL,
    reliability_tier INTEGER NOT NULL CHECK (reliability_tier BETWEEN 1 AND 5),
    last_verified TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'archived', 'under_review'))
);

CREATE TABLE IF NOT EXISTS countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    priority INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'planned', 'archived'))
);

CREATE TABLE IF NOT EXISTS institutions (
    id TEXT PRIMARY KEY,
    jurisdiction TEXT NOT NULL REFERENCES countries(code),
    name TEXT NOT NULL,
    institution_type TEXT NOT NULL,
    website_url TEXT,
    official_registry_id TEXT,
    source_id TEXT REFERENCES sources(id),
    last_verified TEXT,
    status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS programs (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL REFERENCES institutions(id),
    name TEXT NOT NULL,
    credential_level TEXT NOT NULL,
    field_of_study TEXT,
    duration_months INTEGER,
    delivery_mode TEXT,
    tuition_amount REAL,
    tuition_currency TEXT,
    intake_months TEXT,
    source_id TEXT REFERENCES sources(id),
    last_verified TEXT,
    status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS admissions (
    id TEXT PRIMARY KEY,
    program_id TEXT REFERENCES programs(id),
    jurisdiction TEXT NOT NULL REFERENCES countries(code),
    requirement_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    source_id TEXT NOT NULL REFERENCES sources(id),
    last_verified TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS scholarships (
    id TEXT PRIMARY KEY,
    jurisdiction TEXT NOT NULL REFERENCES countries(code),
    institution_id TEXT REFERENCES institutions(id),
    name TEXT NOT NULL,
    eligibility_payload TEXT NOT NULL,
    award_payload TEXT NOT NULL,
    deadline_payload TEXT,
    source_id TEXT NOT NULL REFERENCES sources(id),
    last_verified TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS policy_rules (
    id TEXT PRIMARY KEY,
    module TEXT NOT NULL CHECK (module IN (
        'visa',
        'finance',
        'english',
        'work_rights',
        'post-study',
        'immigration',
        'admissions',
        'scholarships'
    )),
    jurisdiction TEXT NOT NULL REFERENCES countries(code),
    applicant_scope TEXT NOT NULL,
    title TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    source_id TEXT NOT NULL REFERENCES sources(id),
    source_url TEXT NOT NULL,
    last_verified TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    status TEXT NOT NULL CHECK (status IN ('active', 'archived', 'under_review', 'superseded')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_policy_rules_lookup
ON policy_rules (jurisdiction, applicant_scope, module, effective_from, effective_to, status);

CREATE TABLE IF NOT EXISTS policy_changes (
    id TEXT PRIMARY KEY,
    jurisdiction TEXT NOT NULL REFERENCES countries(code),
    module TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('new', 'amendment', 'repeal', 'clarification')),
    announced_at TEXT,
    effective_from TEXT,
    source_id TEXT NOT NULL REFERENCES sources(id),
    source_url TEXT NOT NULL,
    ingestion_run_id TEXT,
    last_verified TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('candidate', 'verified', 'rejected', 'needs_human_review'))
);

CREATE TABLE IF NOT EXISTS retrieval_documents (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    jurisdiction TEXT NOT NULL,
    module TEXT NOT NULL,
    title TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    effective_date TEXT,
    last_crawled TEXT NOT NULL,
    last_verified TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'archived', 'needs_review'))
);

CREATE TABLE IF NOT EXISTS retrieval_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES retrieval_documents(id),
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    citation_payload TEXT NOT NULL,
    embedding_model TEXT,
    embedding_vector TEXT,
    UNIQUE(document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    mode TEXT NOT NULL CHECK (mode IN ('scheduled', 'manual', 'webhook')),
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'completed_with_review')),
    summary TEXT
);

