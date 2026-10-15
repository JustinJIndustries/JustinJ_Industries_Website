# JustinJ Industries Website

Static public website for justinjindustries.com.

## Project shape

- Plain HTML, CSS, and JavaScript
- Public pages: `index.html`, `work.html`, `catalogue.html`, `design.html`,
  `government-buyers.html`, and `capability-statement.html`
- Shared styling in `styles.css`
- Shared browser behavior in `script.js`
- Catalogue detail previews and guided enquiry behavior in `design.js`
- Fictional, noindex sample pages in `previews/`; WordPress concept previews
  are static studies from public-facing source layouts and media. Their forms
  and video are inactive. Provenance and credits are in
  `docs/catalogue-media-credits.md`.
- GitHub Pages deployment through `.github/workflows/jekyll-gh-pages.yml`

## QA commands

```sh
npm run check:html
npm run check:links
npm run check:a11y
npm run check:format
npm run check
```

The server-backed link and accessibility checks start a local server on port 8080. In restricted sandboxes, they may need permission to bind a local port.
