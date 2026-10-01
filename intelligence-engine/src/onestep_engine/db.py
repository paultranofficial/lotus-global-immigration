from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from datetime import date
from pathlib import Path
from typing import Any

from .models import Citation, PolicyRule, Source


ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = ROOT / "migrations"
SEEDS_DIR = ROOT / "seeds"


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def apply_migrations(conn: sqlite3.Connection) -> None:
    for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
        conn.executescript(migration.read_text(encoding="utf-8"))
    conn.commit()


def load_seed_json(name: str) -> list[dict[str, Any]]:
    return json.loads((SEEDS_DIR / name).read_text(encoding="utf-8"))


def seed_database(conn: sqlite3.Connection) -> None:
    upsert_sources(conn, load_seed_json("sources.json"))
    upsert_countries(conn, load_seed_json("countries.json"))
    upsert_rules(conn, load_seed_json("policy_rules.json"))
    conn.commit()


def upsert_sources(conn: sqlite3.Connection, sources: Iterable[dict[str, Any]]) -> None:
    conn.executemany(
        """
        INSERT INTO sources (
            id, title, authority, authority_type, jurisdiction, url,
            reliability_tier, last_verified, status
        )
        VALUES (
            :id, :title, :authority, :authority_type, :jurisdiction, :url,
            :reliability_tier, :last_verified, :status
        )
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            authority=excluded.authority,
            authority_type=excluded.authority_type,
            jurisdiction=excluded.jurisdiction,
            url=excluded.url,
            reliability_tier=excluded.reliability_tier,
            last_verified=excluded.last_verified,
            status=excluded.status
        """,
        list(sources),
    )


def upsert_countries(conn: sqlite3.Connection, countries: Iterable[dict[str, Any]]) -> None:
    conn.executemany(
        """
        INSERT INTO countries (code, name, region, priority, status)
        VALUES (:code, :name, :region, :priority, :status)
        ON CONFLICT(code) DO UPDATE SET
            name=excluded.name,
            region=excluded.region,
            priority=excluded.priority,
            status=excluded.status
        """,
        list(countries),
    )


def upsert_rules(conn: sqlite3.Connection, rules: Iterable[dict[str, Any]]) -> None:
    normalized = []
    for rule in rules:
        row = dict(rule)
        row["payload"] = json.dumps(row["payload"], ensure_ascii=True, sort_keys=True)
        normalized.append(row)

    conn.executemany(
        """
        INSERT INTO policy_rules (
            id, module, jurisdiction, applicant_scope, title, rule_type, payload,
            effective_from, effective_to, source_id, source_url, last_verified,
            confidence, status
        )
        VALUES (
            :id, :module, :jurisdiction, :applicant_scope, :title, :rule_type, :payload,
            :effective_from, :effective_to, :source_id, :source_url, :last_verified,
            :confidence, :status
        )
        ON CONFLICT(id) DO UPDATE SET
            module=excluded.module,
            jurisdiction=excluded.jurisdiction,
            applicant_scope=excluded.applicant_scope,
            title=excluded.title,
            rule_type=excluded.rule_type,
            payload=excluded.payload,
            effective_from=excluded.effective_from,
            effective_to=excluded.effective_to,
            source_id=excluded.source_id,
            source_url=excluded.source_url,
            last_verified=excluded.last_verified,
            confidence=excluded.confidence,
            status=excluded.status
        """,
        normalized,
    )


def parse_date(value: str | None) -> date | None:
    if value is None:
        return None
    return date.fromisoformat(value)


def row_to_source(row: sqlite3.Row) -> Source:
    return Source(
        id=row["id"],
        title=row["title"],
        authority=row["authority"],
        authority_type=row["authority_type"],
        jurisdiction=row["jurisdiction"],
        url=row["url"],
        reliability_tier=row["reliability_tier"],
        last_verified=parse_date(row["last_verified"]) or date.min,
        status=row["status"],
    )


def row_to_rule(row: sqlite3.Row) -> PolicyRule:
    return PolicyRule(
        id=row["id"],
        module=row["module"],
        jurisdiction=row["jurisdiction"],
        applicant_scope=row["applicant_scope"],
        title=row["title"],
        rule_type=row["rule_type"],
        payload=json.loads(row["payload"]),
        effective_from=parse_date(row["effective_from"]) or date.min,
        effective_to=parse_date(row["effective_to"]),
        source_id=row["source_id"],
        source_url=row["source_url"],
        last_verified=parse_date(row["last_verified"]) or date.min,
        confidence=row["confidence"],
        status=row["status"],
    )


def row_to_citation(row: sqlite3.Row) -> Citation:
    return Citation(
        source_id=row["source_id"],
        title=row["source_title"],
        authority=row["authority"],
        url=row["source_url"],
        last_verified=parse_date(row["source_last_verified"]) or date.min,
    )


def list_countries(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT code, name, region, priority, status
        FROM countries
        ORDER BY priority ASC, region ASC, name ASC
        """
    ).fetchall()
    return [dict(row) for row in rows]


def list_sources(
    conn: sqlite3.Connection,
    *,
    jurisdiction: str | None = None,
    status: str = "active",
) -> list[dict[str, Any]]:
    params: dict[str, object] = {"status": status}
    jurisdiction_clause = ""
    if jurisdiction:
        jurisdiction_clause = "AND jurisdiction = :jurisdiction"
        params["jurisdiction"] = jurisdiction

    rows = conn.execute(
        f"""
        SELECT id, title, authority, authority_type, jurisdiction, url,
               reliability_tier, last_verified, status
        FROM sources
        WHERE status = :status
        {jurisdiction_clause}
        ORDER BY reliability_tier ASC, jurisdiction ASC, authority ASC
        """,
        params,
    ).fetchall()
    return [dict(row) for row in rows]


def export_policy_context(
    conn: sqlite3.Connection,
    *,
    jurisdiction: str | None = None,
    module: str | None = None,
    status: str = "active",
) -> dict[str, Any]:
    params: dict[str, object] = {"status": status}
    clauses = ["pr.status = :status"]
    if jurisdiction:
        clauses.append("pr.jurisdiction = :jurisdiction")
        params["jurisdiction"] = jurisdiction
    if module:
        clauses.append("pr.module = :module")
        params["module"] = module

    where_clause = " AND ".join(clauses)
    rows = conn.execute(
        f"""
        SELECT
            pr.*,
            s.title AS source_title,
            s.authority AS source_authority,
            s.authority_type AS source_authority_type,
            s.reliability_tier AS source_reliability_tier
        FROM policy_rules pr
        JOIN sources s ON s.id = pr.source_id
        WHERE {where_clause}
        ORDER BY pr.jurisdiction ASC, pr.module ASC, pr.effective_from DESC
        """,
        params,
    ).fetchall()

    rules = []
    for row in rows:
        rule = dict(row)
        rule["payload"] = json.loads(rule["payload"])
        rule["provenance"] = {
            "source_id": rule.pop("source_id"),
            "source_title": rule.pop("source_title"),
            "source_authority": rule.pop("source_authority"),
            "source_authority_type": rule.pop("source_authority_type"),
            "source_reliability_tier": rule.pop("source_reliability_tier"),
            "source_url": rule["source_url"],
            "last_verified": rule["last_verified"],
        }
        rules.append(rule)

    return {
        "filters": {
            "jurisdiction": jurisdiction,
            "module": module,
            "status": status,
        },
        "rules": rules,
    }
