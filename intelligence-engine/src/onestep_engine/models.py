from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any


@dataclass(frozen=True)
class Source:
    id: str
    title: str
    authority: str
    authority_type: str
    jurisdiction: str
    url: str
    reliability_tier: int
    last_verified: date
    status: str


@dataclass(frozen=True)
class PolicyRule:
    id: str
    module: str
    jurisdiction: str
    applicant_scope: str
    title: str
    rule_type: str
    payload: dict[str, Any]
    effective_from: date
    effective_to: date | None
    source_id: str
    source_url: str
    last_verified: date
    confidence: float
    status: str
    rule_key: str | None = None
    effective_date_basis: str = 'unconfirmed'
    reviewed_by: str | None = None


@dataclass(frozen=True)
class Citation:
    source_id: str
    title: str
    authority: str
    url: str
    last_verified: date
    evidence_id: str | None = None


@dataclass(frozen=True)
class RuleMatch:
    rule: PolicyRule
    citation: Citation
