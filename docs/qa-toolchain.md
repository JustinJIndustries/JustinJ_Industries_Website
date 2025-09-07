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
