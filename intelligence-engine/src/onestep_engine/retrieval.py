from datetime import date, timedelta
import json
import re
import sqlite3
import uuid

from .service import audit, digest, encoded, now


def store_document(conn, source: dict, module: str, text: str, run_id: str, content_kind: str = 'live_page') -> dict:
    content_hash = digest(text)
    existing = conn.execute('''SELECT id, content_hash FROM retrieval_documents
        WHERE source_id = ? AND module = ? AND content_kind = ?
        ORDER BY last_crawled DESC, rowid DESC LIMIT 1''', (source['id'], module, content_kind)).fetchone()
    if existing and existing['content_hash'] == content_hash:
        conn.execute('UPDATE retrieval_documents SET last_crawled = ? WHERE id = ?', (now(), existing['id']))
        return {'id': existing['id'], 'changed': False}
    document_id = str(uuid.uuid4())
    conn.execute('''INSERT INTO retrieval_documents
        (id, source_id, jurisdiction, module, title, canonical_url, content_hash,
         extracted_text, last_crawled, last_verified, status, content_kind)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'needs_review', ?)''',
        (document_id, source['id'], source['jurisdiction'], module, source['title'], source['url'],
         content_hash, text, now(), '', content_kind))
    # Paragraph-aware chunks preserve citation offsets in normalized source text.
    position, chunk_index = 0, 0
    while position < len(text):
        stop = min(position + 1600, len(text))
        if stop < len(text):
            boundary = text.rfind('\n', position + 800, stop)
            if boundary > position:
                stop = boundary
        citation = {'source_id': source['id'], 'authority': source['authority'], 'url': source['url'],
                    'document_id': document_id, 'content_hash': content_hash,
                    'start_offset': position, 'end_offset': stop}
        conn.execute('''INSERT INTO retrieval_chunks(id, document_id, chunk_index, text, citation_payload)
                        VALUES (?, ?, ?, ?, ?)''',
                     (str(uuid.uuid4()), document_id, chunk_index, text[position:stop], encoded(citation)))
        position, chunk_index = stop, chunk_index + 1
    change_id = str(uuid.uuid4())
    conn.execute('''INSERT INTO policy_changes
        (id, jurisdiction, module, title, summary, change_type, source_id, source_url,
         ingestion_run_id, last_verified, status)
        VALUES (?, ?, ?, ?, ?, 'clarification', ?, ?, ?, ?, 'needs_human_review')''',
        (change_id, source['jurisdiction'], module, source['title'],
         'Source content changed or first observed. Review document ' + document_id + '; legal change not yet established.',
         source['id'], source['url'], run_id, ''))
    audit(conn, 'document.ingest', document_id, 'ingestion', {'content_hash': content_hash, 'change_id': change_id})
    return {'id': document_id, 'changed': True, 'change_id': change_id}


def approve_document(conn, document_id: str, effective_from: date, effective_to: date | None, actor: str) -> dict:
    doc = conn.execute('SELECT * FROM retrieval_documents WHERE id = ?', (document_id,)).fetchone()
    if not doc:
        raise LookupError('document not found')
    if doc['reviewed_by']:
        raise ValueError('document version already reviewed')
    older = conn.execute('''SELECT * FROM retrieval_documents WHERE source_id = ? AND module = ?
                           AND content_kind = ? AND reviewed_by IS NOT NULL''',
                         (doc['source_id'], doc['module'], doc['content_kind'])).fetchall()
    start = effective_from.isoformat()
    for old in older:
        if old['effective_date'] >= start:
            raise ValueError('document effective_from must follow earlier approved versions')
        if old['effective_to'] is None or old['effective_to'] >= start:
            boundary = (effective_from - timedelta(days=1)).isoformat()
            conn.execute("UPDATE retrieval_documents SET effective_to = ?, status = 'archived' WHERE id = ?", (boundary, old['id']))
    conn.execute('''UPDATE retrieval_documents SET effective_date = ?, effective_to = ?,
                    reviewed_by = ?, last_verified = ?, status = 'active' WHERE id = ?''',
                 (start, effective_to.isoformat() if effective_to else None, actor, date.today().isoformat(), document_id))
    audit(conn, 'document.approve', document_id, actor, {'effective_from': start})
    return {'id': document_id, 'status': 'active'}


def search(conn, query: str, as_of: date, jurisdiction: str | None = None,
           module: str | None = None, limit: int = 8) -> list[dict]:
    terms = re.findall(r'\w+', query, re.UNICODE)[:20]
    if not terms:
        return []
    fts_query = ' OR '.join('"' + term + '"' for term in terms)
    rows = conn.execute('''SELECT c.id AS chunk_id, c.text, c.citation_payload,
        d.title, d.last_verified, d.effective_date, d.effective_to, s.reliability_tier,
        bm25(chunk_search) AS score
        FROM chunk_search JOIN retrieval_chunks c ON c.id = chunk_search.chunk_id
        JOIN retrieval_documents d ON d.id = c.document_id JOIN sources s ON s.id = d.source_id
        WHERE chunk_search MATCH ? AND d.status IN ('active', 'archived') AND s.status = 'active'
        AND d.reviewed_by IS NOT NULL AND d.effective_date <= ?
        AND (d.effective_to IS NULL OR d.effective_to >= ?)
        AND (? IS NULL OR d.jurisdiction = ?) AND (? IS NULL OR d.module = ?)
        ORDER BY s.reliability_tier, score, d.last_verified DESC LIMIT ?''',
        (fts_query, as_of.isoformat(), as_of.isoformat(), jurisdiction, jurisdiction, module, module, limit)).fetchall()
    return [{'chunk_id': r['chunk_id'], 'text': r['text'], 'title': r['title'],
             'citation': {**json.loads(r['citation_payload']), 'last_verified': r['last_verified'],
                          'effective_from': r['effective_date'], 'effective_to': r['effective_to']},
             'retrieval_method': 'fts5_bm25', 'trust': 'untrusted_source_text'} for r in rows]
