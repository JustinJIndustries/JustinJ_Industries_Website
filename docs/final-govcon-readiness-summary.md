# Final GovCon Readiness Summary

Date: 2026-05-09

## 2026-10-12 portfolio refresh (local review branch)

- Replaced generic stock photography on the homepage with reviewed screenshots
  of UAid Direct and Metro Credit Union work, plus a first-page image from a
  Northside Looker Studio portfolio demo. The Northside page visibly labels its
  figures as synthetic sample data.
- Added `work.html` with specific project scope and attribution. UAid Direct
  is described as a regional USA/Ukraine WordPress multisite with custom
  homepage/news templates, 11 reusable ACF layout choices, and
  English/Ukrainian Help content only. Metro is described as in-house website
  strategy, development, and support work in collaboration with agency partners.
- Clarified full website builds, redesigns, ongoing support, GA4/GTM
  implementation, Adobe Analytics QA, and Looker Studio reporting on the
  homepage. No client performance claims or procurement credentials were added.
- Replaced the Government Buyers stock image with a CSS delivery diagram so
  named commercial work is not implied to be government past performance.
- Added the new page and reviewed assets to the deterministic public build
  allowlist, sitemap, and accessibility check list.
- Final local QA: `npm run check` passed (HTML, links, Pa11y on all four
  pages, and formatting); the copied public build produced exactly 13
  allowlisted files. Browser review covered 1440px, 375px, and 320px layouts,
  working images, mobile menu Escape/focus restoration, no-JavaScript
  navigation, and reduced motion. The capability statement printed as two
  unclipped Letter pages.
- Review correction: replaced the Metro centennial carousel screenshot with
  the public “Paying for College” homepage slide already used in the
  portfolio. The project wording describes collaborative work with agency
  partners without claiming authorship of that specific slide.
- Owner copy correction: removed the agency name and personal-name attribution
  from Selected Work, and expanded project contribution bullets. Metro bullets
  describe Craft CMS, website support, GA4/GTM reporting, SEO, and location
  work. The public copy identifies Metro as prior in-house employment experience
  rather than a JustinJ Industries client engagement.
- Image review correction: the Metro portfolio visual now pairs genuine
  navigation and “Paying for College” slide captures. Both captures are public
  site imagery, and the caption discloses that they are separate screenshots.
  The final crop excludes the utility navigation and lower page section. Its
  on-screen frame matches the other portfolio images without stretching.

## 0. Owner-data integration update (Projects canonical copy)

- Owner-data integration applied to the project repository
- QA output reviewed and issue list applied to public HTML and scripts
- Public procurement copy standardized:
  - Added legal/public naming where appropriate
  - Standardized "Procurement profile available upon request."
  - Added "Capability statement available online."
  - Added "Reported metrics require owner verification before procurement use."
- QA scripts updated in `package.json` (`check:links`, `check:a11y`, `check:format`, and added `format`)
- Git hygiene updates added to `.gitignore` (`.DS_Store`, `*.xcuserstate`, `*.xcuserdatad/`, `JJI-Workspace-*/`)
- Files changed in this pass:
  - `index.html`
  - `government-buyers.html`
  - `capability-statement.html`
  - `script.js`
  - `package.json`
  - `.gitignore`
  - `docs/owner-data-needed.md`
  - `docs/final-govcon-readiness-summary.md`
- Remaining checks to run (not run in this session):
  - `npm run check:html`
  - `npm run check:links`
  - `npm run check:a11y`
  - `npm run check:format`
  - `npm run check`

## 0.1 QA follow-up on 2026-05-09

- Fixed the remaining html-validate issue in `index.html` by removing an unnecessary `aria-label` from the hero badges list.
- Ran `npm run format` and applied repository formatting updates.
- Resolved validator/formatter rule conflict by aligning `.htmlvalidate.json` with Prettier output (`doctype-style` and `void-style` set to off).
- Shortened Government Buyers page `<title>` to satisfy title-length validation.
- Re-ran checks:
  - `npm run check:html` ✅ pass
  - `npm run check:format` ✅ pass
- Remaining runtime limitations (environment-level, not content-level):
  - `check:links` link crawl succeeds, but process exits with `spawn EPERM` during test-server shutdown.
  - `check:a11y` fails to launch browser process for Pa11y in this environment and also reports `spawn EPERM` on shutdown.
- Manual accessibility fallback executed in the same repo:
  - Local server started successfully with `npm run serve`
  - Manual Pa11y WCAG2AA checks executed successfully:
    - `npx pa11y http://127.0.0.1:8080 --standard WCAG2AA --timeout 120000` → `No issues found!`
    - `npx pa11y http://127.0.0.1:8080/government-buyers.html --standard WCAG2AA --timeout 120000` → `No issues found!`
    - `npx pa11y http://127.0.0.1:8080/capability-statement.html --standard WCAG2AA --timeout 120000` → `No issues found!`
- Conclusion: manual page-level Pa11y checks across all three local pages reported no WCAG2AA findings; the `npm run check:a11y` failure is currently a local runtime/browser automation limitation, not a detected accessibility issue from that script execution.

## 0.2 Maintenance refresh on 2026-06-28

- Refreshed homepage positioning around practical web development, WordPress
  support, analytics tagging/QA, documentation, small-business support, and
  modest AI-assisted workflow support.
- Replaced high-marketing homepage language such as "Bulletproof analytics" and
  broad growth positioning with more direct headcount-focused positioning.
- Removed public numeric outcome claims from homepage, Government Buyers page,
  and capability statement until owner-approved evidence is available.
- Reframed "Recent Work" and procurement examples as representative,
  anonymized project patterns rather than client results, testimonials, or
  guarantees.
- Updated contact copy to support general service inquiries while preserving
  procurement inquiry paths and existing Formspree behavior.
- Updated README project documentation to reflect the current static-site
  architecture and QA commands.
- Safe dependency refresh performed within existing semver ranges for
  `html-validate` and `prettier`; major QA-tool upgrades were intentionally not
  applied.

## 0.3 Adobe analytics positioning update on 2026-06-28

- Added Adobe Analytics and Adobe Experience Platform to homepage service
  positioning without changing the hero headline.
- Updated analytics/tagging service copy to mention Adobe Analytics, AEP, GA4,
  GTM, data layer review, event QA, tracking cleanup, and implementation
  documentation.
- Added conservative public-sector/capability language for Adobe Web SDK, Adobe
  Tags/Launch, Edge Network event validation, XDM/data layer alignment, and QA
  documentation.
- No Adobe certifications, enterprise ownership claims, client names, metrics,
  or guaranteed outcomes were added.

## 1. What changed

The site was expanded from a general one-page portfolio to a procurement-aware public presence with:

- Government Buyers section and procurement-oriented CTAs
- Capability statement page with print-friendly layout
- Expanded contact flow for RFQ/RFP, sources-sought, and subcontracting inquiries
- Accessibility statement and keyboard/focus/menu improvements
- Privacy and responsible measurement messaging
- Procurement-safe case-study framing with confidentiality disclaimer
- Internal docs for owner-supplied data, measurement, privacy/analytics, accessibility, and backend setup
- Launch-blocker fixes: indexability updates, `robots.txt`, `sitemap.xml`, structured data, and removal of public owner placeholders

## 2. Files changed

Public-facing:

- `index.html`
- `styles.css`
- `script.js`
- `capability-statement.html`
- `government-buyers.html`
- `robots.txt`
- `sitemap.xml`
- `package.json`
- `.htmlvalidate.json`
- `.gitignore`

Internal docs:

- `docs/accessibility-notes.md`
- `docs/contact-flow-backend-setup.md`
- `docs/measurement-plan.md`
- `docs/owner-data-needed.md`
- `docs/privacy-and-analytics-notes.md`
- `docs/final-govcon-readiness-summary.md`
- `docs/govcon-readiness-audit.md`
- `docs/qa-toolchain.md`
- `docs/opportunity-intake-checklist.md`
- `capture/README.md`
- `capture/opportunity/README.md`
- `capture/opportunity/.gitkeep`

## 3. Tests/checks run

Tooling checks:

- Lightweight QA toolchain added for static site checks via `npm` scripts:
  - `check:html`
  - `check:links`
  - `check:a11y`
  - `check:format`
  - `check`
- Attempted runtime execution was interrupted due local permission/runtime constraints in this environment, so tool output could not be captured in this session.

Manual QA review performed:

- Internal links and anchor navigation reviewed in `index.html`
- Anchor targets verified: `#government-buyers`, `#contact`, `#privacy`, `#accessibility`
- Government Buyer CTAs route to contact flow and capability statement
- Capability statement links and mailto links reviewed
- Contact form required fields, labels, and status messaging reviewed
- Keyboard/focus implementation reviewed (focus ring, skip link, mobile menu focus flow)
- Metadata and Open Graph tags reviewed
- Capability statement print styles reviewed in source (`@media print`)
- Truthfulness and placeholder review completed
- Public placeholder sweep completed (`Owner-supplied`, `placeholder`, `TBD`, `TODO`, `sample`, `fake`, `candidate NAICS`)
- Script review for third-party tracking and PII handling completed

