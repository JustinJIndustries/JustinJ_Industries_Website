# Demo return navigation

## Static previews

All 27 maintained demo pages reuse the former Demo strip as one compact
navigation landmark. “Back to JJI” has a decorative inline SVG arrow and a
44 px minimum link height; “Demo” remains at the right. Each link has an
explicit destination and does not depend on browser history:

| Preview directory          | Return destination          |
| -------------------------- | --------------------------- |
| `/previews/alder-lane/`    | `/design/?design=alder`     |
| `/previews/harbor-ledger/` | `/design/?design=harbor`    |
| `/previews/still-form/`    | `/design/?design=still`     |
| `/previews/aer-field/`     | `/design/?design=aer`       |
| `/previews/northside/`     | `/design/?design=northside` |

The shared presentation is `assets/demo-return.css`. The head script
`assets/demo-return.js` compares `window.self` with `window.top` and marks
embedded documents before the body is parsed. CSS hides the strip in a frame.
Every internal demo page loads the same script, so internal iframe navigation
keeps the bar hidden. Standalone visits retain the return link, including when
JavaScript is disabled. Existing native demo navigation, disclosures and form
behavior are preserved; no tracking or lead submission is added.

The design-detail iframe retains `sandbox="allow-scripts"`; no same-origin
permission, parent DOM access, referrer inspection, history mutation or cookie
is needed. The existing phone screenshot fallback is unchanged by the bar.
The original banner classes remain available for screenshot-only capture
suppression. Shared asset URLs use content hashes; refresh the hashes in all
27 pages if either asset changes.

## Maintained WordPress source

Northside is the only maintained editable theme source in this checkout.
Its copied return stylesheet/script match the static assets byte for byte.
The return-bar callbacks were tested at version 1.1.1. Their exact functions and return assets were
temporarily loaded into the existing saved Playground for runtime testing,
then the original theme/configuration were restored and hash-checked. No ZIP
was rebuilt or replaced.

The feature defaults **off**. Only an explicitly configured portfolio/demo
installation with `define('JJI_PORTFOLIO_DEMO', true);` in `wp-config.php`
enqueues the assets and substitutes the native `ns-demo` paragraph with return
navigation during frontend block rendering. The WordPress return destination
is absolute: `https://www.justinjindustries.com/design/?design=northside`.
Client installations do not receive JJI navigation by default. The block editor
continues to use the existing native paragraph. Historical packages for other
concepts are excluded from this change and the public artifact.

PHP CLI remains unavailable on this host. The exact source was nevertheless
parsed, loaded and executed successfully in the existing Playground PHP 8.3.33 /
WordPress 7.1.3 runtime. Undefined and explicit-false constants keep the bar and
its assets off; true enables frontend block replacement and both assets, with
the detection script in the head. Native Safari verified the bar hidden on the
embedded homepage and after navigating to Services, visible on standalone
Services, and absent after disabling it. The return link reached the exact JJI
Northside design URL; a Cloudflare security check then paused that destination.
No challenge was completed or Cloudflare settings changed. Full evidence and
restoration details: `wordpress-demo-return-runtime-2026-10-17.md`.

## Local verification and publication boundary

Focused evidence is recorded in `/tmp/jji-return-brand-qa.json` and the matching
log. The full project gate is recorded separately. These are local checks;
the changes require a separately approved release. Production remains at
8636b53 until that release is pushed and its workflow succeeds. No Cloudflare
configuration or legacy redirect rule is changed.

The current local theme source is 1.2.0 with the separately added responsive
navigation enhancement. Shared return-bar code is preserved; new menu behavior
and its native-runtime testing limit are documented in `northside-navigation.md`.
