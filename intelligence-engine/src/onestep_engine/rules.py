from __future__ import annotations

import sqlite3
import json
from datetime import date

from .db import row_to_citation, row_to_rule
from .models import RuleMatch


ACTIVE_STATUSES = ("active",)


def find_applicable_rules(
    conn: sqlite3.Connection,
    *,
    jurisdiction: str,
    applicant_scope: str,
    as_of: date,
    module: str | None = None,
    include_unreviewed: bool = False,
) -> list[RuleMatch]:
    params: dict[str, object] = {
        "jurisdiction": jurisdiction,
        "applicant_scope": applicant_scope,
        "as_of": as_of.isoformat(),
    }
    module_clause = ""
    review_clause = "AND pr.evidence_id IS NOT NULL AND pr.reviewed_by IS NOT NULL AND pr.effective_date_basis != 'unconfirmed'"
    status_clause = "AND pr.status IN ('active', 'superseded')"
    if include_unreviewed:
        review_clause = ""
        status_clause = "AND pr.status IN ('active', 'superseded', 'under_review')"
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
          AND s.status = 'active'
          {status_clause}
          {review_clause}
          AND pr.effective_from <= :as_of
          AND (pr.effective_to IS NULL OR pr.effective_to >= :as_of)
          {module_clause}
        ORDER BY s.reliability_tier ASC, pr.last_verified DESC, pr.confidence DESC
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
                "source_last_verified": row["last_verified"],
                "evidence_id": row["evidence_id"],
            }
        )
        matches.append(RuleMatch(rule=rule, citation=citation))
    return matches


def detect_policy_conflicts(matches: list[RuleMatch]) -> list[dict[str, object]]:
    by_key: dict[tuple[str, str, str, str], list[RuleMatch]] = {}
    for match in matches:
        key = (match.rule.jurisdiction, match.rule.applicant_scope, match.rule.module, match.rule.rule_type)
        by_key.setdefault(key, []).append(match)

    conflicts = []
    for (jurisdiction, applicant_scope, module, rule_type), group in by_key.items():
        payloads = {json.dumps(item.rule.payload, sort_keys=True) for item in group}
        if len(payloads) > 1:
            conflicts.append(
                {
                    "module": module,
                    "jurisdiction": jurisdiction,
                    "applicant_scope": applicant_scope,
                    "rule_type": rule_type,
                    "rule_ids": [item.rule.id for item in group],
                    "severity": "review_required",
                }
            )
    return conflicts
