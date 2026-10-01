from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from datetime import date

from .db import apply_migrations, connect, seed_database
from .rules import detect_policy_conflicts, find_applicable_rules


def init_db(path: str) -> None:
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

    args = parser.parse_args()
    if args.command == "init-db":
        init_db(args.path)
    elif args.command == "evaluate":
        evaluate(args.path, args.jurisdiction, args.applicant_scope, args.as_of)


if __name__ == "__main__":
    main()

