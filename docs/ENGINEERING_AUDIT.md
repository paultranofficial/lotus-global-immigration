# Lotus website engineering audit: 30/09/2026

Scope: the whole `lotus-global-immigration` repo at commit `a9c2639`. That covers:

- the static site (VI/EN);
- the renderer `render.js` and `content.json`;
- the admin page `/admin/`;
- the form that sends to onestep-ai-crm;
- the GitHub Pages deploy.

Read `AGENTS.md` first: it holds the hard rules.

## 1. Current architecture

```
content.json ──► render.js ──► index.html, en/index.html, chinh-sach-du-lieu.html  (generated, committed to git)
      ▲               ▲
      │               └── build.cjs (runs locally)
/admin/ (browser) ── GitHub Git Data API ──► 1 commit: content.json + 3 HTML files + images
                                                  │
                     push main ──► .github/workflows/pages.yml ──► upload the WHOLE repo ──► GitHub Pages
Form (lotus-form.js) ──POST──► onestep-ai-crm.onrender.com/api/v1/leads/intake (CORS whitelist, consent, honeypot)
```

**Strengths worth keeping:**

- Content lives in one place, so the VI and EN pages cannot drift apart.
- The admin page needs no backend.
- The form already validates, requires consent, has a honeypot and carries UTM parameters.

## 2. Findings (measured, not guessed)

| # | Area | Finding | Evidence |
|---|---|---|---|
| F1 | Architecture | The generated HTML is committed to git and the admin page renders it with whichever `render.js` is live. If someone edits `content.json` directly on GitHub, the HTML is not rebuilt, and nothing catches it. | `pages.yml` has no build step |
| F2 | Deploy/Security | The Pages workflow uploads `path: .`, so it publishes the entire repo: README, build.cjs, render.yaml, AGENTS.md, docs/… | `pages.yml` |
| F3 | Quality | There are no automated tests and no CI checks on PRs. `content.json` has no schema, so broken content can still be published. | no `test` workflow |
| F4 | Maintainability | The CSS is split into 7 files layered on top of each other (`style` → `layout-v2` → `v3` → `v5` …). Every file is **minified onto a single line** and there is no readable source. File names say version numbers instead of what they do. | `layout-v3.css` is 1 line |
| F5 | Performance | Fonts load through `@import` inside `style.css`, so they wait for the CSS first. There are 7 render-blocking CSS files and 5 JS files, and no preload for the hero image. | `style.css` line 1 |
| F6 | Performance | Images are JPEG/PNG only: no WebP/AVIF and no `srcset`. The logo is a 600px, **181 KB** PNG shown at 170px. 18 `<img>` tags have no `width`/`height` (layout shift, CLS). The first page load is about **731 KB**. | measured with Playwright |
| F7 | Clean-up | `assets/beauty-portrait.jpg` (125 KB) is not used anywhere. `render.yaml` (Render) is no longer used, since the site is on GitHub Pages. | grep |
| F8 | Legal/i18n | The EN page links to the **Vietnamese-only** policy page. The policy text and all the form copy are hardcoded in `render.js`, so they cannot be edited in `/admin`. | `render.js` `formSection`, `POLICY_BODY` |
| F9 | Accessibility | axe finds 3 **serious** color-contrast errors in the route map (`.route-targets small`) on the site. The admin page has 1 contrast error (login button) and is missing `<main>` / landmarks. | axe-core 4.x |
| F10 | Admin security | The token defaults to `localStorage` ("remember" is ticked by default). The preview iframe is `srcdoc`, same-origin with the admin page, so it can read the token. The admin page has no CSP. The main admin script is inline. | `admin/index.html` |
| F11 | Admin UX | Images removed from the content are never deleted, so `assets/uploads/` keeps growing. There is no history or rollback button, alt text is not required for new images, there is no "duplicate item" action, and there are no length limits for headings. | |
| F12 | Form | A network error loses the user's answers when they reload the page, and there is no fallback of sending through Zalo. Timeout is 20s, retry is 0. The CRM is on the Render *starter* plan, so it does not sleep and this is a low risk. | `lotus-form.js` |
| F13 | SEO | There is no JSON-LD (Organization, FAQPage) and no Twitter card. The OG image is a portrait (1120×1400) instead of 1200×630. There is no `404.html`, no apple-touch-icon and no manifest. The sitemap has no `lastmod`. | |
| F14 | Measurement | There is no analytics and no conversion tracking (form_start, submit, Zalo and hotline clicks). Adding it requires a consent banner under Decree 13/2023/NĐ-CP. | |
| F15 | Site security | GitHub Pages cannot set HTTP security headers. The site has no CSP / Referrer-Policy meta tags. | |