Limitations:

- No automated browser tests, linting, or runtime console capture available in repo
- No automated accessibility scanner configured

## 4. Issues fixed

- Added procurement-friendly nav/section/CTAs and contact flow fields.
- Added accessible form status region and improved validation behavior.
- Added privacy/data-use notice and privacy/measurement section.
- Added focus-visible styles and improved mobile menu accessibility behavior.
- Added capability statement page and print-friendly behavior.
- Added owner-data placeholders for procurement-sensitive fields.
- Added measurement and privacy documentation with PII guardrails.
- Reframed case studies for procurement relevance without disclosing confidential clients.
- Removed public `noindex/nofollow` launch blockers from homepage metadata.
- Added `robots.txt` and `sitemap.xml` for crawlability.
- Added JSON-LD structured data (`Organization`, `WebSite`, `ProfessionalService`) to public pages.
- Updated homepage and capability statement metadata descriptions for production discoverability and procurement relevance.
- Added Open Graph metadata to capability statement page and aligned canonical/sitemap URL to `capability-statement.html`.
- Added standalone `government-buyers.html` page with procurement-focused content and shareable URL.
- Updated homepage/footer/capability-statement links to route to standalone Government Buyers page while preserving homepage Government Buyers section.
- Added `government-buyers.html` to sitemap.
- Removed public-facing procurement placeholders (`Owner-supplied`) and candidate-code placeholder language from capability statement/public procurement copy.
- Standardized internal documentation location under `docs/` including `docs/govcon-readiness-audit.md`.
- Added lightweight static-site QA toolchain configuration (`package.json`, `.htmlvalidate.json`, `docs/qa-toolchain.md`) without introducing a build pipeline.
- Added safe opportunity-document intake structure under `capture/` with default-ignore protections and checklist documentation (`docs/opportunity-intake-checklist.md`).

## 5. Remaining issues

Medium priority before outreach:

1. Manual screen-reader, mobile-device, and print-preview checks still required per `docs/accessibility-notes.md`.
2. Formspree backend configuration verification still required per `docs/contact-flow-backend-setup.md`.
3. Owner-approved evidence is required before reintroducing any numeric case-study outcomes.

## 6. Owner-supplied data still needed

From existing docs, key unresolved owner inputs include:

- UEI
- CAGE
- SAM registration status
- NAICS codes (final approved list)
- PSC codes
- Certifications / socioeconomic designations (if any)
- Contract vehicles (if any)
- Insurance statement approved for public posting
- Clearances status (if intended to publish)
- Government past performance approved for public use (if any)
- Procurement contact email override (only if a different address is desired)
- Verification evidence for any future numeric case-study claims before they are reintroduced publicly

## 7. Recommended next step before outreach

Execute a final owner review pass focused on:

1. Supplying and approving procurement profile data and metric evidence.
2. Approving tone adjustments for government-facing headline language.
3. Confirming Formspree routing/retention and contact handling.
4. Running manual accessibility checks on target devices and browsers.

---

## Pull Request Summary

### Problem

The website needed to be made procurement-ready for government buyers and prime contractors while preserving truthfulness, accessibility, and confidentiality.

### Solution

Added reusable public-sector positioning, procurement-friendly contact flow, capability statement output, privacy/measurement guardrails, and supporting documentation for owner-supplied procurement data and QA requirements.

### Key pages changed

- `index.html`
- `capability-statement.html`
- `styles.css`
- `script.js`
- `docs/*` readiness documentation

### Verification

- Static review of semantics, links, form behavior, accessibility patterns, metadata, and print CSS.
- Repository checked for build/test toolchain; none found.
- Truthfulness review completed for govcon-sensitive claims and placeholders.

### Follow-up tasks

1. Provide owner-supplied procurement identifiers and approvals.
2. Run manual screen-reader/mobile/print QA.
3. Confirm Formspree backend routing and retention settings.
4. Finalize government-facing headline tone and claims evidence package for outreach.

---

## 2026-07-15 design polish update

### Scope completed

- Refined the shared header, navigation, buttons, cards, section surfaces, contact form grouping, and footer without changing the static-site architecture.
- Corrected the 721–900px homepage hero cascade so both public landing-page heroes preserve the established eyebrow, headline, image, supporting-copy, and CTA order.
- Moved the mobile-navigation transition to 900px to prevent the confirmed tablet-width overflow and added menu scroll locking plus resize cleanup.
- Improved service-category differentiation, Government Buyers content grouping, procurement-card legibility, responsive CTA wrapping, and 320px footer/header behavior.
- Brought the screen version of the capability statement closer to the shared visual system while preserving its standalone print layout.
- Added a current-page navigation state, sticky-header anchor offsets, stronger light-theme form-status contrast, progressive reveal fallback, reduced-motion behavior, and a capability-statement skip link.

### Constraints preserved

- No services, clients, results, metrics, certifications, procurement identifiers, registrations, contract vehicles, or government past performance were added.
- Existing routes, URLs, IDs, classes, analytics event values, inquiry values, form field names, Formspree configuration, structured-data values, and image paths were preserved.
- Company-first positioning and the public procurement fallback “Procurement profile available upon request.” remain unchanged.
- No analytics vendor, framework, dependency, or public personal information was added.

### Verification completed

- `npm run format` — passed.
- `npm run check` — passed, including HTML validation, recursive link checking, Pa11y WCAG 2 AA checks for all three public pages, and formatting verification.
- Final diff and protected-value checks — passed.

### Visual QA completed

- Completed rendered-browser review of all three public pages at 1440 × 900, 1024 × 768, 900 × 900, 834 × 1112, 768 × 1024, 390 × 844, and 320 × 568, including light and dark appearance on pages that support theme switching.
- Confirmed responsive layout, mobile-menu scroll locking and resize cleanup, keyboard focus, reduced-motion behavior, no-JavaScript fallback visibility, and sticky-header anchor clearance.
- Corrected the shared smooth-scroll handler so the public-page skip links preserve native keyboard bypass behavior.
- Confirmed the capability-statement print output remains exactly two pages in color and grayscale with screen-only controls hidden and no clipped or overflowed content.

## 2026-07-15 active-navigation update

### Scope completed

- Extended the existing Government Buyers current-page treatment to support both `aria-current="page"` and `aria-current="location"` in the shared desktop and mobile navigation.
- Added one homepage section-state controller for the existing `#work`, `#services`, `#results`, `#about`, and `#contact` destinations. The unlinked homepage `#government-buyers` teaser remains distinct from the separate Government Buyers page.
- Added direct-hash initialization, sticky-header-aware observer and animation-frame-throttled scroll tracking, final-section handling, synchronized desktop/mobile state, smooth-scroll flicker prevention, and browser back/forward support.
- Preserved the static Government Buyers page state in both navigation variants. The standalone capability statement has no shared navigation, so no unrelated item is marked current there.
- Added a compact no-JavaScript navigation fallback at mobile and tablet widths so the existing links remain usable when the hamburger controller is unavailable.

### Constraints preserved

- Public HTML, routes, IDs, classes, href values, analytics event values, inquiry values, form field names, Formspree configuration, structured data, public content, and image paths remain unchanged.
- No dependency, framework, analytics vendor, inline JavaScript style, procurement claim, or public content was added.
- Existing theme, focus, skip-link, mobile-menu, scroll-lock, Escape, focus-trap, and resize-cleanup behavior was preserved.

### Verification completed

- `npm run format` and `npm run check` passed. The aggregate check included HTML validation, an 18-link recursive crawl, Pa11y WCAG 2 AA checks with no findings on all three public pages, and formatting verification.
- Rendered-browser functional QA passed at 1440 × 900, 1024 × 768, 900 × 900, 768 × 1024, 390 × 844, and 320 × 568 in light and dark appearances.
- Verified all five tracked homepage sections, direct hashes, desktop and mobile link selection, browser back/forward, fast and long scrolling, the final Contact section, reduced motion, keyboard selection, focus trapping, Escape closing, mobile-to-desktop resize cleanup, and zero console or page errors.
- Verified visible keyboard focus on the skip link and native navigation to `#main` without interception by the smooth-scroll controller.
- Verified no-JavaScript native section navigation at 900, 390, and 320 pixels and static Government Buyers current-page styling at mobile width.
- Representative captures are stored under `Build/visual-acceptance/2026-07-15/navigation-active-state/`; `Build/` remains ignored.

## 2026-07-15 Contact active-state refinement

### Scope completed

