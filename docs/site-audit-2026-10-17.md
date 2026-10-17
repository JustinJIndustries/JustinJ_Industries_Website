# Site audit — 2026-10-17

## Scope and environment

Reviewed the current `main` working tree in `/Users/macbookpro/Projects/JustinJ_Industries_Website` on M1 Max macOS. The production architecture remains static HTML/CSS/JavaScript, with an explicit `dist/` allowlist deployed by GitHub Pages behind Cloudflare. The Northside WordPress package is a separate demonstration source; it is not the JJI production runtime.

This document records the pre-deployment audit. Deployment status and live HTTP behavior must be verified against the resulting commit separately.

## Coverage and results

| Check              | Coverage                                                                                                                                                   | Result                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Render matrix      | 210 cases at 320, 390, 768, 1024 and 1440 CSS px; core pages and five concept variants in light/dark, demo homes/contact/services and selected inner pages | No page errors, missing local resources, broken loaded images or horizontal overflow                         |
| Remaining routes   | 26 additional render/accessibility cases at 320 and 1440 px; includes unselected Design, demo About/FAQ/studio/work pages, all three films and Boiler Care | All 35 directory-index routes covered; no resource, overflow or script failures                              |
| Axe                | 104 cases, WCAG 2 A/AA, 2.1 A/AA and 2.2 AA tags, including contrast retests                                                                               | Zero reported violations after fixes; incomplete contrast and video-caption checks remain human-review items |
| Interaction checks | 20 flows plus 14 text-spacing cases and two demo menu cases                                                                                                | Pass; four mocked form responses, zero external form submissions                                             |
| AER media          | 17 playback/source/preview checks: desktop, emulated phone, film details, reels, embedded preview and reduced-motion manual playback                       | Pass                                                                                                         |
| Project gate       | `npm run check`: HTML validation, deterministic 125-file build, 1,215 local HTML references, six Pa11y pages and Prettier                                  | Pass                                                                                                         |
| Visual review      | Core light/dark contact sheets at five widths, five design detail pages, all demo families, inner pages, and homepage journey crops                        | Reviewed; no remaining blocking layout defects observed                                                      |

Screenshots and detailed run JSON remain local under `output/playwright/audit/`. A compact result record is committed as `docs/site-audit-2026-10-17-results.json`. Render cases are repeated route/viewport/theme combinations, not 236 distinct pages. Phone coverage is browser emulation, not physical-device testing.

Keyboard checks cover the skip link, main menu focus containment/Escape/return, demo menu Escape/return, design tabs and preview controls, enquiry validation and Escape/return, report load/hide and native video controls. Contact and guided enquiry rejection/retry/success responses were intercepted locally. No test lead was delivered. Northside's static form confirms locally without a network submission.

## Findings fixed

1. **Northside design initialization:** the concept selected a nonexistent service radio, stopping preview and enquiry initialization. It now selects the existing Custom scope choice. Boiler Care has its own tab and real route.
2. **Text reflow and focus:** added a focusable main target for skip links; repaired navigation wrapping, hidden overlay behavior, form/grid minimum widths, button wrapping, long contact links and service heading text at 200% text sizing. Normal viewport and text-spacing checks pass.
3. **AER footer contrast:** darkened the small Back to top text from a failing 3.98:1 combination. All six affected axe retests pass.
4. **Northside demo rendering:** replaced the full-page mockup inside the hero with a separate synthetic boiler-room photograph, repaired phone layout and form sizing, added visible focus, skip links and footer navigation. Added phone preview assets and `noindex, nofollow` to all five static demo pages.
5. **Unselected Design route:** hide empty preview/scope panels when a design query is absent or unknown; the page provides a catalogue link.
6. **Site icon:** publish the valid SVG favicon with an explicit SVG type. The older untracked SVG mislabeled as `favicon.ico` is excluded from the build and release.
7. **WordPress native editing:** repaired malformed Header/Footer block serialization and converted the homepage from a single Custom HTML body to native Group, Columns, Heading, Paragraph and Image blocks. Removed the nested-grid layout defect. Saved, reloaded and restored header text, menu label, footer text and image alt text in Safari. The earlier real Boiler Care page title save/reload/restore also passed. No temporary QA text remains. Synced native templates into the local theme, including correctly located About and Contact templates.
8. **Smoke test maintenance:** updated outdated About selectors to the current Working together section. The final smoke run also checks legacy fragments and query strings.

## WordPress evidence and limits

The browser-local Playground site is `https://playground.wordpress.net/scope:sad-classic-road/`; Boiler Care is `/boiler-care/`. The final homepage visibly renders the restored image text, photograph, heading, navigation and cards after a save/reload. The local theme source uses theme assets rather than a Playground media ID. It must be installed and have real pages created with matching slugs when used on another WordPress site. No WordPress installation or account was added to JJI production.

## Release boundary

Stage reviewed site source, public allowlisted assets, applicable QA scripts, documentation and Northside theme source. Preserve and exclude local screenshot/output trees, `tools/` cover experiments, misplaced root `templates/`, the old invalid `favicon.ico`, earlier layout-study scripts with superseded selectors, and packaging ZIP. The build publishes only approved public files; it does not publish docs, source theme archives, tools, opportunity material or test evidence.

No new tracker, account, paid service, government qualification or compliance claim was added. Public form endpoints remain existing owner-approved endpoints. Procurement copy retains conservative, scope-dependent language.

The clean URL route map and edge proposal remain in `docs/clean-url-migration.md`. Keep legacy `.html` pages working. No Cloudflare configuration change is part of this release; do not declare the migration complete until all old-path 301s and query/fragment behavior have been verified live.

## Practical limits

**Follow-up:** `accessibility-followup-2026-10-17.md` supersedes the unresolved imagery contrast and audio-characterization items below. It records manual keyboard/zoom checks, measured overlay fixes, silent-video alternatives, reel pause controls and final Northside package/image replacement tests. Screen-reader, physical-device and native 400% zoom limits remain explicit.

This is a broad engineering audit, not an accessibility conformance certification. A complete screen-reader audit, physical phone testing and formal Section 508 evaluation were not performed. Axe leaves contrast checks over imagery/video and caption applicability for human review. Two stock MP4 files contain audio tracks; their speech/caption requirements were not independently characterized, so no caption-conformance claim is made. Motion controls, reduced motion, posters and nearby descriptive text were checked. Google report availability and browser autoplay policies remain external dependencies.

Before release, command-line requests to the public Cloudflare host returned a 403 managed challenge, including known existing pages. That response is not evidence of a site-route failure; use the normal browser and deployment workflow/origin evidence for live verification, and explicitly report any verification that remains blocked.
