# Policy editor workflow

## Evidence and dates

Every published policy version needs jurisdiction, applicant scope, `rule_key`, source ID, canonical URL, evidence ID, effective interval, verification date, confidence and a reviewer. Its citation includes the authority. Dates use inclusive bounds; when the next version begins, the earlier interval closes the previous day.

`effective_date_basis=authority_effective_date` means the authority explicitly gives the legal date. `observed_from` means the requirement was verified on the observation date and earlier applicability is unknown. Never invent a commencement date from a page's publication date or the seed filename. Last-crawled and last-verified are distinct.

The 30 original seeds have no retained evidence and are imported as `under_review`. Regular agent endpoints exclude them. Reviewer-only `/v1/admin/draft-context` exposes them for editorial work. This includes the unconfirmed French resources change and the differing Malaysian work guidance.

## Collect and review

1. Call `POST /v1/admin/ingestion` with registered source IDs, or run the CLI. Arbitrary URLs are not accepted. The fetcher allows bounded HTML/plain-text/PDF downloads from registered HTTPS hosts and rejects private addresses and cross-host redirects.
2. Review `/v1/admin/documents` and `/v1/admin/policy-changes`. Inspect the complete extracted text, canonical source, hash and content changes. A content change is an alert, not proof that a legal rule changed.
3. Approve the relevant document with the applicable effective interval. Reviewed summaries and full live pages are distinct document kinds. An unchanged crawl refreshes `last_crawled` only; it does not renew verification or publish a rule.
4. Register evidence using `/v1/admin/evidence`. When referencing a document, the excerpt must appear in its normalized text and belong to the same source. Without a document, the reviewer attests that the supplied excerpt was inspected on the canonical page. Record actual observation date, not a future date.
5. Publish a new rule ID through `/v1/admin/rules`. Binding visa/finance/work/immigration rules require an authority-tier source. Evidence and source must match; `last_verified` must equal the evidence observation date. Keep the same `rule_key` for successive versions of the same requirement.
6. Review the content-change item as verified or rejected with an explanation. This decision does not itself modify policy rules. Check time-boundary examples, citations and conflicts before sending advice.

Write endpoints require the reviewer key; agent keys cannot publish. The reviewer identity is configured using `ONESTEP_ENGINE_REVIEWER`. Shared-key deployment has one reviewer identity; individual reviewer authentication is a later upgrade.

## Declarative eligibility predicates

Policy amounts and conditions stay in data. Optional `payload.predicate` supports nested `all`/`any` groups and `eq`, `in`, `gte`, `lte`, `exists` operators over profile fields. It does not execute code. Missing or wrongly typed comparison inputs produce `requires_information`; a rule without a predicate returns `context_only`.

Example of a synthetic condition, not an actual immigration requirement:

```json
{"predicate":{"all":[
  {"field":"budget.currency","operator":"eq","value":"EUR"},
  {"field":"budget.amount","operator":"gte","value":100}
]}}
```

An individual condition being met is not a whole-application eligibility result. Nationality, family members, permit history, institution, course, location and transition dates may each require additional records. Do not derive immigration rules from institution marketing pages.

## Catalogue updates

Publish institution/program/admission/scholarship versions through `/v1/admin/knowledge`. They require the same provenance fields and effective dates. Official institution pages are acceptable for their own course/admission facts. Use a stable `rule_key` per catalogue item, new IDs per version, and non-overlapping intervals. Set a known inclusive `effective_to` when importing a time-limited intake or scholarship record.

## Quality controls and corrections

Inspect `/v1/freshness` regularly. A null source verification date means no retained reviewed evidence exists. Profile analysis flags rule verification older than 30 days; this is an operational review threshold, not a law. Failed downloads are logged and do not overwrite approved policy.

If two source authorities disagree, retain both with their scopes and surface a conflict. Verify local/national exceptions and transitional rules. Retire a wrong published version with a reason, then publish a new corrected ID. Snapshots, evidence and audit events remain immutable.

UK Graduate visa records provide a real boundary test: a standard application on 2026-12-31 uses 24 months, while one on 2027-01-01 uses 18 months. The 36-month doctoral condition remains in both data versions. See [UKVI](https://www.gov.uk/graduate-visa).