- Replaced the active underline on the desktop and mobile “Let's Talk” navigation CTA with a full-button, two-pixel inset outline using the existing `--brand` accent.
- Preserved the CTA gradient, text color, rounded shape, dimensions, hover elevation, pressed state, and the separate external `:focus-visible` outline.
- Left the standard navigation active treatment, Government Buyers current-page state, and active-section JavaScript unchanged.

### Verification completed

- `npm run format` and `npm run check` passed. The aggregate check included HTML validation, an 18-link recursive crawl, Pa11y WCAG 2 AA checks with no findings on all three public pages, and formatting verification.
- Protected-file and value checks confirmed that public HTML, JavaScript, dependencies, routes, IDs, classes, href values, analytics values, forms, Formspree configuration, structured data, public content, and image paths remain unchanged.
- Playwright MCP rendered-browser QA passed for the Contact-active “Let's Talk” CTA at 1440 × 900, 1024 × 768, 900 × 900, 768 × 1024, 390 × 844, and 320 × 568 in light and dark appearances. The inset active outline remained visible without a detached underline, clipping, overflow, or layout shift through hover, pressed, and focus-visible states.
- Direct-hash loading, browser back/forward, fast scrolling, desktop/mobile synchronization, reduced-motion behavior, skip-link keyboard behavior, hamburger Escape closing, scroll-lock cleanup, mobile-to-desktop resize cleanup, and console/page-error checks passed.
- Representative captures are stored under `Build/visual-acceptance/2026-07-15/contact-active-outline/`; `Build/` remains ignored.

## 2026-07-15 final production-readiness audit

### Scope completed

- Audited the public repository, the current GitHub Pages artifact, the production
  origin, and the browser-delivered resource inventory as separate exposure
  surfaces.
- Confirmed that the production origin does not serve the repository's internal
  documentation, package metadata, tooling, workspace files, Sites metadata, or
  ignored QA evidence at the tested paths.
- Confirmed that the current Pages artifact contains the nine required public
  site files plus two non-required files: the repository license and an
  unreferenced generated stylesheet.
- Prepared, but did not implement, an exact allowlisted public-artifact model for
  separate owner review. GitHub Pages settings, the custom domain, deployment
  workflow behavior, and OpenAI Sites metadata remain unchanged.
- Preserved the approved Boston-based, Massachusetts/United States, and
  remote-service positioning, including locality-only structured data. No street
  address, postal code, personal phone number, or more precise location was added.

### Confirmed corrections

- Strengthened light-appearance accent contrast, shared focus visibility, form
  control boundaries, and the consent checkbox target without redesigning the
  interface.
- Marked duplicated brand imagery and generic stock-card imagery as decorative,
  and removed the hidden spam-control field from the accessibility tree.
- Added readable no-JavaScript footer-year fallbacks, hid controls that require
  JavaScript when scripting is unavailable, and added reveal-content fallbacks
  for unsupported observers and print.
- Reconciled the documented analytics examples with the exact event values that
  are present in the public HTML. Runtime analytics values and form behavior were
  not changed.
- Updated accessibility documentation to reflect the repository's actual
  automated checks and the remaining need for manual assistive-technology review.

### Verification completed

- `npm run format`, `npm run check`, `node --check script.js`, and
  `git diff --check` passed. No `build` script currently exists.
- The aggregate check passed HTML validation, an 18-link recursive crawl,
  Pa11y WCAG 2 AA checks on all three public pages, and formatting verification.
- A 45-case rendered Chromium matrix passed across three pages and 15 viewport
  sizes with no horizontal overflow, small controls, console errors, page errors,
  failed requests, or non-successful local resource responses.
- Keyboard, active-navigation, mobile-menu, no-JavaScript, reduced-motion,
  125/150/200% zoom, 200% text sizing, and two-page print checks passed.
- The axe runner produced contrast-only manual-review flags because the shared
  page background uses layered gradients. After excluding that rule, axe found
  no other issues; affected contrast tokens were measured independently and the
  confirmed failures were corrected.

### Readiness decision and owner actions

- The reviewed local source has no known visual, interaction, content, or
  automated-accessibility blocker within the tested Chromium scope.
- The production URL is not yet ready for broad government-buyer distribution:
  the local corrections are not deployed, and the current root-source Pages
  artifact does not enforce the recommended exact public-file boundary.
- Owner approval is required before adding the deterministic allowlisted build or
  changing the Pages workflow. A later review should also decide whether tracked
  internal documentation should remain visible in the public GitHub repository.
- Manual screen-reader testing and WebKit/Firefox review remain documented
  limitations because those environments were unavailable during this audit.

## 2026-07-15 neutral company-positioning update

### Selected wording

- Homepage hero: "JustinJ Industries provides web development, WordPress
  support, analytics QA, documentation, and workflow support."
- Homepage About: "JustinJ Industries provides front-end development, CMS
  support, analytics tagging, QA, and documentation. Work emphasizes clear
  evidence and continuity."
- Homepage continuity bullet: "Clear documentation and handoffs"
- Capability-statement differentiator: "Responsive project support"
- The June 28 historical summary now describes the retired wording as
  "headcount-focused positioning"; no unrelated history changed.

### Approved responsive wraps

- The owner accepted the 1024 x 768 hero wrap:
  `JustinJ Industries provides web development, WordPress` /
  `support, analytics QA, documentation, and workflow` / `support.`
- The owner accepted the 900 x 900 continuity-bullet wrap:
  `Clear documentation and` / `handoffs`.
- Single-word final lines in normal paragraphs and list items are evaluated as
  part of the overall composition. Headings, buttons, and short labels must
  remain intact; punctuation-only lines, clipping, overlap, horizontal overflow,
  severe readability defects, layout shifts, and material card imbalance remain
  failures.

### Local validation

- `npx http-server dist -p 8085 -c-1` served only the generated artifact at
  `http://127.0.0.1:8085/`.
- Dedicated Playwright MCP reviewed the homepage at 1440 x 900, 1280 x 800,
  1024 x 768, 900 x 900, 768 x 1024, 430 x 932, 390 x 844, 375 x 812, and
  320 x 568, and the capability statement at 1440 x 900, 1024 x 768,
  768 x 1024, 390 x 844, and 320 x 568. Additional 901, 861, and 860 px
  boundary checks verified the navigation, hero, and trust-card transitions.
- Light and dark modes, 200% reflow, JavaScript-disabled and reduced-motion
  states, the mobile menu, active navigation, Contact CTA outline, keyboard
  focus, theme switching, and skip navigation passed. Apart from the two
  owner-approved body-copy wraps, no heading or CTA-label orphan, clipping,
  overlap, horizontal overflow, excessive empty space, material card imbalance,
  console or page error, or failed required request was observed.
- The capability-statement PDF remained exactly two US Letter pages with no
  clipped or awkwardly split content.
- `npm ci`, `npm run format`, `npm run check`, two consecutive
  `npm run build` runs, `node --check script.js`,
  `node --check scripts/build-public.mjs`, and `git diff --check` completed
  successfully. The build inventories matched, `dist/` contained exactly the
  approved nine files, and every artifact matched its source.

### Constraints preserved

- No unverified organizational scale, subcontractor network, partner capacity,
  or delivery-capacity claim is stated or implied.
- Existing routes, IDs, classes, hrefs, analytics event values, form values,
  Formspree configuration, structured data, approved procurement-profile and
  locality wording, image paths, and public-artifact boundaries remain
  unchanged.

### Production verification

- Production results are not claimed in this pre-deployment source record. The
  deployed SHA, workflow result, live-page browser and PDF checks, and
  nine-file/404 boundary verification are recorded in the post-deployment
  handoff.

## 2026-10-13 local website catalogue and enquiry preview

- Added a static-site design catalogue and detail view for four explicitly
  fictional concepts: Alder & Lane, Harbor Ledger, Still Form, and AER/FIELD. Each
  detail view offers keyboard-accessible example-page tabs. Alder & Lane and Harbor
  Ledger are tied to the owner-specified fixed starting scopes; Still Form and
  AER/FIELD are custom-scope examples with quote-required language.
- Added a four-step, nonbinding project-enquiry dialog with project, content,
  timing/contact, and review steps. It supports Back, field errors, focus return,
  Escape/discard confirmation, a mobile layout, and retry without data loss.
  The form posts to the existing Formspree endpoint only after explicit review
  and consent. No new tracking or storage of enquiry answers was added.
- A host-permitted retrieval of the owner-supplied source archives made safe
  public-facing assets available. The preview now embeds Alder & Lane's four
  original static sample pages, shows a Harbor Ledger demonstration capture,
  and uses a credited Still Form photograph plus two credited AER/FIELD poster
  frames. Private runtime files, source archives, credentials, and AER/FIELD's
  partial screenshots were not included in the public allowlist. Source and
  license details are in `docs/catalogue-media-credits.md`.
