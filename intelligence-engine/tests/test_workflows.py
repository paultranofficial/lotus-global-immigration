import json
from pathlib import Path
import socket
import sqlite3
import sys
import tempfile
import unittest
from datetime import date
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

from fastapi.testclient import TestClient
from onestep_engine.api import create_app
from onestep_engine.db import apply_migrations, connect, seed_database
from onestep_engine.ingestion import extract_text, ingest, validate_url
from onestep_engine.predicates import assess_rule, evaluate
from onestep_engine.retrieval import approve_document, search
from onestep_engine.rules import find_applicable_rules
from onestep_engine.service import catalogue, publish_knowledge, publish_rule, save_evidence, snapshot, snapshot_alerts


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'engine.sqlite'
        self.conn = connect(self.path)
        apply_migrations(self.conn)
        seed_database(self.conn)

    def tearDown(self):
        self.conn.close()
        self.temp.cleanup()

    def rules(self, market='UK', scope='graduate_route_primary', as_of=date(2026, 12, 31)):
        return find_applicable_rules(self.conn, jurisdiction=market, applicant_scope=scope, as_of=as_of)

    def example_rule(self):
        source = self.conn.execute("SELECT * FROM sources WHERE id = 'uk-gov-student-visa-money'").fetchone()
        evidence_id = save_evidence(self.conn, source['id'], 'Synthetic reviewer test evidence, not a real financial rule.', date(2026, 10, 2), 'test-reviewer')
        return dict(id='test-finance-v1', rule_key='UK:test_scope:finance:test_amount', module='finance',
                    jurisdiction='UK', applicant_scope='test_scope', title='Synthetic financial condition',
                    rule_type='test_amount', payload={'predicate': {'field': 'budget', 'operator': 'gte', 'value': 100}},
                    effective_from='2026-10-02', effective_to=None, source_id=source['id'], source_url=source['url'],
                    evidence_id=evidence_id, last_verified='2026-10-02', confidence=0.95, effective_date_basis='observed_from')

    def test_migrations_and_seeds_are_idempotent_and_preserve_updates(self):
        before = self.conn.execute('SELECT COUNT(*) FROM evidence').fetchone()[0]
        self.conn.execute("UPDATE policy_rules SET status = 'archived' WHERE id = 'UK-FIN-OBSERVED-2026-10-02'")
        self.conn.commit()
        apply_migrations(self.conn)
        seed_database(self.conn)
        self.assertEqual(before, self.conn.execute('SELECT COUNT(*) FROM evidence').fetchone()[0])
        self.assertEqual('archived', self.conn.execute("SELECT status FROM policy_rules WHERE id = 'UK-FIN-OBSERVED-2026-10-02'").fetchone()[0])

    def test_upgrade_existing_phase_one_database(self):
        path = Path(self.temp.name) / 'old.sqlite'
        conn = connect(path)
        conn.executescript((Path(__file__).resolve().parents[1] / 'migrations/001_core_schema.sql').read_text())
        apply_migrations(conn)
        seed_database(conn)
        self.assertEqual(conn.execute('SELECT COUNT(*) FROM schema_migrations').fetchone()[0], 4)
        conn.close()

    def test_graduate_transition_on_exact_boundary(self):
        self.assertEqual(self.rules()[0].rule.payload['standard_duration_months'], 24)
        self.assertEqual(self.rules(as_of=date(2027, 1, 1))[0].rule.payload['standard_duration_months'], 18)
        self.assertEqual(len(self.rules()), 1)

    def test_unconfirmed_seed_excluded_by_default(self):
        self.assertEqual(self.rules('FR', 'student_visa_primary', date(2026, 10, 2)), [])
        drafts = find_applicable_rules(self.conn, jurisdiction='FR', applicant_scope='student_visa_primary',
                                       as_of=date(2026, 10, 2), include_unreviewed=True)
        self.assertTrue(drafts)
        self.assertTrue(all(m.rule.effective_date_basis == 'unconfirmed' for m in drafts))

    def test_seeded_retrieval_has_citation_and_temporal_filter(self):
        result = search(self.conn, 'Graduate visa duration', date(2026, 12, 31), 'UK', 'post-study')
        self.assertTrue(result)
        self.assertIn('31 December 2026', result[0]['text'])
        self.assertIn('content_hash', result[0]['citation'])
        later = search(self.conn, 'Graduate visa duration', date(2027, 1, 1), 'UK', 'post-study')
        self.assertTrue(all('from 1 January 2027' in r['text'] for r in later))

    def test_ingestion_hash_review_and_failures_are_separate_from_policy(self):
        text = b'<main><h1>New official source version</h1><p>' + b'Student maintenance test information. ' * 8 + b'</p></main>'
        fetcher = lambda url: (text, 'text/html')
        first = ingest(self.conn, ['uk-gov-student-visa-money'], fetcher=fetcher)
        self.assertEqual(first['status'], 'completed_with_review')
        doc_id = first['documents'][0]['id']
        self.assertTrue(all(r['citation']['document_id'] != doc_id for r in search(self.conn, 'New official', date(2026, 10, 2))))
        second = ingest(self.conn, ['uk-gov-student-visa-money'], fetcher=fetcher)
        self.assertFalse(second['documents'][0]['changed'])
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM retrieval_documents WHERE id = ?', (doc_id,)).fetchone()[0], 1)
        with self.conn:
            approve_document(self.conn, doc_id, date(2026, 10, 3), None, 'reviewer')
        results = search(self.conn, 'New official', date(2026, 10, 3))
        self.assertTrue(results)
        self.assertEqual(results[0]['citation']['document_id'], doc_id)
        failed = ingest(self.conn, ['uk-gov-student-visa-money'], fetcher=lambda url: (_ for _ in ()).throw(ValueError('blocked source')))
        self.assertEqual(failed['status'], 'failed')
        self.assertTrue(failed['errors'])

    def test_rule_versions_preserve_history_and_case_snapshot(self):
        first = self.example_rule()
        with self.conn:
            publish_rule(self.conn, first, 'test-reviewer')
            saved = snapshot(self.conn, 'synthetic-case', dict(jurisdictions=['UK'], applicant_scope='test_scope', as_of=date(2026, 10, 2)), 'agent')
        original_payload = self.conn.execute('SELECT payload FROM case_snapshots WHERE id = ?', (saved['id'],)).fetchone()[0]
        later = {**first, 'id': 'test-finance-v2', 'effective_from': '2026-10-03', 'payload': {'amount': 200}}
        with self.conn:
            publish_rule(self.conn, later, 'test-reviewer')
        historical = self.rules('UK', 'test_scope', date(2026, 10, 2))
        current = self.rules('UK', 'test_scope', date(2026, 10, 3))
        self.assertEqual(historical[0].rule.id, 'test-finance-v1')
        self.assertEqual(current[0].rule.id, 'test-finance-v2')
        self.assertTrue(snapshot_alerts(self.conn, saved, date(2026, 10, 3)))
        self.assertEqual(original_payload, self.conn.execute('SELECT payload FROM case_snapshots WHERE id = ?', (saved['id'],)).fetchone()[0])
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("UPDATE case_snapshots SET payload = '{}' WHERE id = ?", (saved['id'],))
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("UPDATE policy_rules SET payload = '{}' WHERE id = 'test-finance-v1'")

    def test_reverting_source_to_old_content_still_creates_a_review_alert(self):
        original = b'Original source body for reversion testing. ' * 6
        updated = b'Changed source body for reversion testing. ' * 6
        first = ingest(self.conn, ['uk-gov-student-visa-money'], fetcher=lambda url: (original, 'text/plain'))
        ingest(self.conn, ['uk-gov-student-visa-money'], fetcher=lambda url: (updated, 'text/plain'))
        reverted = ingest(self.conn, ['uk-gov-student-visa-money'], fetcher=lambda url: (original, 'text/plain'))
        self.assertTrue(reverted['documents'][0]['changed'])
        self.assertNotEqual(first['documents'][0]['id'], reverted['documents'][0]['id'])

    def test_catalogue_version_update_closes_old_interval(self):
        record = dict(self.conn.execute("SELECT * FROM knowledge_records WHERE module = 'programs'").fetchone())
        request = {k: v for k, v in record.items() if k not in ('record_key', 'status', 'reviewed_by')}
        request.update(id='new-program-version', rule_key=record['record_key'], rule_type='program',
                       payload={'duration_months': 30}, effective_from='2027-01-01')
        with self.conn:
            publish_knowledge(self.conn, request, 'test-reviewer')
        self.assertEqual(catalogue(self.conn, 'programs', date(2026, 12, 31), 'FI')[0]['payload']['duration_months'], 24)
        self.assertEqual(catalogue(self.conn, 'programs', date(2027, 1, 1), 'FI')[0]['payload']['duration_months'], 30)

    def test_duplicate_version_and_mismatched_evidence_rejected(self):
        first = self.example_rule()
        with self.conn:
            publish_rule(self.conn, first, 'test-reviewer')
        with self.assertRaises(ValueError):
            publish_rule(self.conn, first, 'test-reviewer')
        with self.assertRaises(ValueError):
            publish_rule(self.conn, {**first, 'id': 'bad', 'source_id': 'uk-gov-graduate-visa'}, 'test-reviewer')

    def test_pending_source_change_alerts_case_without_publishing_new_policy(self):
        with self.conn:
            saved = snapshot(self.conn, 'pending-source-case', dict(jurisdictions=['UK'], applicant_scope='student_visa_primary',
                            as_of=date(2026, 10, 2), module='finance'), 'agent')
        ingest(self.conn, ['uk-gov-student-visa-money'], fetcher=lambda url: (b'Changed official financial information. ' * 8, 'text/plain'))
        alerts = snapshot_alerts(self.conn, saved, date(2026, 10, 2))
        self.assertTrue(alerts[0]['pending_source_changes'])
        self.assertEqual(alerts[0]['added'], [])
        self.assertEqual(alerts[0]['removed'], [])

    def test_verified_source_archival_removes_policy_from_advice(self):
        self.conn.execute("UPDATE sources SET status = 'archived' WHERE id = 'uk-gov-graduate-visa'")
        self.assertEqual(self.rules(), [])

    def test_predicates_use_data_and_missing_values_are_unknown(self):
        expression = {'all': [{'field': 'budget.amount', 'operator': 'gte', 'value': 100},
                              {'field': 'budget.currency', 'operator': 'eq', 'value': 'EUR'}]}
        self.assertTrue(evaluate(expression, {'budget': {'amount': 100, 'currency': 'EUR'}}))
        self.assertFalse(evaluate(expression, {'budget': {'amount': 99, 'currency': 'EUR'}}))
        self.assertIsNone(evaluate(expression, {'budget': {'currency': 'EUR'}}))
        self.assertEqual(assess_rule({}, {}), 'context_only')
        self.assertIsNone(evaluate({'field': 'x', 'operator': 'gte', 'value': 100}, {'x': True}))

    def test_downloader_rejects_private_addresses_and_cross_host_redirects(self):
        with patch('socket.getaddrinfo', return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 443))]):
            with self.assertRaises(ValueError):
                validate_url('https://www.gov.uk/student-visa', 'www.gov.uk')
        with self.assertRaises(ValueError):
            validate_url('https://evil.example/path', 'www.gov.uk')
        with self.assertRaises(ValueError):
            validate_url('http://www.gov.uk/path', 'www.gov.uk')

    def test_html_extraction_removes_scripts_and_navigation(self):
        html = b'<nav>wrong navigation</nav><main><p>' + b'Policy body content. ' * 10 + b'</p><script>stealKey()</script></main>'
        text = extract_text(html, 'text/html')
        self.assertNotIn('stealKey', text)
        self.assertNotIn('navigation', text)


class APITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.app = create_app(Path(self.temp.name) / 'engine.sqlite', api_key='reader-test', admin_key='reviewer-test', schedule=False)
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.reader = {'X-API-Key': 'reader-test'}
        self.admin = {'X-API-Key': 'reviewer-test'}

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def test_health_public_and_data_authenticated(self):
        self.assertEqual(self.client.get('/health').status_code, 200)
        self.assertEqual(self.client.get('/v1/countries').status_code, 401)
        self.assertEqual(len(self.client.get('/v1/countries', headers=self.reader).json()['countries']), 11)
        self.assertEqual(self.client.get('/v1/admin/audit', headers=self.reader).status_code, 403)

    def test_bad_date_market_and_unknown_fields_return_validation_errors(self):
        payload = dict(jurisdictions=['UK'], applicant_scope='student_visa_primary', as_of='bad-date')
        self.assertEqual(self.client.post('/v1/agents/context', json=payload, headers=self.reader).status_code, 422)
        payload.update(as_of='2026-10-02', jurisdictions=['EU'])
        self.assertEqual(self.client.post('/v1/agents/context', json=payload, headers=self.reader).status_code, 422)
        self.assertEqual(self.client.get('/v1/policy/export', headers=self.reader).status_code, 422)

    def test_all_agent_endpoints_and_catalogue(self):
        request = dict(profile={'education': 'bachelors'}, target_markets=['FI', 'CA'], as_of='2026-10-02')
        for endpoint in ('profile-analysis', 'proposal', 'lead'):
            result = self.client.post('/v1/agents/' + endpoint, json=request, headers=self.reader)
            self.assertEqual(result.status_code, 200, result.text)
        result = self.client.post('/v1/agents/proposal', json=request, headers=self.reader).json()
        self.assertIsNone(result['ranking'])
        self.assertTrue(result['markets'][0]['programs'])
        self.assertIn('nationality', result['missing_profile_fields'])
        self.assertEqual(result['markets'][1]['eligibility'], 'requires_assessment')

    def test_snapshot_creation_read_and_wrong_case(self):
        request = dict(jurisdictions=['UK'], applicant_scope='graduate_route_primary', as_of='2026-12-31', query='Graduate visa')
        result = self.client.post('/v1/cases/test-case/policy-snapshot', json=request, headers=self.reader)
        self.assertEqual(result.status_code, 201, result.text)
        value = result.json()
        url = '/v1/cases/test-case/policy-snapshots/' + value['id']
        self.assertEqual(self.client.get(url, headers=self.reader).json()['content_hash'], value['content_hash'])
        self.assertEqual(self.client.get(url.replace('test-case', 'other-case'), headers=self.reader).status_code, 404)
        alerts = self.client.get(url + '/alerts?as_of=2027-01-01', headers=self.reader).json()
        self.assertTrue(alerts['alerts'])

    def test_openapi_matches_implemented_paths(self):
        schema = self.client.get('/v1/openapi.json', headers=self.reader).json()
        self.assertIn('/v1/admin/rules', schema['paths'])
        self.assertIn('/v1/agents/lead', schema['paths'])
        self.assertIn('APIKeyHeader', schema['components']['securitySchemes'])

    def test_reviewer_evidence_and_rule_publish_end_to_end(self):
        response = self.client.post('/v1/admin/evidence', headers=self.admin, json={
            'source_id': 'uk-gov-student-visa-money', 'excerpt': 'Synthetic evidence for API version publication test.', 'observed_at': '2026-10-02'})
        self.assertEqual(response.status_code, 201, response.text)
        source = 'https://www.gov.uk/student-visa/money'
        record = dict(id='api-test-v1', rule_key='UK:api-test:finance:amount', jurisdiction='UK', applicant_scope='api-test',
                      module='finance', title='Synthetic API test rule', rule_type='amount', payload={'amount': 10},
                      effective_from='2026-10-02', source_id='uk-gov-student-visa-money', source_url=source,
                      evidence_id=response.json()['id'], last_verified='2026-10-02', confidence=0.9, effective_date_basis='observed_from')
        self.assertEqual(self.client.post('/v1/admin/rules', headers=self.reader, json=record).status_code, 403)
        published = self.client.post('/v1/admin/rules', headers=self.admin, json=record)
        self.assertEqual(published.status_code, 201, published.text)
        result = self.client.get('/v1/rules/evaluate?jurisdiction=UK&applicant_scope=api-test&as_of=2026-10-02', headers=self.reader).json()
        self.assertEqual(result['rules'][0]['rule']['payload']['amount'], 10)


if __name__ == '__main__':
    unittest.main()
