# OneStep Education & Migration Intelligence Engine

This repository implements the OneStep study-abroad intelligence service, version 0.2.0. It provides versioned cited policies, reviewed lexical retrieval, ingestion review, agent context and immutable case snapshots.

It combines:

- a versioned structured knowledge base;
- policy rules with `effective_from`, `effective_to`, `jurisdiction`, applicant scope, source authority and verification metadata;
- provenance-first citations;
- migration scripts and seed data;
- a small rule engine that evaluates time-sensitive policy without hard-coding policy values;
- API contracts for the AI Lead Agent, Profile Analysis Agent, Proposal Agent and Case Management Agent.

Current retained knowledge: 38 source entries, 12 reviewed policy versions, 5 reviewed catalogue records and 30 original drafts. See [coverage](docs/KNOWLEDGE_COVERAGE.md) for the precise limits. Regular agent endpoints exclude unreviewed drafts.

## Current Scope

Markets covered in seed taxonomy:

- Australia
- United States
- Canada
- Singapore
- Malaysia
- United Kingdom
- Europe priority countries: Germany, France, Netherlands, Finland, Ireland

## Quick Start

Install and run tests from this directory:

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[api,dev]'
.venv/bin/python -m unittest discover -s tests
node --test integration/onestep-client.test.mjs
```

Initialize a local SQLite database from migrations and seeds:

```bash
.venv/bin/python -m onestep_engine.cli init-db work/onestep_engine.sqlite
```

Evaluate matching rules:

```bash
.venv/bin/python -m onestep_engine.cli evaluate work/onestep_engine.sqlite AU student_visa_primary 2026-10-02
```

Local API server (keys shown are development examples):

```bash
export ONESTEP_ENGINE_API_KEY=local-reader-example
export ONESTEP_ENGINE_ADMIN_KEY=local-reviewer-example
.venv/bin/python -m onestep_engine.api
```

## Render Deployment

The repository root includes `render.yaml`, configuring a separate Python service and persistent disk. See [deployment](docs/RENDER_RUNBOOK.md) and confirm Render's charges before provisioning. Render will run:

```bash
pip install -r requirements.txt && pip install -e .
```

and start:

```bash
uvicorn onestep_engine.api:app --host 0.0.0.0 --port $PORT
```

Useful endpoints for OneStep AI agents:

- `GET /health`
- `GET /v1/countries`
- `GET /v1/sources?jurisdiction=AU`
- `GET /v1/policy/export?jurisdiction=UK&module=finance&applicant_scope=student_visa_primary&as_of=2026-10-02`
- `GET /v1/rules/evaluate?jurisdiction=UK&applicant_scope=student_visa_primary&as_of=2026-10-01`
- `POST /v1/agents/context`
- `POST /v1/agents/profile-analysis`
- `POST /v1/agents/proposal`
- `POST /v1/agents/lead`
- `GET /v1/retrieval/search`
- `POST /v1/cases/{case_id}/policy-snapshot`

Except `/health`, endpoints require `X-API-Key`. Reviewer writes require the separate admin key. Export requires `as_of` and `applicant_scope`. The generated contract is `api/openapi.yaml`; see [CRM integration](docs/AGENT_INTEGRATION.md).

Portable reviewed knowledge for AI import: [ONESTEP_REVIEWED_KNOWLEDGE.json](outputs/ONESTEP_REVIEWED_KNOWLEDGE.json). Filter the effective interval and applicant scope before using a fact.

## Important Operating Principle

Rules are data, not application code. Any rule that can change over time must be stored with:

- `effective_from`
- `effective_to`
- `jurisdiction`
- `applicant_scope`
- `source_id`
- `source_url`
- `last_verified`
- `confidence`
- `status`
- `evidence_id`, `reviewed_by`, `rule_key`, `effective_date_basis`

See [policy editor guide](docs/POLICY_EDITOR_GUIDE.md) for source review, dates, publication, predicates and corrections. Retrieval uses SQLite FTS5/BM25; semantic embeddings and comprehensive historical coverage have not yet been added. Agent endpoints supply grounded context to OneStep's own model; they do not run an LLM themselves.