- Local validation: `node --check design.js`, HTML validation, formatting,
  allowlisted build, Git diff whitespace check, a 21-link site crawl, and a
  seven-link Alder & Lane sample crawl passed.
  Safari verified catalogue navigation, example-page switching, field errors,
  Back/review, discard confirmation, and the 390 × 844 responsive view. A
  separate local mock returned HTTP 503 then HTTP 200; the dialog preserved
  answers on failure and showed success only after the successful retry.
- `npm run check:a11y` and aggregate `npm run check` were not run because their
  Pa11y setup launches Chrome, while this task required Safari-only local UI
  verification. Manual assistive-technology review remains open.
- The Formspree endpoint is present in source, but recipient configuration and
  actual delivery to `info@justinjindustries.com` remain unverified. No live
  submission was sent. The owner should review the local preview and complete
  inbox verification before a public deployment. No deployment was performed.

### Multi-page WordPress concept preview follow-up

- Inspected the owner-supplied WordPress source archives before rendering.
  Harbor Ledger contains the five public Gutenberg page bodies, site-level CSS,
  and generated workspace photos. Still Form and AER/FIELD contain public theme
  templates, seed copy, CSS, and credited media. Built static, noindex Home,
  Services, About/Studio, Work/Projects, and Contact studies from those sources;
  Harbor Ledger also has FAQ. The detail-page tabs now embed these actual
  multi-page static layouts rather than generic illustrated cards.
- Static studies omit WordPress runtime, admin code, credentials, video
  playback, project-detail routes, and form submission. Demo forms are visibly
  inactive. Source media attribution is retained in the studies and
  `docs/catalogue-media-credits.md`. Original source demos were not changed.
- The 62-file public allowlist build, root and nested HTML validation,
  formatting, JavaScript syntax, and Git whitespace checks passed. Local link
  crawls found no broken routes across the main site and the three new sample
  roots (20, 9, 11, and 13 checked links respectively). Safari verified the
  multi-page layouts at 390 px and 1200 px widths, including AER/FIELD's mobile
  menu and the project grids.
- Safari showed Formspree Sign in when opening the existing form dashboard URL;
  no logged-in read-only access was available. Recipient configuration and
  inbox delivery remain unverified; no live enquiry was sent.

### 2026-10-14 M1 Max local review

- Confirmed the intended M1 Max checkout remains at deployed commit
  `db01f668c428c95ede5303be6ec417c4a38ea902` with the catalogue work
  uncommitted. No unrelated files were changed, and no commit, push, or
  deployment was made.
- Safari displayed the Harbor Ledger detail page and source-based Home preview.
  At a 390 px window width, the detail page and enquiry dialog fit without
  horizontal overflow. Keyboard Return opened the dialog, focus reached its
  step heading, and leaving the required project goal empty produced a visible
  error and focused the field. Escape closed the untouched dialog and restored
  focus to its trigger.
- Root and nested HTML validation, formatting, JavaScript syntax, the 62-file
  public allowlist build, Git whitespace check, a local 21-link site crawl,
  and all four sample-route crawls passed. Unsplash credit links returned
  HTTP 401 to the automated crawler, so the Still Form local-route pass
  excluded those external pages while keeping their attribution links.
  The repository's link script could not bind its default port under
  the sandbox, so the same crawler was run against the active local server.
  Pa11y and the aggregate check were not run because Pa11y launches Chrome.
- The Formspree dashboard URL again redirected Safari to Sign in. Recipient
  configuration and inbox delivery remained unverified at this point; no live
  enquiry was sent. The owner subsequently confirmed $1,999 as the direct-site
  WordPress package price, which is reflected in the next update below.

### 2026-10-14 owner-confirmed WordPress price

- Updated the defined-scope WordPress package from $2,500 to the owner's
  confirmed $1,999 throughout the catalogue, concept details, and enquiry
  service choice. Page counts, content limits, revisions, timing, and custom
  quote boundaries remain unchanged.
- A subsequent signed-in, read-only Safari check of Formspree form `mgvlrzdq`
  confirmed that the form, email notifications, submission archive, and
  Formshield are enabled. Its Target Email setting is blank. The Formspree
  account lists only `jfelix@justinjindustries.com` as a linked, verified
  address; `info@justinjindustries.com` is not linked or selected. The owner
  needs to add and verify the business inbox, select it as this form's Target
  Email, save, and coordinate a minimal live receipt test before launch. No
  Formspree settings were changed and no live submission was sent.

### 2026-10-14 Harbor Ledger card sizing follow-up

- The owner clarified that the Harbor Ledger catalogue preview looked
  oversized. Its source capture is 920 × 2332 pixels; the card image had width
  and aspect-ratio styling but retained a tall intrinsic height. The image now
  sits in a dedicated 16:9 media frame with absolute sizing and `object-fit:
cover`, matching the other three card previews without stretching the image.
- The owner added and verified `info@justinjindustries.com` in Formspree. A
  subsequent M1 Safari window capture shows it as a verified linked email.
  Target Email remains blank. Automatic approval review rejected selecting the
  recipient as a persistent account-routing change despite the owner approval
  conveyed through the parent task. No workaround was attempted and no live
  submission was sent. A directly accepted approval is needed before changing
  the setting and testing delivery.
- M1 Safari window captures confirmed that the revised Harbor Ledger card now
  shares the same 16:9 media height as Alder & Lane at desktop width. A 390 px
  Safari window capture showed the card fitting the narrow column without
  horizontal overflow.

### 2026-10-14 catalogue pricing and wordmark follow-up

- Each catalogue card now states its pricing position beside the concept name:
  $950 for the defined static package, $1,999 for the simple WordPress package,
  and Custom quote for Still Form and AER/FIELD. Their advanced portfolio and
  media behavior is outside the fixed package scope, so no unsupported numeric
  price is promised.
- Removed bold styling from the JustinJ Industries wordmark in the shared
  navigation across the main site and catalogue pages.

### 2026-10-15 M1 Max catalogue and form verification

- Confirmed host `M1-Max-MacBook-Pro`, origin
  `JustinJIndustries/JustinJ_Industries_Website`, and local HEAD `db01f66`.
  The catalogue work remains uncommitted; no push or deployment occurred.
- Safari rendered the local catalogue and Alder & Lane detail preview, including
  a 430 px mobile-width detail view with readable navigation, CTA, page tabs,
  and embedded sample opening. Interactive journey checks from this pass were
  blocked because Safari remote automation was disabled. Automatic approval
  review rejected enabling that persistent Safari setting; no workaround was
  used. Earlier Safari interaction checks remain recorded above.
- HTML validation, formatting, JavaScript syntax, the root 21-link crawl, and
  Git whitespace checks passed. Pa11y and the aggregate check were not run
  because they launch a non-Safari browser. The public build was not rerun
  because its script replaces the existing ignored `dist` directory.
- Read-only Safari inspection found the Formspree form and email notifications
  enabled, with `info@justinjindustries.com` selected as Target Email. The
  dashboard showed zero submissions in the last 30 days before testing. One
  approved synthetic test sent at 18:39 UTC returned HTTP 200 with `ok: true`,
  and the 30-day dashboard count increased to one. The test was sent directly
  to the endpoint, not through the browser journey. The owner later reported
  that no notification reached the `info@` mailbox; the follow-up below traces
  the test to Formspree's Spam tab.

### 2026-10-15 example-page label and Safari interaction follow-up

- At the owner's request, changed the four catalogue detail-page type labels
  from `fictional demonstration` to `DEMO` and the 15 Harbor Ledger, Still Form,
  and AER/FIELD preview banners from `FICTIONAL DEMONSTRATION` to `DEMO`.
  Alder & Lane's existing `SAMPLE SITE` banner and all explanatory disclosures
  remain unchanged.
- Safari confirmed the revised Alder detail label and the Harbor Ledger, Still
  Form, and AER/FIELD banners render clearly. The AER/FIELD banner also fits at
  430 px mobile width.
- Permitted Safari screen and keyboard input verified that the enquiry opens
  with focus on its step heading, a missing goal shows a visible error and
  focuses the field, a synthetic goal advances to step 2, Back retains the
  answer, Escape and the close button offer a discard confirmation for a dirty
  draft, Cancel preserves it, and confirmed discard closes and returns focus to
  the trigger. Reopening starts with an empty goal. Example-page tabs switched
  by click and Arrow Right. Step 2 selections for copy, hosting, and domain
  readiness were made through Safari's native menus. Step 3 showed a date field
  only after selecting a desired date; choosing Flexible hid it. Continuing
  without email or phone showed a visible contact error and focused email.
  The macOS UI connection stopped accepting input at that point, so the final
  review step was checked in the later pass below. No enquiry was
  submitted in this follow-up, and Safari's remote automation setting was not
  changed.

### 2026-10-15 Formspree nondelivery investigation

