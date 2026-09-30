# AGENTS.md: rules for AI agents (ChatGPT Codex and others) working in this repo

Website: https://www.lotusmigrate.com (GitHub Pages, deployed automatically when `main` changes).
Owner: Paul Tran (OneStep). Communicate with the owner in Vietnamese; code, commits and comments may be in Vietnamese or English.

## The task list

Work from `docs/ENGINEERING_AUDIT.md`. Each task has an ID (T1, T2…), a priority, and acceptance criteria.
Work in the stated order: every P0 task before any P1 task, and so on. Each task or small group of tasks gets **its own branch and its own PR** (`codex/T1-build-pipeline`…). Do not bundle everything into one PR.

## How the site works (read this before changing anything)

- `content.json` is the single source of all text (a `{vi, en}` pair for each string), images, hotline and announcement.
- `render.js` (a UMD module) renders `index.html` (VI), `en/index.html` (EN) and `chinh-sach-du-lieu.html` from `content.json`. It is used in two places:
  - `node build.cjs` on a machine;
  - `/admin/` in the browser, for preview and publish.
- `/admin/index.html` is the content admin page. It logs in with the user's own fine-grained GitHub token (kept in the browser only) and publishes one commit through the Git Data API.
- `lotus-form.js` is the 4-step consultation form. It POSTs to `https://onestep-ai-crm.onrender.com/api/v1/leads/intake`.
- The client scripts (`app-v3.js`, `layout-v2.js`, `layout-v4.js`, `lotus-form.js`, `languages.js`) read their data from `<script type="application/json" id="lotus-data">`. Nothing is hardcoded in them.
- Language: VI is at `/`, EN is at `/en/`. `?lang=en` redirects to `/en/`.

## Hard rules

1. **Keep every existing function working.** The Vietnamese content and the interface must look the same unless a task explicitly says to change them. Check with screenshots at 1280px and 390px, VI and EN, before and after the change.
2. **Do not change the copy in `content.json`.** You may only change its structure when a task requires it, and then you must migrate the data and keep every value.
3. **Do not change the form's data contract with the CRM.** The fields must stay exactly: `brand:"lotus"`, `name`, `phone`, `email`, `goal`, `field_interest`, `country`, `education`, `language`, `timeframe`, `target_audience`, `pain_point`, `source_url`, `utm_*`, `consent`, `consent_version`, `consent_at`, and the honeypot `website`. The option values sent (in Vietnamese, e.g. `"Mỹ (USA)"`, `"Châu Âu"`) must not change, because CRM reports depend on them.
4. **Never send real data to the production CRM.** In tests, always mock `onestep-ai-crm.onrender.com` (Playwright `page.route`) and the GitHub API. Do not create test leads.
5. **Never commit secrets** (tokens, API keys, `.env`). The admin token belongs to each user and lives in their browser.
6. Do not force-push to `main`. Do not change `CNAME` or the DNS configuration.
7. If you change the HTML structure of a section, edit `render.js`, then run `node build.cjs`. Never hand-edit the generated HTML files.
8. When a task says "needs the owner's decision", build it behind a switch that is off by default and write in the PR what the owner has to choose.

## Checks before opening a PR

```bash
node build.cjs                 # must run without errors
git diff --exit-code -- index.html en/ chinh-sach-du-lieu.html   # generated output must match the commit (until T1 lands)
npx playwright test            # once T3 is in place
```

Each PR description must include:

- the task ID(s);
- what changed;
- how it was tested;
- before/after screenshots (VI and EN, desktop and mobile);
- the Lighthouse or axe numbers, if the task touches performance or accessibility.
