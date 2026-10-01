# OneStep Education & Migration Intelligence Engine

This repository implements the first production-shaped foundation for the OneStep study-abroad intelligence platform.

It combines:

- a versioned structured knowledge base;
- policy rules with `effective_from`, `effective_to`, `jurisdiction`, applicant scope, source authority and verification metadata;
- provenance-first citations;
- migration scripts and seed data;
- a small rule engine that evaluates time-sensitive policy without hard-coding policy values;
- API contracts for the AI Lead Agent, Profile Analysis Agent, Proposal Agent and Case Management Agent.

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

Run tests:

```bash
python3 -m unittest discover -s tests
```

Initialize a local SQLite database from migrations and seeds:

```bash
python3 -m onestep_engine.cli init-db work/onestep_engine.sqlite
```

Evaluate matching rules:

```bash
python3 -m onestep_engine.cli evaluate work/onestep_engine.sqlite AU student_visa_primary 2026-10-01
```

Optional API server, if FastAPI is installed:

```bash
python3 -m onestep_engine.api
```

## Render Deployment

This repo includes `render.yaml`. In Render, create a Blueprint from the GitHub repository. Render will run:

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
- `GET /v1/policy/export?jurisdiction=UK&module=finance`
- `GET /v1/rules/evaluate?jurisdiction=UK&applicant_scope=student_visa_primary&as_of=2026-10-01`
- `POST /v1/agents/context`

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