- The owner reported that the synthetic test did not reach the mailbox.
  Read-only Safari inspection found the record with subject “TEST ONLY — JJI
  catalogue enquiry delivery verification” under Formspree form `mgvlrzdq`'s
  Spam tab, dated October 15, 2026, at 14:39 America/New_York (18:39 UTC).
  The overview showed one spam submission and zero inbox submissions in the
  last 30 days. Safari accessibility identified submission `163104750`.
- The form, submission archive, and email notifications are enabled. The
  selected Target Email is `info@justinjindustries.com`, which appears as
  verified in the account's linked-email list. Formshield is enabled; CAPTCHA
  is disabled. The Rules tab shows an upgrade page, with no custom rule visible.
  Scrolling the stored record exposed `_status` with an unauthorized-domain
  error: the origin did not match `www.justinjindustries.com`. The test was sent
  directly to the endpoint, outside the authorized website origin. Its
  `qa-catalogue@example.com` address and repeated `TEST ONLY` wording are
  synthetic signals, but Formspree did not identify them as the classifier
  reason. The `_website` column was blank; no filled honeypot value was visible.
  No outbound delivery log was shown. The direct HTTP 200 response confirms
  intake, not notification delivery.
- No second test was sent, no spam classification was changed, and no routing or
  spam setting was altered. Before public deployment, coordinate a
  representative submission through the existing public site's browser form
  at `https://www.justinjindustries.com/`, inspect its Formspree classification,
  and confirm inbox receipt. Keep the direct email fallback available while
  delivery remains unverified.

### 2026-10-15 final review-step local QA

- Safari reached step 4 with a synthetic Alder & Lane draft. The review showed
  the selected design and service, pages, entered goal, copy/images and
  hosting/domain readiness, requested feature, timing, and contact. Consent
  was unchecked by default. Back returned to the contact step with the email
  retained; editing it and continuing refreshed the review contact value.
- Close on the review step opened the discard confirmation. Cancel preserved
  the review; confirming discard closed the dialog and returned focus to its
  trigger. No Send action was activated and no enquiry was submitted.
- Source inspection found that the Send button was disabled synchronously while
  sending, but the submit handler lacked an explicit repeat-event guard. Added
  an early return when `sending` or `sent` is true. The guard was verified by
  source inspection and syntax/format checks; no live submission was used to
  test it.

### 2026-10-15 public-site delivery test access blocker

- The owner approved one synthetic test through the existing public contact
  form. Safari reached `https://www.justinjindustries.com/#contact` at about
  15:56 America/New_York but Cloudflare displayed a “Verify you are human”
  challenge before the form loaded (Ray ID `a4b160e198c0012e`). No challenge
  response was attempted, no form field was entered, and no submission was
  sent. The approved test remains unused pending the owner's normal browser
  verification or an already verified Safari session.

### 2026-10-15 owner-confirmed public contact delivery

- The owner completed the normal Safari browser verification, submitted the
  existing public contact form, and reported receiving the notification in the
  `info@justinjindustries.com` inbox. This is owner-confirmed public-origin
  email delivery; the agent did not independently inspect the mailbox or
  establish the Formspree submission ID. The agent's prepared test was stopped
  without submission, and no repeat was sent.
- Safari UI input was slow to prepare because clicks on the message textarea
  did not reliably transfer keyboard focus; one draft field entry landed in the
  adjacent Services field. The page was still unsubmitted when the owner's
  stop instruction arrived. No Formspree settings or public deployment were
  changed. The local catalogue and guided enquiry remain available for review
  at `http://127.0.0.1:8080/catalogue.html`; the catalogue AJAX flow has only
  been tested with a mocked endpoint.

### 2026-10-15 local contact feedback and spacing fix

- After the owner reported that the current public contact form cleared without
  a thank-you message, replaced its Formspree SDK success callback with a
  controlled JSON submission in `script.js`. A response must have both an HTTP
  success and `ok: true` before a dedicated confirmation replaces the form and
  receives keyboard focus. Errors keep the entered values, show a focused
  message, and permit retry. A sending/sent guard prevents duplicate requests.
- The owner's screenshot identified the capability-statement button directly
  above the contact form. Increased the spacing below the contact heading;
  Safari desktop and narrow-window views show a clear gap without changing the
  button or form layout. The screenshot was inspected from the owner-provided
  Library PNG.
- The catalogue enquiry now checks the JSON `ok` value as well as HTTP status
  before showing its existing focused success message. Safari local mock checks
  passed for success, rejection with preserved values, HTTP `200` plus
  `ok: false`, and repeated submit events for both flows. Temporary mock pages
  were removed; no live submission, account change, push, or deployment was
  made in this fix.

### 2026-10-16 clean URL preparation (local only)

- Prepared trailing-slash directory-index routes for all six public pages and
  nineteen fictional preview pages. The build retains `.html` copies until
  Cloudflare 301 redirects can be deployed and verified.
- Updated internal navigation, canonical URLs, structured-data URLs, sitemap,
  preview iframe routes, and asset paths. Existing contact and guided-enquiry
  forms were only checked as UI; no test lead was submitted.
- The signed-in Cloudflare zone showed Free plan and 0 of 10 Single Redirects
  used. No Cloudflare rule or production deployment was changed. The route map,
  redirect proposal, and post-release checks are in
  `docs/clean-url-migration.md`.

### 2026-10-16 public portfolio removal (local only)

- Removed the Metro Credit Union card, project detail, screenshot, image
  descriptions, related metadata, and asset from the deterministic public
  artifact. The screenshot remains only as an unpublished source file.
- The homepage now displays two selected-work cards, and the Work page has two
  project details. No public PDF or other downloadable portfolio material was
  found in the allowlist. Historical internal notes remain under `/docs`, which
  the build excludes.
- This change is prepared locally with the clean URL work. No production
  deployment, redirect, or form submission was performed.

### 2026-10-16 website setup prices and AER/FIELD navigation (local only)

- The owner approved Still Form website setup from $1,695 and AER/FIELD website setup from $1,995. Catalogue cards, design detail scopes, and enquiry choices show these starting prices. Core page setup and styling use client-supplied copy and licensed imagery; pages, platform, timeline, and handoff are confirmed in writing. Portfolio features, filming/video delivery, motion, integrations, and other extras require separate quotes. No price was inserted into the fictional demo frames.
- The AER/FIELD outer controls and inner menus now read Home, Film, Services, About, Contact; existing `/work/` and `/studio/` routes remain as the Film and About destinations. Film detail pages and previous video functionality remain available. Still Form keeps its own Home, Work, Services, About, Contact labels.
- These updates are local only. No commit, push, production deployment, Cloudflare change, or form submission was made.

### 2026-10-16 Designs intro alignment (local only)

- Aligned the Designs catalogue headline and description with the main Work intro's narrower, centered text column, typography, and spacing. Mobile keeps the shared full-width column within the page gutter. The fictional concept cards, prices, and demo navigation remain below the intro.
- No commit, push, deployment, Cloudflare change, or form submission was made.

## 2026-10-16 local preview: About page and homepage cleanup

Moved the existing About, Accessibility Statement, and Privacy and Responsible Measurement copy to `/about/`. Removed the duplicate Government Buyers and About sections from Home while retaining the dedicated Government Buyers page, homepage service CTA, capability statement contact CTA, and contact form. Updated shared navigation, privacy links, sitemap, and static build. Old homepage section fragments use a client-side fallback. Production publication is owner-approved; `.html` 301 redirects remain a separate Cloudflare step requiring post-deployment verification.

Refined `/about/` into a dedicated introduction with selected real work imagery, supported capabilities, a scoped collaboration sequence, the existing accessibility/privacy statements, and direct enquiry/work CTAs. No new client claims or form submissions.

The About collaboration panel adapts the owner-provided blue gradient, three-step reference screenshot. The page also shows the existing Northside reporting concept with an explicit fictional/synthetic label, distinct from the UAid Direct website screenshot.

The catalogue now gives Alder & Lane and Harbor Ledger separate “From $950” and “From $1,999” labels, matching the other two cards. Descriptions emphasize the approved four-page static and five-page WordPress scope without putting prices in the prose.

## 2026-10-16 local preview workbench refinement

The four design detail pages now share a live preview workbench with page tabs and Desktop/Mobile viewport controls. The same iframe resizes in place, preserving its current navigation when switching widths. When the available panel cannot fit a genuine desktop layout, Mobile is selected and Desktop is disabled with an explanatory status. The demo pages, links, and video remain interactive; fictional demo forms remain inactive. The scope callout's existing enquiry button now sits above its disclaimer divider, aligned right on wide screens and full width on phones. This refinement is local only and has not been committed or published.

Local checks: `npm run check`, 57 page/mode combinations across all four demos, the existing design-tab and AER video audits, all 29 clean routes in browser smoke, and WCAG 2 AA scans of all four design detail variants. The moved enquiry CTA was checked at 320, 768, and 1440 px without submitting a form.

