# OneStep AI CRM Integration Notes

Historical Phase 1 notes below are superseded by version 0.2.0. Use [current agent integration](../docs/AGENT_INTEGRATION.md) and [Render deployment runbook](../docs/RENDER_RUNBOOK.md). The old ephemeral database path and unauthenticated endpoint examples below must not be used for deployment.

Engine repository: `paultranofficial/lotus-global-immigration`. The separately hosted CRM backend still needs the adapter installed.

## Deployment Model

Recommended structure:

```text
onestep-ai-crm/
  intelligence-engine/
    src/onestep_engine/
    migrations/
    seeds/
    tests/
    requirements.txt
    pyproject.toml
  render.yaml
```

Render Blueprint should add a Python web service:

```yaml
services:
  - type: web
    name: onestep-intelligence-engine
    runtime: python
    plan: starter
    rootDir: intelligence-engine
    buildCommand: "pip install -r requirements.txt && pip install -e ."
    startCommand: "uvicorn onestep_engine.api:app --host 0.0.0.0 --port $PORT"
    healthCheckPath: /health
    envVars:
      - key: PYTHON_VERSION
        value: 3.12.7
      - key: ONESTEP_ENGINE_DB
        value: /opt/render/project/src/work/onestep_engine.sqlite
```

## Agent-Facing Endpoints

The website or CRM agent can call:

- `GET /health`
- `GET /v1/countries`
- `GET /v1/sources?jurisdiction=AU`
- `GET /v1/policy/export?jurisdiction=UK&module=finance`
- `GET /v1/rules/evaluate?jurisdiction=UK&applicant_scope=student_visa_primary&as_of=2026-10-01`
- `POST /v1/agents/context`

Example `POST /v1/agents/context`:

```json
{
  "jurisdictions": ["AU", "UK", "CA"],
  "applicant_scope": "student_visa_primary",
  "module": "finance",
  "as_of": "2026-10-01"
}
```

## Website/CRM Environment Variable

Add this to the OneStep website or CRM service:

```text
ONESTEP_INTELLIGENCE_ENGINE_URL=https://<render-service>.onrender.com
```

Agents should treat the engine response as grounded context. Any advice shown to users should include citations from `citation.url` or `provenance.source_url`.

## Important Production Note

The current Phase 1 service initializes SQLite on startup. This is fine for a first Render service and deterministic seed data. For production policy review workflows, move the DB to Postgres and preserve immutable case snapshots.
