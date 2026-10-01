# Knowledge Coverage Snapshot

Verified on 2026-10-01.

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

## Structured Rule Coverage

| Market | Visa/Foundation | Finance | Work Rights | Post-Study |
|---|---:|---:|---:|---:|
| Australia | yes | planned | yes | yes |
| United States | yes | planned | yes | yes |
| Canada | planned | yes | yes | yes |
| Singapore | yes | planned | yes | planned |
| Malaysia | yes | planned | yes | planned |
| United Kingdom | planned | yes | yes | yes |
| Germany | planned | yes | yes | yes |
| France | planned | yes | yes | yes |
| Netherlands | planned | yes | yes | yes |
| Finland | planned | yes | under review | yes |
| Ireland | planned | yes | yes | yes |

## Notes For AI Agents

- Treat `status: active` rules as usable cited context.
- Treat `status: under_review` rules as advisory context that needs human confirmation before formal advice.
- Always show or retain `source_url`, `last_verified`, `effective_from`, and `effective_to`.
- Do not infer missing amounts or durations. If a rule says the exact value depends on a date-specific table, call retrieval or ask a human reviewer.
- Do not merge conflicting rules silently. Use the conflict output from the rule engine.

## High-Priority Phase 2 Ingestion Targets

1. Australia: financial capacity, English requirements, Temporary Graduate duration by credential and passport/age rules.
2. Canada: PAL/TAL, DLI/program PGWP eligibility, financial table by applicant/family size, field-of-study eligibility.
3. UK: Student route dependant eligibility, course-level work hour matrix, Graduate route transition on 2027-01-01.
4. United States: F-1 fixed admission duration transition, Form I-20/SEVIS lifecycle, CPT/OPT/STEM OPT edge cases.
5. Europe: residence-permit renewal finance, post-study routes by credential and application timing.
6. Singapore/Malaysia: approved institution lists and student work approval constraints.

## Source Hierarchy Applied

Primary sources are government immigration, official immigration services, or official study portals. Lower-tier or secondary sector pages should only trigger review items, not active rules, unless no primary source is available and the rule is marked `under_review`.