## 2026-10-16 About, Designs, and shared header review (local only)

- Removed the About opening at the owner's direction. “Where we can help” now starts the page as its eyebrow above a meaningful H1, using the same container width, top spacing, indentation, and typography as the Work and Designs introductions. Three client needs follow: a clearer website path, trustworthy measurement, and usable handoff. The UAid screenshot is labeled selected work; the Northside reporting image remains explicitly fictional with synthetic data.
- Replaced the Designs catalogue's long “Starting scopes” cards with a compact closing enquiry callout. Approved starting prices, included work, exclusions, and timelines remain on the individual design detail pages. Added client-content rights language to the Alder & Lane terms. The CTA leads to the existing homepage contact form.
- Measured a header-width mismatch: `.page-home .container` and `.page-gov .container` applied a narrower main-content width to their headers above 1180 px. Scoped those rules to `main`, leaving the shared header container consistent across all main pages. A new browser check compares header bounds, item positions, logo, text, buttons, breakpoint, and overflow on Home, Work, Government Buyers, Designs, About, and four design details at 1440, 1200, 1180, 390, and 320 px. The fictional demo sites keep their independent navigation.
- `npm run check` passed, including HTML, 1,033 local links, five WCAG 2 AA page scans, and formatting. Browser smoke passed all 29 clean routes; design viewport, tab, and AER video audits passed. About and catalogue browser checks passed at 1440, 390, and 320 px, including equal intro measurements against Work and Designs, the enquiry link, and no horizontal overflow. No test lead was sent.
- This batch is uncommitted and unpublished. The local preview is `http://127.0.0.1:8080/`. Legacy `.html` URLs currently remain functional at the GitHub Pages origin; Cloudflare 301 redirects, cache purge, and post-release verification are still separate steps before the clean URL migration can be considered complete.

## 2026-10-16 About closing and homepage method follow-up (local only)

- Removed the bottom Delivery Principles block from About. Its accessibility and privacy statements remain public on a dedicated `/policies/` page, with footer links and old Home/About fragment bookmarks routed to the new anchors. The policy page is in the build allowlist and sitemap.
- About now ends with the same compact closing-callout treatment used on Designs, with one “Discuss your project” action to the existing contact form. No test enquiry was submitted.
- Replaced the existing four-item delivery stripe after homepage Services with a compact “How we work” section before Contact. It states the three practical principles of agreeing on scope, reviewing usability/measurement/privacy as relevant, and handing over documented next steps. The layout uses simple ruled columns instead of extra cards.
- This follow-up remains local and uncommitted. The new policy route and legacy fragment behavior require verification after any eventual deployment; Cloudflare redirect rules were not changed.
- Local QA passed after these changes: `npm run check` (HTML, 1,071 local references, six WCAG 2 AA page scans, formatting), browser smoke across 30 clean routes and old fragment paths, shared-header measurements on ten main routes at 1440/1200/1180/390/320 px, and About/Home/Designs/policies desktop and phone checks. The About and Designs CTAs reached the existing contact form without submitting it. No horizontal overflow was observed at 1440, 390, or 320 px.

## 2026-10-16 Government Buyers action area (local only)

- Grouped the existing solicitation, capability-statement request, and subcontracting actions in a distinct bordered panel after Trust posture. The solicitation action remains primary; the other two retain their destinations and labels. No procurement disclosure or surrounding service copy was changed.
- The action area has wider separation from the information grid, a clear heading, full-width controls on phones, and a visible keyboard focus outline. The local audit passed at 1440, 768, 390, and 320 px, verifying ordering, focus, destinations, and RFQ/RFP form preselection without sending a form. `npm run check` and browser smoke across 30 clean routes also passed after this change.

## 2026-10-16 Designs closing disclosure placement (local only)

- Moved the unchanged starting-price, content-rights, hosting/tool, and advanced-feature disclosure from inside the Designs closing callout to a separate readable note immediately before the footer. The CTA now contains only its invitation and action. Desktop and phone spacing checks verify the note is visually separate from both the CTA and footer.
- Standardized the About, Work, and Designs closing-card eyebrow to “Start with a conversation,” using one type style and the same spacing above each heading. Work now shares the same right-aligned desktop action and full-width narrow-screen action layout as the other two cards. The three card headlines, body copy, button labels, and destinations remain specific to their pages.
- Removed the About-only tinted background and borders around “Where we can help.” Its main sections now use the same shared page background as Work and Designs. The blue collaboration panel and closing CTA retain their intentional contrast.
- Final local checks passed after these refinements: `npm run check` and browser measurements at 1440, 390, and 320 px confirmed equal eyebrow typography/spacing, the Work CTA's right desktop alignment and full-width phone layout, About's transparent section background, Designs disclosure placement, and no horizontal overflow. No enquiry was sent.

## 2026-10-16 shared page rhythm and disclosure width (local only)

- Work, Designs, and About share the same intro width and inset, header-to-eyebrow gap, eyebrow-to-heading gap, heading-to-subtitle gap, and intro-to-first-content gap at 1440, 390, and 320 px. The first About need now starts at the same desktop text position as the Work and Designs content. Their closing cards share a 96 px preceding gap at 1440 px and 72 px at 390 and 320 px. Content heights still follow each page's copy and media.
- The Designs scope disclosure remains outside the closing card, immediately before the footer. Its paragraph spans the full content container: 1280 px at 1440, 362 px at 390, and 292 px at 320, without horizontal overflow.
- `npm run check` passed (HTML, local links, six WCAG 2 AA pages, formatting). Browser smoke passed 30 clean routes, a legacy URL, mobile navigation, preview gallery, design tabs, query prefill, and form UI without a submission. Targeted About/Designs, Government Buyers, and ten-route header checks also passed. `scripts/check-page-rhythm.mjs` saves matched intro and closing-card screenshots under `/tmp/jji-rhythm-*`. No commit, push, deployment, Cloudflare change, or test lead was made.

## 2026-10-16 Designs pricing footnote (local only)

- Added one linked superscript 1 immediately after each of the four “From” prices in the main Designs catalogue. All four references lead in the same tab to the numbered pricing disclosure above the footer. The price values and disclosure wording are unchanged.
- Checked exact marker counts, labels, keyboard focus, destination, price alignment, and layout at 1440, 390, and 320 px. No form was submitted. This change remains uncommitted and unpublished.

## 2026-10-16 visible section spacing and process review (local only)

- The supplied About screenshot showed an excessive gap between the third need's bottom rule and the blue Working Together panel. Two adjoining section paddings compounded to 224 px at 1440 and 136 px on phones. Reduced those visible rule-to-panel gaps to 96 and 72 px, respectively. The last link-to-panel distance is now 183 px at 1440 and 121 px on phones, including the third row's own bottom padding.
- Audited rendered intro-to-first-content and last-content-to-closing-card distances on Work, Designs, and About at 1440, 390, and 320 px. Their intro text-to-first border gaps are 68 px desktop and 44 px phone; their final visible block-to-CTA gaps are 96 px desktop and 72 px phone. Work's project-to-project spacing and the Designs disclosure retain breathing room appropriate to their different content.
- Compared the homepage How We Work steps, the About Working Together panel, and the Government Buyers three-step diagram. Each follows scope/define, build/check, and documented handoff. Changed only the homepage step 02 headline from “Review the result” to “Build and review” and added “Implement the agreed work, then” to its explanation so the implementation stage is explicit. About's numbered client needs describe service areas, not a required sequence. The design enquiry wizard is a separate form flow. No new service commitment was added.
- `scripts/check-section-gaps.mjs` measures visible section boundaries rather than CSS values alone. Desktop and phone screenshots were reviewed after the change. These refinements are local and unpublished.

## 2026-10-16 Government Buyers Trust and next steps (local only)

- Made Trust posture a standalone compact list card with the same background, border, radius, padding, and three-column dense-list treatment as the existing Services and Fit cards. All five trust statements remain unchanged.
- Moved the three procurement actions into a separate shared closing-callout card. Its eyebrow is “Next steps” and its heading is “Start a procurement conversation.” The three existing button labels, destinations, and RFQ/RFP and Subcontracting form preselection remain unchanged; no new procurement claim or qualification was added.
- The Trust-to-CTA visible gap is 92 px at 1440, 63 px at 768, and 60 px at 390. Buttons sit in one row on desktop, two rows at tablet width, and a single column on phones. Light and dark theme screenshots were reviewed. The minimum calculated contrast at the primary button gradient endpoints is 5.36:1 for its text; secondary text and visible focus outlines also exceed 5:1 against their backgrounds.
- Browser checks at 1440, 768, 390, and 320 px verified Trust styling and exact statements, no overflow, button order/wrapping, focus, destinations, and form preselection without submitting a form. This remains uncommitted and unpublished.

## 2026-10-16 Government Buyers narrative refinement (local only)

