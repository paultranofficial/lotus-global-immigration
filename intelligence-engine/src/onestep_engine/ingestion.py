from __future__ import annotations

from datetime import datetime, timedelta, timezone
from io import BytesIO
import ipaddress
import json
import socket
from urllib.parse import urljoin, urlparse
import uuid

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader

from .retrieval import store_document
from .service import encoded, now


MAX_BYTES = 2_000_000


def validate_url(url: str, hostname: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname != hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError('fetch must remain on the registered HTTPS authority host')
    addresses = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise ValueError('source must resolve only to public addresses')


def fetch_source(url: str) -> tuple[bytes, str]:
    host = urlparse(url).hostname
    if not host:
        raise ValueError('invalid registered URL')
    with httpx.Client(timeout=15, follow_redirects=False, trust_env=False,
                      headers={'User-Agent': 'OneStepPolicyMonitor/0.2 (official-source verification)'}) as client:
        for _ in range(4):
            validate_url(url, host)
            with client.stream('GET', url) as response:
                if response.is_redirect:
                    url = urljoin(url, response.headers.get('location', ''))
                    continue
                response.raise_for_status()
                content_type = response.headers.get('content-type', '').lower()
                if not any(kind in content_type for kind in ('text/html', 'text/plain', 'application/pdf')):
                    raise ValueError('unsupported source content type')
                data = bytearray()
                for part in response.iter_bytes():
                    data.extend(part)
                    if len(data) > MAX_BYTES:
                        raise ValueError('source exceeds download limit')
                return bytes(data), content_type
    raise ValueError('redirect limit exceeded')


def extract_text(content: bytes, content_type: str) -> str:
    if 'application/pdf' in content_type:
        reader = PdfReader(BytesIO(content))
        if len(reader.pages) > 100:
            raise ValueError('PDF exceeds page limit')
        text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    elif 'text/html' in content_type:
        soup = BeautifulSoup(content, 'html.parser')
        for item in soup(['script', 'style', 'nav', 'header', 'footer', 'noscript', 'form']):
            item.decompose()
        main = soup.find('main') or soup.find('article') or soup
        text = main.get_text('\n', strip=True)
    else:
        text = content.decode('utf-8', errors='replace')
    text = '\n'.join(' '.join(line.split()) for line in text.splitlines() if line.strip())
    if len(text) < 100 or len(text) > MAX_BYTES:
        raise ValueError('empty, blocked or oversized extracted source')
    return text


def ingest(conn, source_ids: list[str] | None = None, mode: str = 'manual', limit: int = 3,
           fetcher=fetch_source) -> dict:
    targets = conn.execute('''SELECT t.*, s.title, s.authority, s.jurisdiction, s.url
        FROM source_targets t JOIN sources s ON s.id = t.source_id
        WHERE t.enabled = 1 AND s.status = 'active' ORDER BY COALESCE(t.last_attempt, ''), t.id''').fetchall()
    selected = []
    instant = datetime.now(timezone.utc)
    for target in targets:
        if source_ids is not None and target['source_id'] not in source_ids:
            continue
        if mode == 'scheduled' and target['last_attempt'] and instant - datetime.fromisoformat(target['last_attempt']) < timedelta(hours=target['interval_hours']):
            continue
        selected.append(target)
        if len(selected) >= limit:
            break
    if not selected:
        return {'status': 'no_due_targets', 'documents': [], 'errors': []}
    run_id = str(uuid.uuid4())
    conn.execute('INSERT INTO ingestion_runs(id, started_at, mode, status) VALUES (?, ?, ?, ?)',
                 (run_id, now(), mode, 'running'))
    conn.commit()
    documents, errors = [], []
    for target in selected:
        try:
            content, kind = fetcher(target['url'])
            text = extract_text(content, kind)
            with conn:
                documents.append(store_document(conn, {**dict(target), 'id': target['source_id']}, target['module'], text, run_id))
        except Exception as exc:
            errors.append({'source_id': target['source_id'], 'error_type': type(exc).__name__, 'message': str(exc)[:300]})
        with conn:
            conn.execute('UPDATE source_targets SET last_attempt = ? WHERE id = ?', (now(), target['id']))
    status = 'failed' if errors and not documents else ('completed_with_review' if any(d['changed'] for d in documents) or errors else 'completed')
    result = {'id': run_id, 'status': status, 'documents': documents, 'errors': errors}
    with conn:
        conn.execute('UPDATE ingestion_runs SET finished_at = ?, status = ?, summary = ? WHERE id = ?',
                     (now(), status, encoded(result), run_id))
    return result


def freshness(conn) -> dict:
    sources = conn.execute('''SELECT s.id, s.jurisdiction, s.authority,
        (SELECT MAX(e.observed_at) FROM evidence e WHERE e.source_id = s.id) AS last_verified,
        MAX(t.last_attempt) AS last_attempt, MAX(d.last_crawled) AS last_crawled,
        COUNT(DISTINCT CASE WHEN d.status = 'needs_review' THEN d.id END) AS pending_documents
        FROM sources s LEFT JOIN source_targets t ON t.source_id = s.id
        LEFT JOIN retrieval_documents d ON d.source_id = s.id
        GROUP BY s.id ORDER BY s.jurisdiction, s.id''').fetchall()
    count = conn.execute("SELECT COUNT(*) FROM policy_rules WHERE evidence_id IS NOT NULL AND reviewed_by IS NOT NULL AND status = 'active'").fetchone()[0]
    total = conn.execute('SELECT COUNT(*) FROM policy_rules').fetchone()[0]
    return {'sources': [dict(s) for s in sources], 'rules_total': total, 'reviewed_active_rules': count,
            'ingestion_runs': [dict(r) for r in conn.execute('SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT 10')]}