## 3. Task list

Priority order: **P0** foundations (do first), then **P1** for performance, security and reliability, then **P2** for polish, SEO and new features.

---

### P0: Foundations

**T1. Build in CI and publish only public files** (F1, F2)
- `pages.yml`: add `setup-node` → `node build.cjs --out _site`. Copy only these into `_site/`:
  - the HTML, CSS and JS the site needs;
  - `assets/`, `admin/`;
  - `render.js`, `content.json` (the admin page uses them to watch deploys);
  - `CNAME`, `robots.txt`, `sitemap.xml`, `.nojekyll`.
- Upload `_site`.
- Stop committing the generated HTML: add it to `.gitignore` and remove it from the repo.
- The admin page then only commits `content.json` and new images.
  - Update `publish()` in `admin/index.html` and the success message: the site is live once the workflow finishes.
- A build error must **stop the deploy**, so the live site stays on the previous version.
- ✅ Accept when:
  - `README.md`, `AGENTS.md`, `docs/`, `build.cjs` and `render.yaml` return 404 on the live site;
  - an edit made through `/admin` still reaches the site;
  - a broken `content.json` fails the workflow and the site does not change.

**T2. Content schema and validation** (F3)
- Write `content.schema.json` (JSON Schema draft 2020-12) that describes the current structure of `content.json`.
- Add `scripts/validate-content.cjs` (use `ajv`) and run it in CI before the build.
- Have the admin page use the same rules before publishing, or run shared validation logic.
- ✅ Accept when:
  - the current `content.json` passes;
  - removing a required field, or a `{vi,en}` pair missing `vi`, fails CI.

**T3. Automated test suite** (F3)
- Playwright. Mock the CRM and the GitHub API.
- Tests to cover:
  - VI/EN rendering;
  - `?lang=en` → `/en/`;
  - destination dialog → CTA → the matching destination is pre-ticked;
  - career filter count (VI/EN);
  - all 4 form steps;
  - a **snapshot of the payload** sent to the CRM (so the contract in AGENTS.md cannot break);
  - consent required;
  - honeypot;
  - admin: login → edit → upload image → publish (check the commit contents);
  - the conflict flow;
  - restoring a draft.
- Add a `test.yml` workflow that runs on every PR.
- Also add `axe-core` to CI: fail on any serious or critical issue.
- ✅ Accept when CI is green on `main` and a PR that breaks the payload fails.

---

### P1: Performance, maintainability, security

**T4. Optimize images** (F6, F7)
- At build time (`sharp`), generate AVIF/WebP at 480/960/1600 widths plus a JPEG fallback. `render.js` outputs `<picture>` with `srcset`/`sizes`, plus `width`/`height` on every image.
- Logo: export as WebP/SVG under 25 KB. Keep a 32/180px PNG for the favicon and apple-touch-icon.
- Delete `beauty-portrait.jpg`.
- Change admin uploads to produce WebP at a maximum of 1600px.
- ✅ Accept when:
  - first page weight is ≤ 350 KB on mobile;
  - Lighthouse mobile scores Performance ≥ 90 and CLS < 0.05;
  - the images look the same.

**T5. Readable, merged CSS and JS** (F4, F5)
- Turn the CSS into a readable source file split by section (`base`, `header`, `hero`, `launchpad`, `fields`, `careers`, `destinations`, `journey`, `form`, `faq`, `footer`, `motion`).
- Bundle and minify at build time (lightningcss or esbuild) into a single `site.[hash].css`.
- Merge `app-v3.js`, `layout-v2.js`, `layout-v4.js`, `languages.js` and `lotus-form.js` into ES modules with meaningful names. Build them into one file loaded with `defer`.
- Remove `!important` and override rules where you can.
- Fonts:
  - move them out of `@import` into `<link rel=preconnect>` plus a stylesheet link;
  - use `display=swap`;
  - load only the weights that are actually used.
- Preload the hero image.
- ✅ Accept when:
  - screenshot diffs VI/EN × 1280/390 differ by < 0.5% of pixels (outside animated areas);
  - LCP is ≤ 2.5s on mobile in Lighthouse;
  - there are no leftover `v2/v3/v4/v5` files.

**T6. Harden the admin page** (F10)
- Move the JS to `admin/admin.js`. Add a CSP meta tag:
  - `default-src 'self'`
  - `script-src 'self'`
  - `connect-src 'self' https://api.github.com`
  - `img-src 'self' data: blob: https:`
  - `frame-src 'self'`
  - fonts from Google, or self-hosted.
