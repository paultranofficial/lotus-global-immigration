from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from datetime import date
from pathlib import Path

from .db import apply_migrations, connect, seed_database
from .rules import detect_policy_conflicts, find_applicable_rules


def init_db(path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = connect(path)
    apply_migrations(conn)
    seed_database(conn)
    conn.close()
    print(f"Initialized OneStep engine database at {path}")


def evaluate(path: str, jurisdiction: str, applicant_scope: str, as_of: str) -> None:
    conn = connect(path)
    matches = find_applicable_rules(
        conn,
        jurisdiction=jurisdiction,
        applicant_scope=applicant_scope,
        as_of=date.fromisoformat(as_of),
    )
    output = {
        "rules": [
            {
                "rule": asdict(match.rule),
                "citation": asdict(match.citation),
            }
            for match in matches
        ],
        "conflicts": detect_policy_conflicts(matches),
    }
    print(json.dumps(output, default=str, indent=2, ensure_ascii=False))
    conn.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init-db")
    init_parser.add_argument("path")

    eval_parser = subparsers.add_parser("evaluate")
    eval_parser.add_argument("path")
    eval_parser.add_argument("jurisdiction")
    eval_parser.add_argument("applicant_scope")
    eval_parser.add_argument("as_of")

    ingest_parser = subparsers.add_parser("ingest")
    ingest_parser.add_argument("path")
    ingest_parser.add_argument("--source", action="append", dest="sources")
    ingest_parser.add_argument("--limit", type=int, default=3, choices=range(1, 21))
    ingest_parser.add_argument("--scheduled", action="store_true")

    backup_parser = subparsers.add_parser("backup")
    backup_parser.add_argument("path")
    backup_parser.add_argument("destination")

    schema_parser = subparsers.add_parser("export-openapi")
    schema_parser.add_argument("destination")

    export_parser = subparsers.add_parser("export-knowledge")
    export_parser.add_argument("path")
    export_parser.add_argument("destination")

    args = parser.parse_args()
    if args.command == "init-db":
        init_db(args.path)
    elif args.command == "evaluate":
        evaluate(args.path, args.jurisdiction, args.applicant_scope, args.as_of)
    elif args.command == "ingest":
        from .ingestion import ingest
        conn = connect(args.path)
        try:
            print(json.dumps(ingest(conn, args.sources, 'scheduled' if args.scheduled else 'manual', args.limit), indent=2))
        finally:
            conn.close()
    elif args.command == "backup":
        import sqlite3
        if Path(args.path).resolve() == Path(args.destination).resolve() or Path(args.destination).exists():
            raise SystemExit('Backup destination must be a new file distinct from the database')
        conn = connect(args.path)
        destination = sqlite3.connect(args.destination)
        try:
            conn.backup(destination)
            print(f'Backup written to {args.destination}')
        finally:
            destination.close()
            conn.close()
    elif args.command == "export-openapi":
        import yaml
        from .api import create_app
        schema = create_app(schedule=False).openapi()
        Path(args.destination).write_text(yaml.safe_dump(schema, sort_keys=False), encoding='utf-8')
        print(f'OpenAPI contract written to {args.destination}')
    elif args.command == "export-knowledge":
        from .db import list_countries, list_sources
        conn = connect(args.path)
        try:
            rules = [dict(r) for r in conn.execute('''SELECT pr.*, s.authority, s.reliability_tier,
                e.excerpt AS evidence_summary, e.method AS evidence_method FROM policy_rules pr
                JOIN sources s ON s.id = pr.source_id JOIN evidence e ON e.id = pr.evidence_id
                WHERE pr.reviewed_by IS NOT NULL AND pr.status IN ('active', 'superseded') AND s.status = 'active'
                ORDER BY pr.jurisdiction, pr.rule_key, pr.effective_from''')]
            records = [dict(r) for r in conn.execute('''SELECT k.*, s.authority, e.excerpt AS evidence_summary
                FROM knowledge_records k JOIN sources s ON s.id = k.source_id JOIN evidence e ON e.id = k.evidence_id
                WHERE k.status = 'active' AND s.status = 'active' ORDER BY k.module, k.jurisdiction''')]
            for record in rules + records:
                record['payload'] = json.loads(record['payload'])
            value = {'schema_version': '0.2.0', 'countries': list_countries(conn), 'sources': list_sources(conn),
                     'rules': rules, 'knowledge_records': records,
                     'usage': 'Select effective interval and applicant scope before citing. Reviewed summaries are not full source pages. Coverage is partial; absent facts require further research.'}
            Path(args.destination).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
            print(f'Reviewed knowledge exported: {len(rules)} rule versions, {len(records)} catalogue records')
        finally:
            conn.close()


if __name__ == "__main__":
    main()
