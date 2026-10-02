# Knowledge Coverage Snapshot

Coverage audited on 2026-10-02. The source registry has 38 entries. The database contains 30 original draft policies, 12 reviewed policy versions and 5 reviewed catalogue records. Of the reviewed policy versions, 11 are applicable on this date; the second UK Graduate version starts on 2027-01-01.

This file summarizes the structured knowledge currently seeded into the OneStep Education & Migration Intelligence Engine. It is not a legal-advice document; it is the operational map for what AI agents can retrieve with citations.

## Markets Covered

- Australia
- United States
- Canada
- Singapore
- Malaysia
- United Kingdom
- Germany
- France
- Netherlands
- Finland
- Ireland

## Reviewed Structured Coverage

| Market | Visa | Finance | Work Rights | Post-Study | Other |
|---|---|---|---|---|---|
| Australia | GS | pending | pending | pending | - |
| United States | pending | pending | pending | pending | - |
| Canada | pending | pending | reviewed | pending | - |
| Singapore | pending | pending | reviewed | pending | - |
| Malaysia | pending | pending | pending/conflicting guidance | pending | - |
| United Kingdom | pending | reviewed | pending | 2 date versions | English and Skilled Worker foundation |
| Germany | pending | pending | reviewed | pending | DAAD EPOS scholarship |
| France | pending | pending | pending | pending | - |
| Netherlands | pending | pending | reviewed | pending | - |
| Finland | pending | pending | reviewed | pending | Aalto institution/program/admission/scholarship |
| Ireland | pending | reviewed | pending | pending | - |

The two confirmed historic commencement dates retained here are AU GS (2024-03-23) and Finland student work (2022-04-15). Other reviewed current policies use `observed_from=2026-10-02` unless the authority gives an explicit transition date. This is not a complete 2023-2026 policy archive.

Seeded retrieval contains 17 labelled reviewed summaries. Live ingestion separately stores full extracted pages, always pending review first. Seed summaries are not represented as verbatim extracts or full copies of source pages.

## Notes For AI Agents

- Normal agent endpoints require reviewed evidence and confirmed/observed date basis. Status alone is insufficient.
- `under_review` drafts are available only through reviewer endpoints and cannot support formal advice.
- Always show or retain `source_url`, `last_verified`, `effective_from`, and `effective_to`.
- Do not infer missing amounts or durations. If a rule says the exact value depends on a date-specific table, call retrieval or ask a human reviewer.
- Do not merge conflicting rules silently. Use the conflict output from the rule engine.

## Remaining Research Targets

1. Australia: financial capacity, English requirements, Temporary Graduate duration by credential and passport/age rules.
2. Canada: PAL/TAL, DLI/program PGWP eligibility, financial table by applicant/family size, field-of-study eligibility.
3. UK: Student route dependant eligibility, course-level work hour matrix, Graduate route transition on 2027-01-01.
4. United States: verify any duration-of-status rulemaking status, Form I-20/SEVIS lifecycle, CPT/OPT/STEM OPT edge cases. Do not treat proposed rulemaking as enacted law.
5. Europe: residence-permit renewal finance, post-study routes by credential and application timing.
6. Singapore/Malaysia: approved institution lists and student work approval constraints.

## Source Hierarchy Applied

Primary sources are government immigration, official immigration services, or official study portals. Lower-tier or secondary sector pages should only trigger review items, not active rules, unless no primary source is available and the rule is marked `under_review`.

## Reverification Findings

- The previous French EUR 877.50 change was not independently established in this session; its original draft remains excluded.
- Malaysian Immigration describes 20-hour part-time work during studies at approved locations, while older EMGS guidance may restrict timing to holidays. Resolve the scope/version discrepancy before publishing a binding rule.
- Finland work rights now cite Migri directly, replacing the unconfirmed study-portal attribution for advice.
- Live fetch smoke test: GOV.UK succeeded; IRCC timed out; Migri returned 403. Failed runs remain visible and are not retried by bypassing access controls.