- Token:
  - store it in `sessionStorage` by default, and in `localStorage` only when the user ticks "Ghi nhớ";
  - read the `github-authentication-token-expiration` header and warn when fewer than 7 days are left.
- Preview iframe:
  - use `sandbox="allow-scripts"` without `allow-same-origin`;
  - handle scrolling to a section via `postMessage`.
- ✅ Accept when:
  - the admin test in T3 still passes;
  - code inside the iframe cannot read `localStorage` from the admin page (add a test).

**T7. Keep the form reliable** (F12)
- Save answers to `sessionStorage` as the user goes and restore them after a reload. Clear them after a successful submit.
- Retry automatically once on a network error or HTTP 5xx; never retry on 4xx.
- When it still fails, show a "Gửi qua Zalo" button that opens `zalo.me/<zalo>` and copies a text summary of the answers.
- Do not change the payload.
- ✅ Accept when there are tests for retry, restore and the Zalo fallback.

**T8. Security meta for the site** (F15)
- Add a CSP meta tag for the site (`connect-src` limited to the CRM) and `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- Write a note in `docs/` on putting Cloudflare in front for real HTTP headers. **Needs the owner's decision.**
- ✅ Accept when the site and the form work and the console shows no CSP errors.

---

### P2: Content, SEO, accessibility, measurement

**T9. Bring the form copy and policy into `content.json`, add an EN policy page** (F8)
- Move all form copy (labels, options, thank-you message) and the policy body into `content.json`, with the same values.
  - The **values sent to the CRM** stay fixed and are not editable in the admin page.
- Create `/en/data-policy.html`, translated faithfully, and put `<!-- CẦN LUẬT SƯ DUYỆT -->` at the top of the PR.
- The EN form links to the EN policy.
- The admin page gets "Form tư vấn" and "Chính sách dữ liệu" sections.
- ✅ Accept when VI is byte-identical before and after (apart from markup the task requires), and the new sections can be edited in `/admin`.

**T10. SEO** (F13)
- Add JSON-LD for `Organization` (name, logo, telephone from content, `sameAs` left empty for the owner to fill) and `FAQPage` from `faq.items`.
- Add a 1200×630 OG image built from the hero image and the logo, and Twitter card meta.
- Add a bilingual `404.html`, an apple-touch-icon and `site.webmanifest`.
- Generate the sitemap at build time, with `lastmod`.
- ✅ Accept when the Rich Results Test shows no errors and link previews on Facebook and Zalo show the right image.

**T11. Accessibility** (F9)
- Fix the 3 contrast errors (`.route-targets small` and friends) with the smallest possible color change, keeping the Lotus brand. Fix the admin login button contrast and add landmarks to the admin page.
- Return focus to the button after the dialog closes. Check the keyboard flow of the form.
- ✅ Accept when axe reports 0 serious or critical issues on `/`, `/en/` and `/admin/`.

**T12. Admin improvements** (F11)
- Unused images: when publishing, list images in `assets/uploads/` that the content no longer uses and offer to delete them in the same commit.
- Require `alt` (VI) for new images.
- Add a "Nhân bản" (duplicate) button for list items.
- Add soft character counters for headings and descriptions.
- Add a "Lịch sử" panel: the last 10 commits that touched `content.json`, each with a "Khôi phục bản này" button that brings back that version as a draft.
- ✅ Accept when these actions are covered by the T3 tests.

**T13. Analytics with consent** (F14). **Needs the owner's decision** (GA4 or Plausible or Umami).
- Add a light consent banner (VI/EN) that respects Decree 13/2023, off by default.
- Track these events:
  - `form_start`
  - `form_step` (1–4)
  - `form_submit_success` (no personal data)
  - `zalo_click`
  - `hotline_click`
  - `dialog_open` (destination/field)
- Settings go in `content.json` (`analytics.enabled`, `analytics.provider`, `analytics.id`), editable in `/admin`.
- ✅ Accept when nothing loads while the setting is off, no scripts load before the user accepts, and no event contains a name, phone number or email.

**T14. Clean-up and documentation** (F7)
- Delete `render.yaml` (or move it to `docs/` if the owner wants to keep a Render backup).
- Update the README for the new build flow, tests and admin page.
- ✅ Accept when the README matches reality.

## 4. Suggested order

`T1 → T2 → T3` (foundations; one PR each) → `T4, T5` (in parallel) → `T6, T7, T8` → `T11` → `T9, T10, T12` → `T13` (after the owner decides) → `T14`.
