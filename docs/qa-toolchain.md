# QA Toolchain

This repository uses a lightweight Node-based QA setup for static HTML/CSS/JS checks.

## Install

From repository root:

```bash
npm install
```

## Commands

- `npm run check:html` — validates HTML files with `html-validate`
- `npm run check:links` — starts a local static server and checks internal/public links
- `npm run check:a11y` — runs a basic Pa11y smoke test against public pages
- `npm run check:format` — checks formatting with Prettier
- `npm run check` — runs all checks in sequence

## Notes

- The toolchain does **not** add a bundler or build step.
- Deployment behavior remains static-file based.
- `check:a11y` uses Pa11y and may require a local Chromium/Chrome runtime in some environments.
- Mailto/tel/anchor links are excluded from broken-link failures for link checking.

## Typical local workflow

```bash
npm install
npm run check
```

## If accessibility check fails to launch browser

If `pa11y` cannot find or launch a browser in your environment, run:

```bash
npm run check:html
npm run check:links
npm run check:format
```

Then execute accessibility smoke checks in a local machine with Chrome/Chromium installed.

### Manual fallback used in this project

When `npm run check:a11y` is blocked by local runtime/browser automation issues (`Failed to launch the browser process`, `spawn EPERM`), use:

```bash
npm run serve
npx pa11y http://127.0.0.1:8080 --standard WCAG2AA --timeout 120000
npx pa11y http://127.0.0.1:8080/government-buyers.html --standard WCAG2AA --timeout 120000
npx pa11y http://127.0.0.1:8080/capability-statement.html --standard WCAG2AA --timeout 120000
```

Observed manual result in this repo:

- `No issues found!` for:
  - `http://127.0.0.1:8080`
  - `http://127.0.0.1:8080/government-buyers.html`
  - `http://127.0.0.1:8080/capability-statement.html`

Important distinction:

- Passing manual Pa11y checks indicate no issues were reported for the tested page URLs.
- A failing `npm run check:a11y` in this context indicates a local runtime/process limitation (browser launch / `spawn EPERM`), not necessarily WCAG violations in site markup.
