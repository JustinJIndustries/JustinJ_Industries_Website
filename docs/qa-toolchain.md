# QA setup

Use Node.js 24 and npm, matching the GitHub Pages workflow. Run `npm ci` at the
repository root to install the lockfile versions. There is no application
bundler; `npm run build` produces an explicit static artifact in `dist/`.

## Project gate

`npm run check` runs shared-footer validation, root HTML validation, local
artifact-link checks, Pa11y and Prettier, in that order. Individual commands are
listed in the root README. `check:html` covers root HTML files; it is not a
recursive audit of every demo page. `check:links` builds and checks local
references without starting a browser or contacting external links.

The accessibility check starts its own server on `127.0.0.1:8080` and checks
Home, About, Policies, Work, Government Buyers and Capability Statement. Stop a
preview already using that port before running it. These automated checks do
not establish full WCAG, Section 508 or PDF/UA conformance.

## Browser requirements

Pa11y uses Puppeteer and a compatible Chrome/Chromium executable. If browser
download or launch is unavailable, record that limitation and run the checks
that are available; do not describe a partial run as a full passing gate.
Where required, `PUPPETEER_EXECUTABLE_PATH` can point to an installed compatible
browser. CI verifies and uses its sandboxed system Chrome.

## Optional browser probes

With `npm run preview` running in a separate terminal, these existing scripts
exercise additional routes and interactions:

```sh
node scripts/audit-nav.mjs
node scripts/smoke-browser.mjs
node scripts/check-design-tabs.mjs
node scripts/check-aer-video.mjs
node scripts/check-accessibility-followup.mjs
```

They import Puppeteer through the installed toolchain and may create local
evidence. Read the script before running it in a constrained environment. Use
only local/demo data and avoid live form submissions. Review keyboard behavior,
responsive layouts, motion and assistive-technology behavior separately.

## Capability PDF

`npm run check:capability` checks the committed PDF and source hashes against
`docs/capability-statement-pdf-build.json`. Keep this manifest: the public build
imports the check and will fail if it is missing or stale. Regenerate only when
the corresponding HTML or hashed assets change, following the maintenance doc.