- This refinement supersedes the Services, Fit, and Trust box layout described above. Below the unchanged hero, the page now leads buyers through concrete web/content and analytics/tagging/dashboard scopes and possible outputs, two clearly labeled work examples, a three-step delivery path, and procurement details before the existing Next steps card.
- The UAid Direct work is labeled as a published nonprofit website, not government past performance. Northside is labeled as a fictional reporting concept with synthetic figures. The page states accessibility, privacy, security, documentation, and QA practices without asserting registration, certification, contract eligibility, or government past performance.
- Essential procurement contact and profile information remains on the page. The online capability statement is linked from the hero and details, describes fuller services and tools, and can be printed or saved as PDF. The three Next steps actions retain their labels, destinations, and enquiry-type preselection.
- Desktop and phone renderings were visually reviewed at 1440 and 390 px. A browser check passed at 1440, 768, 390, and 320 px for section order, evidence links and disclaimers, capability links, CTA layout, keyboard focus, no horizontal overflow, and RFQ/RFP and Subcontracting form preselection. No form was submitted. This revision remains uncommitted and unpublished.

## 2026-10-16 clean URL and disclosure follow-up (local only)

- The trailing-slash route map and proposed Cloudflare 301 rules are in `docs/clean-url-migration.md`. The local build retains all 30 legacy `.html` HTML paths alongside their clean directory-index paths. No Cloudflare rule, commit, push, or production deployment occurred. The local preview is `http://127.0.0.1:8080/`; the live site must be checked after publication before claiming the URL migration is complete.
- The seven main JJI pages now use identical shared footer markup. The capability statement remains a standalone print-oriented document; the four concept demo sites retain their own branded footers.
- Audited 29 visitor-facing HTML source pages: five JJI pages and all 22 demo pages contain numbered above-footer notes, totaling 57 numbered notes and 68 linked superscript references. About and Policies have no editorial disclosure to move. Demo identity and synthetic-data labels remain concise at the relevant example. Form validation, consent, inactive-form warnings, and nonbinding enquiry guidance remain near their controls or actions for usability. Photo and footage credits on demo pages are attributed in the numbered notes.
- Government Buyers links directly to all four design detail variants. Work retains a screenshot and direct external link for the actual UAid Direct USA site; no UAid iframe was added. The Northside full-size screenshot action was removed. The user made the known Northside Looker Studio report publicly viewable by link; Safari Private Browsing now opens it without a Google sign-in. The Overview and Google Ads pages visibly label figures as synthetic sample data.
- The four design variants use personalized “Explore [name] pages” headings and a Hide/Load Interactive Preview control. Their iframes load on page arrival, preserve the selected page and viewport after hiding and showing, and are removed on hide to stop media. The short preview instruction is shared across variants; demo/form context appears in the numbered footer note.
- The lower “Request a site like this” button in the design scope card is left aligned. Hiding an interactive preview now retracts its panel completely, leaving the toolbar and Load button without a placeholder or reserved frame.
- After the earlier editor-access blocker, the owner opened the official Looker Studio Embed report dialog. Embedding and report navigation were enabled, and the generated URL and sandbox settings were copied into Work. The report keeps its 900 × 675 base canvas. On wider sections, the iframe canvas is scaled proportionally to the full content width, with matching container height; on narrow screens, it stays 900 × 675 inside a horizontally scrollable frame so the charts remain readable. It loads on arrival; Hide removes the iframe and collapses the panel, while Load restores it. A direct report link below the frame provides an alternative when an iframe is blocked. UAid Direct remains a screenshot and link to its actual site.
- Local browser checks exercised all eight Looker pages and confirmed synthetic labels, the Hide/Load button, keyboard activation, and no page overflow at 1440, 390, and 320 px. At 1440 px, the visible dashboard fills the 1280 px section width; Safari Private Browsing visibly rendered and navigated the embed while signed out. Safari Responsive Design Mode visibly rendered charts at 390 px with the dashboard scrolling within the page width. Chromium's mobile-device emulation exposed the report content in the iframe DOM but captured a blank iframe; the Safari result indicates this is specific to that emulation/capture path. Device Hub detected the connected iPhone but requested Developer Mode before development access, so actual-phone rendering remains unverified. No production or Cloudflare change occurred.

### 2026-10-16 mobile preview update

- Work now shows the existing Northside dashboard image and a direct link to the public Looker report at phone widths (760 px and below). The embed is created on wider layouts and removed when a window narrows, so the phone page does not fetch the hidden interactive report. Desktop retains the full-width interactive report and Hide/Load control.
- The four design detail variants now show screenshots captured from their actual responsive demo homepages, each with an “Explore demo” link to its own clean demo route. Page and viewport controls and the live iframe remain on wider layouts. Crossing the phone breakpoint removes the iframe and restores the selected example page when widened again.
- The four screenshots are local public assets listed in `scripts/build-public.mjs`. No demo form or enquiry submission was made. This remains an unpublished local preview; the clean URL production redirects still require the separate Cloudflare steps in `docs/clean-url-migration.md`.
- `npm run check` passed, including the local link, HTML, formatting, and six WCAG 2 AA checks. Browser checks passed for the four demo detail variants and Northside at 390 px, 320 px, and 1440 px: images and links resolved, phone layouts had no horizontal overflow or hidden iframes, desktop embeds loaded, Hide/Load and page tabs worked, and widening restored the selected page. The enquiry dialog opened and closed without a submission.

### 2026-10-16 follow-up: demo presentation, image clarity, and media

- The public-facing concept name is now “AER / FIELD” throughout the JJI catalogue, detail page, enquiry selection, and related accessibility labels. Demo paths keep the existing `/previews/aer-field/` slug.
- The four phone preview images were recaptured from the current responsive demo homepages. Each now has a 390 × 620 PNG for standard-density displays and a 1170 × 1860 WebP selected through `srcset` for high-density phones. The AER / FIELD image uses a real frame from its playing mobile hero with the drone visible. At a 390 px, 3× browser viewport, all four cards requested their 3× images at a 360 px displayed width. The demo title and disclosure cleanup is reflected in those captures.
- The 22 demo HTML pages no longer place linked superscripts in headings, banners, project cards, or hero media labels. Each demo retains its truthful identity and source/footage credits in labeled disclosures immediately before its footer. The main JJI catalogue retains its From-price references; their final numbering is documented below.
- AER / FIELD's muted, inline background videos now attempt autoplay at phone widths, subject to browser policy. The home hero and Services background load on their direct routes, and film-card reels load as they enter view. Posters and Play controls remain available if automatic playback is blocked; reduced-motion and reduced-data preferences suppress automatic loading. Detail films retain their user-controlled players. Safari Responsive Design Mode at 390 px showed the home video playing with a Pause control. A WebKit engine check of the final code confirmed advancing muted inline playback on the home and Services routes at 390 and 1440 px; Chromium checks also confirmed the direct routes, reduced-motion manual playback, a data-saving poster state, and manual recovery after a simulated autoplay-policy rejection. These are emulated phone checks, not a physical-iPhone result.
- `npm run check`, `node scripts/check-aer-video.mjs`, `node scripts/smoke-browser.mjs`, and `node scripts/check-disclosure-layout.mjs` passed. The browser smoke covered 30 clean routes and the disclosure check covered 32 routes at 1440, 390, and 320 px. The preview is local at `http://127.0.0.1:8080/`; no commit, push, deployment, or Cloudflare rule change occurred. Legacy URL redirects still require the separate production work described in `docs/clean-url-migration.md`.
- Local verification: `npm run check` passed HTML validation, 1,124 local references, six WCAG 2 AA page scans, and formatting. Additional WCAG 2 AA scans passed all four auto-loaded design variants. Browser smoke passed 30 clean routes, legacy URL behavior, navigation, gallery, query-prefilled and guided form UI without submitting a lead. The viewport audit passed 57 page/width combinations across four demos, including keyboard controls, AER video, restored page/width choices, retracted hidden panels, and narrow widths. The 32-route layout audit passed at 1440, 390, and 320 px, including the left-aligned design scope button. Source inspection confirmed the seven JJI footers have identical markup, all 29 pages have valid note targets, and no visitor-facing source contains the word “fictional.”

### 2026-10-17 CTA disclosure refinement (local only)

- Audited closing CTA callouts across all four demo concepts and the shared JJI design detail page. Alder & Lane's Home, About, and Services callouts now use clean example invitations; their implementation guidance sits in the labeled disclosure area immediately before each demo footer. The Still Form and Harbor Ledger CTA callouts contained no adjacent disclosure text, and AER / FIELD has no comparable intrusive CTA note. Existing form safety messages remain beside disabled forms where visitors need them.
- On each JJI design detail variant, the nonbinding enquiry and alternate email explanation now appears in a labeled paragraph in the existing disclosure area immediately above the footer, instead of under the lower request button. Pricing and package scope remain in the scope card. No disclosure information was removed or duplicated.
- The local preview server was restarted on port 8080. These changes remain unpublished.
- All four concept demos now use the exact visible banner label “Demo” on every page. The banner's extra form/contact wording was removed; the established above-footer disclosures retain the demo identity and source caveats, while disabled form fields remain apparent at the point of use.

