# Implementation Phase Plan

## Phase 1 - Foundation

Delivered in this workspace:

- core database schema;
- source hierarchy;
- country taxonomy;
- versioned policy rule table;
- seed data for priority markets;
- deterministic rule lookup;
- conflict detection;
- OpenAPI contract;
- operations documentation;
- unit tests.

## Phase 2 - Retrieval Layer

Implemented:

- registered-source HTTPS fetching and target scheduling;
- HTML/PDF extraction;
- document chunking;
- SQLite FTS5/BM25 lexical retrieval;
- citation span support;
- ingestion review queue.

Pending: authority-specific extraction refinements, semantic embeddings, production monitoring and a dedicated review interface.

## Phase 3 - Agent APIs

Implemented:

- Profile Analysis Agent endpoint implementation;
- Proposal Agent endpoint implementation;
- Case Management Agent policy snapshots;
- cited evidence checklist and missing profile fields;
- AI Lead Agent context orchestration;
- immutable snapshots and policy update alerts;
- tested server adapter for the existing Vietnamese CRM intake.

Pending: integrate the adapter into the separately hosted CRM backend and connect its own LLM agents. Unsupported eligibility/ranking/cost outputs remain explicit unknowns.

## Phase 4 - Institution and Program Intelligence

Versioned catalogue publication and lookup are implemented, with Aalto institution/program/admission/scholarship and DAAD EPOS seeds. Bulk official registry ingestion is pending.

Add:

- institution registry ingestion;
- program catalog ingestion;
- admissions normalization;
- scholarship tracker;
- tuition and intake versioning.

## Phase 5 - Production Controls

Implemented: separate agent/reviewer keys, evidence checks, policy/document review, audit events, freshness API, immutable case snapshots, persistent Render disk and backup command. Individual identity/role management, monitoring alerts and scale-out PostgreSQL remain pending.

Add:

- reviewer roles;
- policy approval workflow;
- audit logs;
- monitoring and alerting;
- source freshness dashboards;
- rollback tools for bad policy promotions.
