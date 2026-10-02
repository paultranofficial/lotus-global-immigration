import json
from datetime import date

from .retrieval import approve_document, store_document
from .service import publish_knowledge, publish_rule, save_evidence


def seed_reviewed_knowledge(conn):
    from .db import load_seed_json
    legacy = {r['id']: r for r in load_seed_json('policy_rules.json')}
    for spec in load_seed_json('reviewed_knowledge.json'):
        table = 'knowledge_records' if spec.get('kind') == 'knowledge' else 'policy_rules'
        if conn.execute(f'SELECT 1 FROM {table} WHERE id = ?', (spec['id'],)).fetchone():
            continue
        rule = dict(legacy.get(spec.get('seed_rule_id'), {}))
        for key in ('id', 'source_id', 'module', 'applicant_scope', 'rule_type', 'title', 'payload', 'effective_from', 'effective_to', 'effective_date_basis'):
            if key in spec:
                rule[key] = spec[key]
        source = dict(conn.execute('SELECT * FROM sources WHERE id = ?', (rule['source_id'],)).fetchone())
        rule.update(jurisdiction=source['jurisdiction'], source_url=source['url'], last_verified='2026-10-02', confidence=0.95)
        rule['effective_date_basis'] = spec.get('effective_date_basis', 'observed_from')
        rule['effective_from'] = spec.get('effective_from', '2026-10-02')
        rule['effective_to'] = spec.get('effective_to')
        rule.pop('status', None)
        rule['rule_key'] = ':'.join(rule[k] for k in ('jurisdiction', 'applicant_scope', 'module', 'rule_type'))
        if table == 'knowledge_records':
            rule['rule_key'] += ':' + rule['id'].rsplit('-2026-', 1)[0]
        doc = store_document(conn, source, rule['module'], spec['summary'], 'seed-review-2026-10-02', 'reviewed_summary')
        # These are explicitly labelled reviewed summaries, not downloaded full pages.
        conn.execute("UPDATE retrieval_documents SET title = ?, content_kind = 'reviewed_summary' WHERE id = ?",
                     ('Reviewed summary: ' + source['title'], doc['id']))
        approve_document(conn, doc['id'], date.fromisoformat(rule['effective_from']),
                         date.fromisoformat(rule['effective_to']) if rule['effective_to'] else None, 'seed-editor')
        if doc.get('change_id'):
            conn.execute("UPDATE policy_changes SET status = 'verified', last_verified = ? WHERE id = ?", ('2026-10-02', doc['change_id']))
        rule['evidence_id'] = save_evidence(conn, source['id'], spec['summary'], date(2026, 10, 2),
                                          'seed-editor', doc['id'], method='official_page_reviewed_summary')
        if table == 'knowledge_records':
            publish_knowledge(conn, rule, 'seed-editor')
        else:
            publish_rule(conn, rule, 'seed-editor')
        conn.execute('INSERT OR IGNORE INTO source_targets(id, source_id, module) VALUES (?, ?, ?)',
                     (source['id'] + ':' + rule['module'], source['id'], rule['module']))
