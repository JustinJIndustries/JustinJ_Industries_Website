# JustinJ Industries Website

**WEBSITES • MEASUREMENT • DIGITAL SUPPORT**

Source for [justinjindustries.com](https://www.justinjindustries.com/), the
JustinJ Industries business website: services, selected work, website concepts,
government-buyer information and a downloadable capability statement.

## What is in this repository

- Plain HTML, CSS and browser JavaScript; the main site is a static website.
- Eight business-site pages, shared footer sources in `partials/` and `assets/`,
  and fictional portfolio studies in `previews/`.
- A Node.js build that copies an explicit allowlist into `dist/`, creates clean
  directory-index routes and keeps legacy `.html` routes available.
- HTML, local-link, accessibility, formatting and PDF-integrity checks.
- Separate, editable Northside WordPress theme source in
  [`northside-wordpress/`](northside-wordpress/). The public static preview does
  not run PHP or WordPress.

The corporate contact form uses the existing Formspree integration. Demo inquiry
forms do not send messages or book services. Do not use real contact data when
reviewing a demo, or submit the corporate form as part of an automated check.

## Selected demonstrations

These are self-directed concepts with fictional businesses and sample data.

| Example                         | Explore                                                                                                                                                           | What it demonstrates                                                                                                                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STILL FORM                      | [Live static demo](https://www.justinjindustries.com/previews/still-form/) · [source](previews/still-form/)                                                       | Responsive creative-studio pages, project detail routes, still/motion media and visible media credits. This directory is a static study, not an installable WordPress theme.                                                                                              |
| Northside Heating & Boiler Care | [Live static demo](https://www.justinjindustries.com/previews/northside/) · [static source](previews/northside/) · [WordPress theme source](northside-wordpress/) | Service pages, responsive navigation, FAQ content and a non-sending inquiry demonstration. The separate WordPress source includes native block templates, PHP and configurable inquiry defaults. A WordPress installation and matching pages are needed to use the theme. |
| Northside reporting             | [Synthetic Data Studio example](https://www.justinjindustries.com/work/#northside) · [page source](work.html)                                                     | An eight-page reporting concept using synthetic sample data. Figures are illustrative, not client outcomes. Report hosting and access are external; the repository does not contain its data source, dashboard export or a reproducible analytics pipeline.               |

See [media credits](docs/catalogue-media-credits.md),
[portfolio asset provenance](docs/portfolio-assets.md) and
[Northside inquiry maintenance](docs/northside-inquiry.md) for scope and sources.

## Local setup and preview

Use Node.js 24 (the version used by CI) and its bundled npm. From the repository
root:

```sh
npm ci
npm run preview
```

Open `http://127.0.0.1:8080/`. Preview builds and serves `dist/` on loopback; stop
it with Ctrl-C. It supports clean routes and legacy `.html` files, but does not
emulate Cloudflare redirects or install WordPress. Dependency installation may
download a browser for Pa11y; a supported Chrome/Chromium runtime is needed for
browser-based checks.

To build the static artifact without starting a server:

```sh
npm run build
```

Build verifies the shared footer and the checked-in capability PDF before
copying approved files. It excludes documentation, working notes, theme PHP,
dependency metadata and unapproved assets. The GitHub Pages workflow,
`_config.yml` exclusions and ignore rules have separate purposes; retain them
unless their integration or deployment is deliberately changed.

## Checks

```sh
npm run check:footer
npm run check:html
npm run check:links
npm run check:a11y
npm run check:format
npm run check
```

`check:links` builds and scans local references in `dist/`; it is not a guarantee
that every external service is available. `check:a11y` builds, starts a temporary
loopback server on port 8080 and runs Pa11y against six business-site routes.
Stop another preview using that port first. A passing automated scan is not a
complete accessibility or Section 508 conformance audit. See
[QA setup](docs/qa-toolchain.md) for browser requirements and optional checks.

Shared-footer edits use `npm run sync:footer`. Changes to capability-statement
HTML or its hashed assets may require `npm run build:capability`, then
`npm run check:capability`; see
[capability PDF maintenance](docs/capability-statement-maintenance.md).

## Publishing

`.github/workflows/jekyll-gh-pages.yml` validates, builds and deploys `dist/` to
GitHub Pages on a push to `main`, or a manual workflow run. A documentation-only
push still triggers that workflow. Review the diff and obtain publication
approval before pushing. Cloudflare redirects are maintained separately; see
the [clean URL route and edge plan](docs/clean-url-migration.md).

## Code, media and attribution

Project code and accompanying documentation are covered by the existing
[MIT license](LICENSE), subject to any file-specific or third-party terms.
That license does not relicense third-party photographs, stock footage,
trademarks or client work shown in screenshots.

Retain the source and license references in
[catalogue media credits](docs/catalogue-media-credits.md) and
[portfolio provenance](docs/portfolio-assets.md), plus credits beside demo media.
Unsplash/Pexels media and the official WordPress mark retain their own terms.
Generated demo imagery and synthetic reporting are identified in those records.
Check asset-specific permissions before reuse.
