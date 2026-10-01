# Policy Update Operations

## Daily Workflow

1. Review ingestion runs with status `failed` or `completed_with_review`.
2. Open all `policy_changes` with `needs_human_review`.
3. Verify against the canonical source URL.
4. Record the exact `effective_from` date.
5. Add `effective_to` to superseded rules.
6. Insert the replacement rule as a new row.
7. Keep the old rule for historical advice and case audits.
8. Re-run regression tests and sample agent evaluations.

## Verification Standard

Every rule must include:

- jurisdiction;
- applicant scope;
- module;
- source authority;
- canonical source URL;
- effective date;
- last verified date;
- confidence;
- status.

Use `under_review` when a source is official but the interpretation needs review. Use `candidate` in `policy_changes` when the change is detected but not verified.

## No Hard-Coding Policy

Do not put mutable policy values in application code, prompts, UI copy or agent instructions. Examples:

- proof-of-funds amounts;
- work-hour limits;
- post-study visa duration;
- English score thresholds;
- visa fees;
- caps or quotas.

All such values belong in structured tables or versioned retrieval documents.

## Release Checklist

- Migrations applied successfully.
- Seed import completed.
- Policy rule lookup works for each active jurisdiction.
- Conflicts reviewed.
- API contract updated if payload shape changed.
- Case snapshots checked for superseded rules.
- Human reviewer signed off high-impact changes.

