# Render deployment and storage

Root `render.yaml` defines the existing static website and a separate Python engine. The engine uses a persistent disk mounted at `/var/data`, generated read/reviewer API keys, one Uvicorn process and daily source targets polled once per minute. No credentials are committed.

References: [Blueprint specification](https://render.com/docs/blueprint-spec), [persistent disks](https://render.com/docs/disks).

## Deploy

1. Merge the foundation PR, then the retrieval/agent PR. If the second PR is still stacked, retarget it to `main` after merging the foundation.
2. Sign in to Render and create or sync a Blueprint from `paultranofficial/lotus-global-immigration`, branch `main`, root `render.yaml`.
3. Review Render's quoted compute/disk charges before provisioning the paid service. This repository configures resources but does not itself purchase them.
4. Confirm the build succeeds and the public `/health` endpoint returns version `0.2.0`.
5. Obtain the engine read key from its Environment panel and place it only in the CRM server's environment. Keep the reviewer key with policy editors. For an existing Blueprint, check that new secret variables were created during sync.
6. Query `/v1/countries`, `/v1/freshness`, and the UK Graduate boundary with authentication. Confirm a write endpoint rejects the read key.

The actual service URL is assigned by Render. No live deployment URL has been verified yet. Browser access currently reaches Render's sign-in screen.

## Persistent state

`ONESTEP_ENGINE_DB=/var/data/onestep_engine.sqlite`. Only mounted-disk paths persist across restarts/redeploys. The previous path under the source checkout was ephemeral.

Startup applies only unapplied migrations and checks their hashes. Seeds insert missing records and never overwrite published or retired versions. Editing an applied SQL migration causes startup to fail; create the next numbered migration instead.

SQLite WAL is appropriate for this single-instance service. Do not add multiple workers/instances or an independent cron service sharing the file. The built-in scheduler runs in this web service, processing one due registered target per minute. Each target has a 24-hour interval; failures stay visible in ingestion runs. A deploy interruption can leave a running ingestion record, requiring operator inspection before retry.

## Backup and restore

Use the SQLite backup API, not a copy of a live WAL database:

```bash
python -m onestep_engine.cli backup /var/data/onestep_engine.sqlite /var/data/onestep-backup-2026-10-02.sqlite
```

Transfer backups to the organization's approved backup storage. Render disk snapshots are supplementary. For recovery, stop the service, preserve the current database and its WAL/SHM files, restore the selected consistent backup, then start and verify migrations, source counts and a known case snapshot hash. Never restore while the process is writing.

For a bad policy, call `/v1/admin/rules/{id}/retire` with an explanation, then publish a corrected new version with reviewed evidence. This keeps the audit trail and original case snapshots. Code rollbacks must remain compatible with the current schema; do not roll back the database merely to deploy an older binary.

## Local development

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[api,dev]'
export ONESTEP_ENGINE_API_KEY=local-reader-example
export ONESTEP_ENGINE_ADMIN_KEY=local-reviewer-example
.venv/bin/uvicorn onestep_engine.api:app --host 127.0.0.1 --port 8787
```

The displayed local keys are examples only. API keys are mandatory for data endpoints; `/health` is public. CORS is not enabled because the website's CRM server calls the engine.

Before production scale-out, migrate to PostgreSQL and add independent ingestion workers, per-client identities, review UI, rate controls and semantic embeddings. Those are documented next steps, not implemented Render resources.
