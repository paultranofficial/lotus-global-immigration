# OneStep Intelligence Engine Architecture

## Design Goals

The system must answer study-abroad and migration questions with:

- current rules as of a requested date;
- full provenance and citations;
- source hierarchy control;
- separation between immutable policy facts, inferred advice and AI-generated wording;
- live ingestion that routes risky policy changes to human review.

## Source Hierarchy

1. Government immigration authorities: Home Affairs, IRCC, UKVI, ICA, IND, Migri, ISD, DHS/SEVP.
2. Government education authorities and official study portals: Study Australia, Campus France, Education Malaysia Global Services.
3. Statutory regulators and official institution registries.
4. Institutions, only for institution/program/admission facts.
5. Trusted sector sources, only as secondary context or alerts.

When sources conflict, the engine prefers lower `reliability_tier`, newer `last_verified`, and narrower jurisdiction/scope. Conflicts are never silently merged.

## Core Modules

- `countries`: market taxonomy.
- `institutions`: official provider records, registry IDs and status.
- `programs`: courses, levels, intakes, tuition, delivery mode.
- `admissions`: academic entry rules.
- `scholarships`: eligibility, award value and deadlines.
- `visa`: student visa/pass/permit requirements.
- `finance`: proof of funds, fee payment and sponsor evidence.
- `english`: language test and waiver rules.
- `work_rights`: in-study work conditions.
- `post-study`: graduate routes and job-search permits.
- `immigration`: longer-term migration pathways.
- `policy_changes`: candidate, verified and rejected policy changes.
- `sources`: canonical authority metadata.

## RAG + Structured DB + Rule Engine

Structured DB handles deterministic facts:

- amount thresholds;
- dates;
- required documents;
- eligibility conditions;
- source authority and confidence.

RAG handles long-form context:

- policy guidance;
- caseworker guidance;
- institutional pages;
- procedural notes.

Rule engine handles time-sensitive filtering:

- jurisdiction;
- applicant scope;
- module;
- `effective_from <= as_of`;
- `effective_to IS NULL OR effective_to >= as_of`;
- status in `active` or `under_review`.

AI agents must cite both structured rules and retrieval chunks. Generated recommendations without citations should be treated as draft reasoning only.

## Agent Contracts

### AI Lead Agent

Responsibilities:

- orchestrate profile analysis, proposal generation and case workflow;
- ask missing-information questions;
- prevent unsupported policy claims.

Required engine calls:

- `/v1/rules/evaluate`
- RAG search endpoint, to be added in Phase 2
- policy snapshot endpoint before formal advice is produced

### Profile Analysis Agent

Responsibilities:

- classify applicant profile;
- detect risk factors;
- identify evidence gaps;
- evaluate visa and finance rules by market.

Outputs:

- eligibility indicators;
- risk register;
- document checklist;
- cited policy assumptions.

### Proposal Agent

Responsibilities:

- shortlist countries, institutions and programs;
- map budget, English, academic level and career goals;
- explain tradeoffs with citations.

Outputs:

- ranked options;
- cost and timeline estimate;
- visa/document risk notes;
- source list.

### Case Management Agent

Responsibilities:

- freeze policy snapshot per case;
- track document status;
- alert when a saved rule is superseded before submission;
- maintain audit trail.

Outputs:

- case checklist;
- policy snapshot;
- update alerts;
- final application readiness report.

## Live Update Ingestion

Scheduled ingestion should:

1. Crawl canonical source URLs and registered policy pages.
2. Hash extracted content.
3. Compare with prior hashes.
4. Classify changes by module and jurisdiction.
5. Extract candidate rule deltas.
6. Store candidates in `policy_changes`.
7. Mark high-impact changes as `needs_human_review`.
8. Only promote to active `policy_rules` after verification.

High-impact examples:

- proof-of-funds amount changes;
- visa eligibility changes;
- work-right restrictions;
- post-study route changes;
- caps, quotas or prioritization directions.

