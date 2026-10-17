# Clean URL migration plan

Prepared for the 2026-10-16 release. Verify publication status separately. The GitHub Pages
workflow builds `dist/` with directory-index pages and retains the matching
legacy `.html` files. The clean URLs below use trailing slashes.

## Route inventory

| Legacy path                                  | Clean path                               |
| -------------------------------------------- | ---------------------------------------- |
| `/index.html`                                | `/`                                      |
| `/about.html`                                | `/about/`                                |
| `/policies.html`                             | `/policies/`                             |
| `/work.html`                                 | `/work/`                                 |
| `/catalogue.html`                            | `/catalogue/`                            |
| `/design.html`                               | `/design/`                               |
| `/government-buyers.html`                    | `/government-buyers/`                    |
| `/capability-statement.html`                 | `/capability-statement/`                 |
| `/previews/alder-lane/index.html`            | `/previews/alder-lane/`                  |
| `/previews/alder-lane/services.html`         | `/previews/alder-lane/services/`         |
| `/previews/alder-lane/about.html`            | `/previews/alder-lane/about/`            |
| `/previews/alder-lane/contact.html`          | `/previews/alder-lane/contact/`          |
| `/previews/harbor-ledger/index.html`         | `/previews/harbor-ledger/`               |
| `/previews/harbor-ledger/services.html`      | `/previews/harbor-ledger/services/`      |
| `/previews/harbor-ledger/about.html`         | `/previews/harbor-ledger/about/`         |
| `/previews/harbor-ledger/faq.html`           | `/previews/harbor-ledger/faq/`           |
| `/previews/harbor-ledger/contact.html`       | `/previews/harbor-ledger/contact/`       |
| `/previews/still-form/index.html`            | `/previews/still-form/`                  |
| `/previews/still-form/work.html`             | `/previews/still-form/work/`             |
| `/previews/still-form/services.html`         | `/previews/still-form/services/`         |
| `/previews/still-form/about.html`            | `/previews/still-form/about/`            |
| `/previews/still-form/contact.html`          | `/previews/still-form/contact/`          |
| `/previews/aer-field/index.html`             | `/previews/aer-field/`                   |
| `/previews/aer-field/work.html`              | `/previews/aer-field/work/`              |
| `/previews/aer-field/services.html`          | `/previews/aer-field/services/`          |
| `/previews/aer-field/studio.html`            | `/previews/aer-field/studio/`            |
| `/previews/aer-field/contact.html`           | `/previews/aer-field/contact/`           |
| `/previews/aer-field/films/golf.html`        | `/previews/aer-field/films/golf/`        |
| `/previews/aer-field/films/real-estate.html` | `/previews/aer-field/films/real-estate/` |
| `/previews/aer-field/films/business.html`    | `/previews/aer-field/films/business/`    |

The four fictional preview sites remain `noindex`. The design-detail route
keeps `?design=alder|harbor|still|aer`, and the government inquiry links keep
their `inquiry_type` query values and `#contact` fragment. Resource URLs and
external links are not redirect targets.

## Edge redirect proposal

Cloudflare's signed-in dashboard showed the zone on the Free plan and **0 of 10
Single Redirect slots used** on 2026-10-16; the Page Rules page also showed
**0 of 3 used**. No rule was created or edited.
After the new Pages artifact is live and its clean routes are verified, add
these three **301** wildcard Single Redirects in this order, each with
**Preserve query string** enabled:

1. `https://www.justinjindustries.com/index.html` →
   `https://www.justinjindustries.com/`
2. `https://www.justinjindustries.com/previews/*/index.html` →
   `https://www.justinjindustries.com/previews/${1}/`
3. `https://www.justinjindustries.com/*.html` →
   `https://www.justinjindustries.com/${1}/`

The specific index rules must run before the general `.html` rule. Verify in
Cloudflare's rule form or simulator that its wildcard capture includes nested
path segments before deploying the third rule. These rules target the canonical
`www` host; inspect the apex and HTTP host behavior before deciding whether
matching rules are needed there. Keep any unrelated rules intact. Cloudflare
documents wildcard replacement, 301 status, and the query-preservation option
at <https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/>.

## Release verification

1. Review the local diff, run `npm run check`, and publish the approved commit
   through the existing GitHub Pages workflow.
2. Verify every clean route returns its intended HTML on the public `www` host,
   including the design query variants, previews, resources, and form UI. Verify
   the removed Metro screenshot is absent from the Pages origin; purge the
   exact `/assets/work/metro-student-loans.png` URL from Cloudflare cache and
   confirm it no longer serves publicly.
3. Deploy the Cloudflare rules, then verify every old path returns 301 with a
   `Location` matching the route table. Check `?design=aer` and
   `?inquiry_type=RFQ%2FRFP`; browsers should retain `#contact` on redirect.
4. Verify old and new paths through Cloudflare, including apex/HTTP behavior,
   mobile navigation, and the sitemap/canonical output. Only then mark the
   migration complete. No test lead needs to be sent for this URL change.

Until the edge rules are deployed, legacy `.html` URLs remain functional with
HTTP 200 responses. Local `npm run preview` tests the Pages artifact, not
Cloudflare's 301 behavior.

After deployment, also verify old homepage fragments `/#about`, `/#accessibility`, `/#privacy`, and `/#government-buyers` reach the corresponding dedicated page, and old `/about/#accessibility` and `/about/#privacy` bookmarks reach `/policies/`. These fragment transitions use client-side JavaScript because fragments are not sent to Cloudflare.
