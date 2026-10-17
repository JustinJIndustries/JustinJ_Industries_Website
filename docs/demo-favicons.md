# Demo favicon maintenance

Each maintained demo owns a small SVG monogram and a 32 × 32 PNG fallback.
No emoji, font-dependent text or shared JJI icon is used inside these demos.
The PNG is rendered from the SVG. Both head declarations use content hashes.

| Demo          | Mark        | Static source                        | Pages |
| ------------- | ----------- | ------------------------------------ | ----- |
| Alder & Lane  | AL          | `previews/alder-lane/favicon.svg`    | 4     |
| Harbor Ledger | HL          | `previews/harbor-ledger/favicon.svg` | 5     |
| Still Form    | S/F         | `previews/still-form/favicon.svg`    | 11    |
| AER / FIELD   | A/slash     | `previews/aer-field/favicon.svg`     | 8     |
| Northside     | N/underline | `previews/northside/favicon.svg`     | 5     |

Keep each `favicon-32.png` alongside its SVG, allowlist both in
`scripts/build-public.mjs`, and update every page's icon hashes after an edit.
These are standalone demo icons; an embedded iframe does not replace its
parent JJI tab icon. The global `favicon.svg` is unchanged.

Maintained Still Form and Northside WordPress themes use matching assets and
an early wp_head fallback. A configured native WordPress Site Icon takes
precedence. There is no separate maintained Alder, Harbor or AER WordPress
theme in this checkout; historical archives are unchanged.

## Verification on 2026-10-17

All 33 static demo pages and both isolated native WordPress front pages load
their own versioned SVG/PNG declarations with HTTP 200 and correct MIME types.
All PNGs decode at 32 × 32. Body hashes for all 33 pages and the global JJI
favicon hash are unchanged by this icon-only work. The five vector proofs
were inspected at small size. Evidence: `/tmp/jji-final-local-followup-qa.json`.
Actual Safari tab-cache repaint of these unpublished assets is unverified;
content-versioned dedicated URLs avoid reuse of the old shared icon URL.