### 2026-10-17 Northside cover (local only)

- Added an original SVG cover for the synthetic Northside Heating & Boiler Care dashboard. It uses the report's navy, teal, and warm neutral palette with a simple boiler/pipe illustration and an abstract chart; the cover itself says “Synthetic dashboard demo” and “Sample data only.” It makes no real-business or outcome claim.
- The Work page now places this cover to the left of the Northside case-study copy on desktop. Phone layouts keep their existing text-then-image stacking. The interactive dashboard remains below at full width on desktop; the existing screenshot and direct report link remain the mobile report treatment. The cover uses its full 16:10 viewBox at narrow widths so its heading and demo label are not cropped.
- The 22 demo pages were checked for the exact “Demo” banner and an adjacent above-footer disclosure. A browser audit passed 33 JJI core/design page and width combinations at 1440, 390, and 320 px for responsive images, mobile navigation, disclosure width, no horizontal overflow, and the Northside desktop/mobile ordering. No lead was submitted. The focused review screenshots are in the local task workspace (`northside-card-1440.png` and `northside-card-390.png`).
- Recaptured all four 390 × 620 and 1170 × 1860 design-card previews from the final Demo-only pages; AER / FIELD's frame still shows the mobile hero video in motion. The screenshots are local assets and replace the earlier captures with stale banner wording.
- Removed the redundant superscript after the catalogue intro heading's “site.” sentence. The four card references now appear at description ends, with the separate price references and above-footer notes retained.
- On the shared design presentation, moved the demonstration-context reference from the “Explore [concept] pages” heading to the end of the adjacent instruction sentence (“…responsive sample below.”). It still points to the same above-footer note on all four design variants, with one marker in that preview toolbar.
- On the Designs catalogue, moved each card's existing demonstration-brand marker from its Explore link to the end of its description sentence. Each card now reads price note 1, then demo-context note 2; the two above-footer notes appear in that order with unchanged meanings and semantic link targets. This catalogue placement is separate from the shared individual design-page instruction-sentence marker described above.
- Replaced the Alder & Lane catalogue card's older CSS-rendered cover with a 2880 × 1620 WebP capture of its current responsive demo homepage at the card's 16:9 ratio. The capture shows the final “Demo” banner and current hero copy. Other concept covers were not changed.
- Audited pointer feedback across JJI core/design pages and all four demos. Enabled demo links and buttons already resolved to pointer cursors; the JJI form, preview, and request buttons were the inconsistent controls. Added a shared JJI rule for genuine links, enabled buttons, select menus, checkbox/radio inputs, and disclosure links, with disabled states remaining unavailable and editable text fields retaining text cursors. Non-clickable cards did not gain pointer styling. A Chromium computed-style audit passed 33 routes at 1440 and 390 px, checking 1,182 visible controls and no horizontal overflow.
- The shared About, Work, and Designs closing CTA cards now use two desktop columns, with the single action centered within its right-hand column. Phone widths retain the full-width button below the copy. The Government Buyers three-action panel keeps its existing dedicated grid. Layout measurements passed at 1440, 1024, 800, 768, 760, 620, 390, and 320 px without horizontal overflow; focused About card captures were reviewed at desktop and phone widths.
- Government Buyers now has five restrained, inline line icons: website/code and reporting/chart icons beside the two scope headings, then document, verification, and handoff icons beside the three delivery steps. They use the existing accent colour and a shared 1.7 px stroke, carry `aria-hidden`, and leave every text label intact. No official seal, badge, or new content box was added. Desktop and phone sections were visually reviewed; the five icons, three procurement actions, and lack of horizontal overflow were checked at 1440, 390, and 320 px.
- The Government Buyers action audit was updated to read the current above-footer note structure and ignore superscript text while comparing headings. It passed at 1440, 768, 390, and 320 px, including button order, focus, layout, and enquiry-type preselection without submitting a form.
- On the shared design preview, the viewport-status strip now uses the surrounding workbench card background, removing its lighter band while preserving the stage treatment, borders, and text contrast. On Government Buyers, note 1 now follows the scope description's final period instead of the “What we can deliver” heading; its disclosure target and number are unchanged.
- On Government Buyers, note 4 now follows “Buyer information” in the eyebrow above the procurement heading. Its existing disclosure target, accessible label, and number are retained.
- On Government Buyers, the two selected-work references now follow the final punctuation of their respective UAid Direct and Northside descriptions. Notes 2 and 3 keep their existing disclosure meanings and targets.
- On Government Buyers, the hero graphic and “How work proceeds” section now share the same three step labels: “Define the need,” “Build and verify,” and “Document the handoff.” The supporting descriptions remain aligned with these steps.
- About now introduces JustinJ Industries as an independent web and analytics studio and explains the working relationship in a single editorial panel. The previous service-style need cards, project screenshots, and three-step process grid were removed; a direct Work link carries readers to project evidence and demos. The closing enquiry CTA remains.
- A second About refinement adds an original SVG diagram linking a website interface to a schematic measurement view, plus a short explanation of why visitor experience, consent choices, tagging QA, and usable reports belong in one implementation conversation. The working-together panel now describes scope, checks, and documentation more concretely, while Work remains the destination for project evidence.
- The About introduction retains the earlier concise subtext about connecting the visitor experience with tracking, QA, and reporting. The page's new diagram, narrative, and working-together section remain in place.
- The separate About closing CTA card was removed. Its “Discuss your project” action now sits directly beneath “See the work and demos” in the existing blue working-together panel, with the same `/work/` and `/#contact` destinations and a high-contrast light button treatment on that gradient.
- The About Work link now underlines only “See the work and demos”; its adjacent arrow remains inside the same focusable link without a separate underline segment.
- Arrow-bearing text links across JJI, Alder & Lane, Still Form, and AER / FIELD now use the shared label/icon component in `assets/arrow-links.css`. Decorative arrows remain outside the label underline while each demo keeps its own spacing; button-style and full-card actions retain their distinct treatment. The convention is documented in `docs/accessibility-notes.md`.
- The Northside dashboard starts collapsed on Work. Its desktop Load/Hide control sits on its own line directly below the final description bullet, aligned with the text column; loading requires activation, and hiding removes the iframe. The phone screenshot and direct dashboard link remain unchanged.
- Northside's existing work note 2 now follows the end of the dashboard description sentence instead of the heading; its label and above-footer target are unchanged.
- The Government Buyers procurement-detail grid now fills its section's standard content width instead of stopping at 1060 px. The page's shared margins, two-column desktop and single-column mobile arrangements, and field dividers remain intact.

## 2026-10-17 comprehensive release audit

- Completed a 236-case render review spanning all 35 public directory-index routes, with five viewport widths and light/dark core coverage. Added route coverage includes every demo About/FAQ/studio/work page, the three film detail pages and Northside Boiler Care.
- Fixed Northside preview initialization and native WordPress block serialization, enlarged-text wrapping, skip-link focus, AER footer contrast, unselected Design empty panels, Northside demo indexing and favicon handling. Native header, navigation, footer and image edits were saved, reloaded and restored in Safari; Boiler Care title persistence was also verified.
- Project checks pass. The 104 axe cases report no violations after fixes; incomplete imagery contrast and video-caption applicability remain human-review items. Thirty-six interaction/text-spacing/menu checks pass with no external form submissions. These results do not establish formal accessibility or Section 508 conformance.
- Detailed scope, evidence, staging boundary and limitations are in `docs/site-audit-2026-10-17.md` and its JSON result record. Publication and legacy edge redirects must be verified separately; Cloudflare configuration was not changed during this audit.

## 2026-10-17 accessibility follow-up

- Completed representative native Safari keyboard/focus and actual browser zoom checks. Fixed a zero-height enquiry form at short viewports, weak demo footer focus rings, bright-video overlay contrast, and missing pause control on looping film previews. Added visual text alternatives for the three silent film detail clips. Both stock audio tracks decode to digital silence; native playback commands completed. No meaningful audio or speech was removed.
- Retested the Northside native Image Replace/upload/save/reload/restore flow and a fresh ZIP install/activation. Version 1.0.1 repairs scoped/subdirectory links; the fresh frontend and native editor render correctly. Packaging remains separate from JJI's static runtime.
- Criterion-level evidence and exact limits are recorded in `docs/accessibility-followup-2026-10-17.md`. This follow-up does not establish formal WCAG or Section 508 conformance. Full screen-reader output, physical-device testing and actual native 400% zoom remain unverified. No Cloudflare, certificate, DNS or security setting was changed.
