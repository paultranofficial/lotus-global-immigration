from __future__ import annotations

import sqlite3
from datetime import date

from .db import row_to_citation, row_to_rule
from .models import RuleMatch


ACTIVE_STATUSES = ("active", "under_review")


def find_applicable_rules(
    conn: sqlite3.Connection,
    *,
    jurisdiction: str,
    applicant_scope: str,
    as_of: date,
    module: str | None = None,
) -> list[RuleMatch]:
    params: dict[str, object] = {
        "jurisdiction": jurisdiction,
        "applicant_scope": applicant_scope,
        "as_of": as_of.isoformat(),
    }
    module_clause = ""
    if module:
        module_clause = "AND pr.module = :module"
        params["module"] = module

    rows = conn.execute(
        f"""
        SELECT
            pr.*,
            s.title AS source_title,
            s.authority AS authority,
            s.url AS canonical_source_url,
            s.last_verified AS source_last_verified
        FROM policy_rules pr
        JOIN sources s ON s.id = pr.source_id
        WHERE pr.jurisdiction = :jurisdiction
          AND pr.applicant_scope = :applicant_scope
          AND pr.status IN ('active', 'under_review')
          AND pr.effective_from <= :as_of
          AND (pr.effective_to IS NULL OR pr.effective_to >= :as_of)
          {module_clause}
        ORDER BY pr.confidence DESC, pr.last_verified DESC, pr.effective_from DESC
        """,
        params,
    ).fetchall()

    matches: list[RuleMatch] = []
    for row in rows:
        rule = row_to_rule(row)
        citation = row_to_citation(
            {
                "source_id": row["source_id"],
                "source_title": row["source_title"],
                "authority": row["authority"],
                "source_url": row["source_url"] or row["canonical_source_url"],
                "source_last_verified": row["source_last_verified"],
            }
        )
        matches.append(RuleMatch(rule=rule, citation=citation))
    return matches


def detect_policy_conflicts(matches: list[RuleMatch]) -> list[dict[str, object]]:
    by_key: dict[tuple[str, str], list[RuleMatch]] = {}
    for match in matches:
        key = (match.rule.module, match.rule.rule_type)
        by_key.setdefault(key, []).append(match)

    conflicts = []
    for (module, rule_type), group in by_key.items():
        payloads = {str(item.rule.payload) for item in group}
        if len(payloads) > 1:
            conflicts.append(
                {
                    "module": module,
                    "rule_type": rule_type,
                    "rule_ids": [item.rule.id for item in group],
                    "severity": "review_required",
                }
            )
    return conflicts

