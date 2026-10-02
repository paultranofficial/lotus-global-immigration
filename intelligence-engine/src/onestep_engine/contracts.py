from datetime import date, datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Market(str, Enum):
    AU = 'AU'
    US = 'US'
    CA = 'CA'
    SG = 'SG'
    MY = 'MY'
    UK = 'UK'
    DE = 'DE'
    FR = 'FR'
    NL = 'NL'
    FI = 'FI'
    IE = 'IE'


class Module(str, Enum):
    visa = 'visa'
    finance = 'finance'
    english = 'english'
    work_rights = 'work_rights'
    post_study = 'post-study'
    immigration = 'immigration'
    institutions = 'institutions'
    programs = 'programs'
    admissions = 'admissions'
    scholarships = 'scholarships'


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', use_enum_values=True)


class ContextRequest(StrictModel):
    jurisdictions: list[Market] = Field(min_length=1, max_length=11)
    applicant_scope: str = Field(min_length=1, max_length=100)
    as_of: date
    module: Module | None = None
    query: str | None = Field(default=None, max_length=500)


class ProfileRequest(StrictModel):
    profile: dict[str, Any]
    target_markets: list[Market] = Field(min_length=1, max_length=11)
    as_of: date


class RuleVersion(StrictModel):
    id: str = Field(min_length=1, max_length=200)
    rule_key: str = Field(min_length=1, max_length=200)
    module: Literal['visa', 'finance', 'english', 'work_rights', 'post-study', 'immigration', 'admissions', 'scholarships']
    jurisdiction: Market
    applicant_scope: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    rule_type: str = Field(min_length=1, max_length=100)
    payload: dict[str, Any]
    effective_from: date
    effective_to: date | None = None
    source_id: str
    source_url: str
    evidence_id: str
    last_verified: date
    confidence: float = Field(ge=0, le=1)
    effective_date_basis: Literal['authority_effective_date', 'observed_from']

    @model_validator(mode='after')
    def validate_dates(self):
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValueError('effective_to must be on or after effective_from (inclusive)')
        if self.last_verified > date.today():
            raise ValueError('last_verified cannot be in the future')
        return self


class EvidenceRequest(StrictModel):
    source_id: str
    excerpt: str = Field(min_length=20, max_length=20000)
    observed_at: date
    document_id: str | None = None


class DocumentReview(StrictModel):
    effective_from: date
    effective_to: date | None = None

    @model_validator(mode='after')
    def validate_dates(self):
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValueError('invalid effective interval')
        return self


class KnowledgeVersion(RuleVersion):
    module: Literal['institutions', 'programs', 'admissions', 'scholarships', 'english', 'immigration']


class IngestionRequest(StrictModel):
    source_ids: list[str] = Field(min_length=1, max_length=3)


class DecisionRequest(StrictModel):
    status: Literal['verified', 'rejected']
    reason: str = Field(min_length=10, max_length=2000)


class RetirementRequest(StrictModel):
    reason: str = Field(min_length=10, max_length=2000)


class CitationResponse(BaseModel):
    source_id: str
    title: str
    authority: str
    url: str
    last_verified: date
    evidence_id: str | None


class RuleResponse(BaseModel):
    id: str
    rule_key: str | None
    module: str
    jurisdiction: str
    applicant_scope: str
    title: str
    rule_type: str
    payload: dict[str, Any]
    effective_from: date
    effective_to: date | None
    effective_date_basis: str
    source_id: str
    source_url: str
    last_verified: date
    confidence: float
    status: str
    reviewed_by: str | None


class CitedRuleResponse(BaseModel):
    rule: RuleResponse
    citation: CitationResponse


class MarketContextResponse(BaseModel):
    jurisdiction: str
    rules: list[CitedRuleResponse]
    conflicts: list[dict[str, Any]]
    retrieval: list[dict[str, Any]]
    pending_source_changes: list[dict[str, Any]]
    coverage_status: Literal['partial', 'insufficient_verified_data']


class ContextResponse(BaseModel):
    as_of: date
    applicant_scope: str
    module: str | None
    query: str | None = None
    results: list[MarketContextResponse]
    advice_status: str
    retrieval_trust: str


class AnalysedMarketResponse(MarketContextResponse):
    eligibility: Literal['requires_assessment']
    freshness_flags: list[dict[str, Any]]
    rule_assessments: list[dict[str, str]]
    evidence_checklist: list[dict[str, Any]]
    programs: list[dict[str, Any]] | None = None
    scholarships: list[dict[str, Any]] | None = None
    cost_estimate: dict[str, Any] | None = None
    recommendation_status: str | None = None


class ProfileResponse(BaseModel):
    as_of: date
    missing_profile_fields: list[str]
    markets: list[AnalysedMarketResponse]
    status: str
    ranking: list[dict[str, Any]] | None = None


class LeadResponse(BaseModel):
    analysis: ProfileResponse
    next_action: Literal['collect_profile', 'advisor_review']
    proposal: ProfileResponse


class SnapshotResponse(BaseModel):
    id: str
    case_id: str
    as_of: date
    created_at: datetime
    content_hash: str
    payload: ContextResponse
