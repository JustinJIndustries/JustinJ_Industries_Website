# JustinJ Industries Website

Static public website for justinjindustries.com.

## Project shape

- Plain HTML, CSS, and JavaScript
- Public routes: `/`, `/about/`, `/policies/`, `/work/`, `/catalogue/`, `/design/`,
  `/government-buyers/`, and `/capability-statement/`
- Shared styling in `styles.css`
- Shared browser behavior in `script.js`
- Catalogue detail previews and guided inquiry behavior in `design.js`
- Fictional, noindex sample pages in `previews/`; WordPress concept previews
  are static studies from public-facing source layouts and media. Their forms
  are inactive; AER / FIELD has playable, credited stock footage. Provenance and credits are in
  `docs/catalogue-media-credits.md`.
- GitHub Pages deployment through `.github/workflows/jekyll-gh-pages.yml`
- The build publishes directory-index copies for clean routes and retains the
  `.html` files for legacy access. Production 301 redirects are a separate
  Cloudflare step; see `docs/clean-url-migration.md`.

## Local preview

```sh
npm run preview
```

Open `http://127.0.0.1:8080/` on this Mac. The server serves `dist/`, matching
the GitHub Pages artifact. The preview includes working clean routes and legacy
`.html` files, but does not emulate Cloudflare redirects.

## QA commands

```sh
npm run check:html
npm run check:links
npm run check:a11y
npm run check:format
npm run check
node scripts/audit-nav.mjs  # with npm run preview running in another terminal
node scripts/smoke-browser.mjs
node scripts/check-design-tabs.mjs
node scripts/check-aer-video.mjs
```

The link check scans every local reference in `dist/`. The accessibility check starts a loopback server on port 8080 and may need permission to bind that port in restricted sandboxes.
