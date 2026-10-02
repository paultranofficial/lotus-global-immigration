from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import date
import hmac
import json
import os
from pathlib import Path
import sqlite3

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Security
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader

from .contracts import (ContextRequest, DecisionRequest, DocumentReview, EvidenceRequest,
                        IngestionRequest, KnowledgeVersion, Market, Module, ProfileRequest, RuleVersion, RetirementRequest,
                        ContextResponse, LeadResponse, MarketContextResponse, ProfileResponse, SnapshotResponse)
from .db import apply_migrations, connect, list_countries, list_sources, seed_database
from .ingestion import freshness, ingest
from .retrieval import approve_document, search
from .service import (analyse_profile, audit, catalogue, context, proposal, publish_knowledge,
                      publish_rule, save_evidence, snapshot, snapshot_alerts)


def create_app(db_path: str | Path | None = None, api_key: str | None = None,
               admin_key: str | None = None, schedule: bool | None = None) -> FastAPI:
    path = Path(db_path or os.environ.get('ONESTEP_ENGINE_DB', 'work/onestep_engine.sqlite'))
    read_token = api_key if api_key is not None else os.environ.get('ONESTEP_ENGINE_API_KEY', '')
    admin_token = admin_key if admin_key is not None else os.environ.get('ONESTEP_ENGINE_ADMIN_KEY', '')
    scheduling = schedule if schedule is not None else os.environ.get('ONESTEP_ENGINE_INGESTION_ENABLED', 'false').lower() == 'true'
    actor = os.environ.get('ONESTEP_ENGINE_REVIEWER', 'policy-reviewer')
    key_header = APIKeyHeader(name='X-API-Key', auto_error=False)

    def authorized(key: str | None = Security(key_header)) -> str:
        if not read_token or not admin_token:
            raise HTTPException(503, 'Engine API credentials are not configured')
        if key and hmac.compare_digest(key, admin_token):
            return actor
        if key and hmac.compare_digest(key, read_token):
            return 'onestep-agent'
        raise HTTPException(401, 'Invalid API key')

    def reviewer(key: str | None = Security(key_header)) -> str:
        if not admin_token:
            raise HTTPException(503, 'Reviewer credentials are not configured')
        if key and hmac.compare_digest(key, admin_token):
            return actor
        raise HTTPException(403, 'Reviewer key required')

    def database():
        conn = connect(path)
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def run_scheduled():
        conn = connect(path)
        try:
            ingest(conn, mode='scheduled', limit=1)
        finally:
            conn.close()

    async def monitor(stop: asyncio.Event):
        while not stop.is_set():
            await asyncio.to_thread(run_scheduled)
            try:
                await asyncio.wait_for(stop.wait(), timeout=60)
            except TimeoutError:
                pass

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = connect(path)
        try:
            apply_migrations(conn)
            seed_database(conn)
        finally:
            conn.close()
        stop = asyncio.Event()
        task = asyncio.create_task(monitor(stop)) if scheduling else None
        try:
            yield
        finally:
            stop.set()
            if task:
                await task

    app = FastAPI(title='OneStep Education & Migration Intelligence Engine', version='0.2.0',
                  lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    router = APIRouter(dependencies=[Depends(authorized)])

    @app.exception_handler(ValueError)
    async def invalid_request(request, exc):
        return JSONResponse(status_code=422, content={'detail': str(exc)})

    @app.exception_handler(LookupError)
    async def missing_record(request, exc):
        return JSONResponse(status_code=404, content={'detail': str(exc)})

    @app.exception_handler(sqlite3.IntegrityError)
    async def integrity_error(request, exc):
        return JSONResponse(status_code=409, content={'detail': 'Record conflicts with stored version or references'})

    @app.get('/health', include_in_schema=False)
    def health():
        conn = connect(path)
        try:
            conn.execute('SELECT 1 FROM schema_migrations LIMIT 1')
            return {'status': 'ok', 'version': app.version}
        finally:
            conn.close()

    @router.get('/v1/openapi.json')
    def contract():
        return app.openapi()

    @router.get('/v1/countries')
    def countries(conn=Depends(database)):
        return {'countries': list_countries(conn)}

    @router.get('/v1/sources')
    def sources(jurisdiction: Market | None = None, conn=Depends(database)):
        return {'sources': list_sources(conn, jurisdiction=jurisdiction.value if jurisdiction else None)}

    @router.get('/v1/rules/evaluate', response_model=MarketContextResponse)
    def evaluate(jurisdiction: Market, applicant_scope: str, as_of: date,
                 module: Module | None = None, conn=Depends(database)):
        return context(conn, [jurisdiction.value], applicant_scope, as_of, module.value if module else None)['results'][0]

    @router.get('/v1/policy/export', response_model=ContextResponse)
    def policy_export(as_of: date, applicant_scope: str, jurisdiction: Market | None = None,
                      module: Module | None = None, conn=Depends(database)):
        return context(conn, [jurisdiction.value] if jurisdiction else [m.value for m in Market],
                       applicant_scope, as_of, module.value if module else None)

    @router.post('/v1/agents/context', response_model=ContextResponse)
    def agent_context(request: ContextRequest, conn=Depends(database)):
        return context(conn, **request.model_dump())

    @router.post('/v1/agents/profile-analysis', response_model=ProfileResponse)
    def profile_analysis(request: ProfileRequest, conn=Depends(database)):
        return analyse_profile(conn, **request.model_dump())

    @router.post('/v1/agents/proposal', response_model=ProfileResponse)
    def agent_proposal(request: ProfileRequest, conn=Depends(database)):
        return proposal(conn, **request.model_dump())

    @router.post('/v1/agents/lead', response_model=LeadResponse)
    def lead(request: ProfileRequest, conn=Depends(database)):
        result = analyse_profile(conn, **request.model_dump())
        return {'analysis': result, 'next_action': 'collect_profile' if result['missing_profile_fields'] else 'advisor_review',
                'proposal': proposal(conn, **request.model_dump())}

    @router.get('/v1/retrieval/search')
    def retrieval(q: str = Query(min_length=1, max_length=500), as_of: date = Query(),
                  jurisdiction: Market | None = None, module: Module | None = None,
                  limit: int = Query(default=8, ge=1, le=30), conn=Depends(database)):
        return {'results': search(conn, q, as_of, jurisdiction.value if jurisdiction else None,
                                  module.value if module else None, limit), 'method': 'fts5_bm25'}

    @router.get('/v1/catalogue/{module}')
    def knowledge(module: Module, as_of: date, jurisdiction: Market | None = None, conn=Depends(database)):
        return {'records': catalogue(conn, module.value, as_of, jurisdiction.value if jurisdiction else None)}

    @router.post('/v1/cases/{case_id}/policy-snapshot', status_code=201, response_model=SnapshotResponse)
    def freeze(case_id: str, request: ContextRequest, actor=Depends(authorized), conn=Depends(database)):
        if len(case_id) > 200:
            raise ValueError('case_id exceeds 200 characters')
        return snapshot(conn, case_id, request.model_dump(), actor)

    def read_snapshot(conn, case_id, snapshot_id):
        row = conn.execute('SELECT * FROM case_snapshots WHERE case_id = ? AND id = ?', (case_id, snapshot_id)).fetchone()
        if not row:
            raise LookupError('snapshot not found')
        return {**dict(row), 'payload': json.loads(row['payload'])}

    @router.get('/v1/cases/{case_id}/policy-snapshots/{snapshot_id}', response_model=SnapshotResponse)
    def saved_snapshot(case_id: str, snapshot_id: str, conn=Depends(database)):
        return read_snapshot(conn, case_id, snapshot_id)

    @router.get('/v1/cases/{case_id}/policy-snapshots/{snapshot_id}/alerts')
    def alerts(case_id: str, snapshot_id: str, as_of: date, conn=Depends(database)):
        return {'alerts': snapshot_alerts(conn, read_snapshot(conn, case_id, snapshot_id), as_of)}

    @router.get('/v1/freshness')
    def source_freshness(conn=Depends(database)):
        return freshness(conn)

    @router.post('/v1/admin/evidence', status_code=201, dependencies=[Depends(reviewer)])
    def evidence(request: EvidenceRequest, actor=Depends(reviewer), conn=Depends(database)):
        return {'id': save_evidence(conn, actor=actor, **request.model_dump())}

    @router.post('/v1/admin/rules', status_code=201, dependencies=[Depends(reviewer)])
    def publish(request: RuleVersion, actor=Depends(reviewer), conn=Depends(database)):
        return publish_rule(conn, request.model_dump(), actor)

    @router.post('/v1/admin/knowledge', status_code=201, dependencies=[Depends(reviewer)])
    def publish_record(request: KnowledgeVersion, actor=Depends(reviewer), conn=Depends(database)):
        return publish_knowledge(conn, request.model_dump(), actor)

    @router.post('/v1/admin/rules/{rule_id}/retire', dependencies=[Depends(reviewer)])
    def retire(rule_id: str, request: RetirementRequest, actor=Depends(reviewer), conn=Depends(database)):
        if not conn.execute('SELECT 1 FROM policy_rules WHERE id = ?', (rule_id,)).fetchone():
            raise LookupError('rule not found')
        conn.execute("UPDATE policy_rules SET status = 'archived' WHERE id = ?", (rule_id,))
        audit(conn, 'rule.retire', rule_id, actor, request.model_dump())
        return {'id': rule_id, 'status': 'archived'}

    @router.post('/v1/admin/knowledge/{record_id}/retire', dependencies=[Depends(reviewer)])
    def retire_record(record_id: str, request: RetirementRequest, actor=Depends(reviewer), conn=Depends(database)):
        if not conn.execute('SELECT 1 FROM knowledge_records WHERE id = ?', (record_id,)).fetchone():
            raise LookupError('knowledge record not found')
        conn.execute("UPDATE knowledge_records SET status = 'archived' WHERE id = ?", (record_id,))
        audit(conn, 'knowledge.retire', record_id, actor, request.model_dump())
        return {'id': record_id, 'status': 'archived'}

    @router.post('/v1/admin/ingestion', dependencies=[Depends(reviewer)])
    def crawl(request: IngestionRequest, conn=Depends(database)):
        registered = {s['id'] for s in list_sources(conn)}
        if set(request.source_ids) - registered:
            raise ValueError('unknown source ID')
        return ingest(conn, request.source_ids)

    @router.get('/v1/admin/documents', dependencies=[Depends(reviewer)])
    def documents(conn=Depends(database)):
        return {'documents': [dict(r) for r in conn.execute('''SELECT id, source_id, module, title,
            canonical_url, content_hash, last_crawled, status FROM retrieval_documents
            ORDER BY last_crawled DESC LIMIT 200''')]}

    @router.get('/v1/admin/documents/{document_id}', dependencies=[Depends(reviewer)])
    def document(document_id: str, conn=Depends(database)):
        row = conn.execute('SELECT * FROM retrieval_documents WHERE id = ?', (document_id,)).fetchone()
        if not row:
            raise LookupError('document not found')
        return dict(row)

    @router.post('/v1/admin/documents/{document_id}/approve', dependencies=[Depends(reviewer)])
    def approve(document_id: str, request: DocumentReview, actor=Depends(reviewer), conn=Depends(database)):
        return approve_document(conn, document_id, actor=actor, **request.model_dump())

    @router.get('/v1/admin/policy-changes', dependencies=[Depends(reviewer)])
    def changes(conn=Depends(database)):
        return {'changes': [dict(r) for r in conn.execute('SELECT * FROM policy_changes ORDER BY rowid DESC LIMIT 200')]}

    @router.post('/v1/admin/policy-changes/{change_id}/review', dependencies=[Depends(reviewer)])
    def review(change_id: str, request: DecisionRequest, actor=Depends(reviewer), conn=Depends(database)):
        row = conn.execute('SELECT status FROM policy_changes WHERE id = ?', (change_id,)).fetchone()
        if not row:
            raise LookupError('change not found')
        if row['status'] in ('verified', 'rejected'):
            raise ValueError('change already reviewed')
        conn.execute('UPDATE policy_changes SET status = ?, last_verified = ? WHERE id = ?',
                     (request.status, date.today().isoformat(), change_id))
        audit(conn, 'change.review', change_id, actor, request.model_dump())
        return {'id': change_id, 'status': request.status}

    @router.get('/v1/admin/draft-context', dependencies=[Depends(reviewer)])
    def draft(jurisdiction: Market, applicant_scope: str, as_of: date, conn=Depends(database)):
        return context(conn, [jurisdiction.value], applicant_scope, as_of, include_unreviewed=True)

    @router.get('/v1/admin/audit', dependencies=[Depends(reviewer)])
    def events(conn=Depends(database)):
        return {'events': [dict(r) for r in conn.execute('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 200')]}

    app.include_router(router)
    return app


app = create_app()


def main():
    import uvicorn
    uvicorn.run('onestep_engine.api:app', host='127.0.0.1', port=8787)


if __name__ == '__main__':
    main()
