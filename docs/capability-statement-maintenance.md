# Capability statement: source, build and review

## Public artifacts

- `capability-statement.html` is the semantic source and matching responsive HTML.
- `assets/justinj-industries-capability-statement.pdf` is its branded one-page
  Letter PDF. The HTML actions and Government Buyers page link directly to it.
- The statement uses existing business contacts, the approved three-part brand
  tagline, a revision date, three service groups/outputs, concise working
  practices and two accurately distinguished examples. UAid is a nonprofit
  website contribution; Northside is a separate synthetic website/reporting
  demonstration, not client results or an integrated client implementation.
- Public procurement wording invites a solicitation-specific discussion. No
  private completed profile, code, certification, contract award, staffing,
  eligibility or response guarantee is asserted.

## Regeneration and integrity

After editing the HTML, logo or shared footer CSS, run `npm run sync:footer`
then `npm run build:capability`. The generator uses the existing Puppeteer/
Chromium toolchain, serves only approved local sources on a temporary loopback
port, blocks external resource fetches, and renders the same HTML under its
print stylesheet. No screenshot or separate text-only PDF source is used.

The generator requires exactly one page, a tagged structure and en-US language.
It writes `docs/capability-statement-pdf-build.json` with PDF/source hashes.
`npm run check:capability` and the public build reject stale or altered output.
Update the visible revision date and download URL revision when appropriate.
Keep PDF-included links absolute so the downloaded document points to public
pages rather than localhost. Internal review documents are not public assets.

The public build copies the reviewed binary; deployment does not silently
regenerate it with a different browser/font. Use `npm run check` before review.
A source change that affects the shared footer can require PDF regeneration,
even though that footer is hidden in print; this conservative gate avoids drift.

## PDF accessibility boundary

Chromium exports selectable text, working link annotations, document title,
en-US language and marked/tagged structure with heading/list/link semantics.
The original logo is decorative in the HTML. The HTML remains the accessible
alternative and supports responsive reflow and keyboard navigation.

These checks are not PDF/UA certification or a complete assistive-technology
review. No formal PAC/veraPDF conformance report or full screen-reader reading
order test has been performed. Retain the HTML alternative and validate any
solicitation-specific document requirements separately.

## Local review only

This revision and the existing branding/demo/navigation batch are uncommitted
and unpublished. The owner's review must precede a commit or production push.
Use `http://127.0.0.1:8080/capability-statement/` for review and the download link
there for the PDF. `docs/apex-first-meeting-review.md` is the separate private
verification checklist for Michelle and the owner.

## Verified local revision

The October 17 PDF has one 612 × 792 pt page, selectable text and seven link
annotations with public/email/telephone destinations (none point to localhost).
The actual download matches the reviewed hash; Print invokes the browser print
flow. Eight focused axe scans and 24 responsive/theme cases pass; the full
project gate passes. Tagged PDF structure includes H1/H2/H3, list/list-item and
link elements, plus en-US language, document title and outline. PDFKit detects
no out-of-page character bounds. These are implementation checks; formal
PDF/UA and complete screen-reader reading order remain unverified.

## Statement-only colour mark

The statement uses the existing transparent white monogram as a CSS alpha mask,
filled with restrained blue/cyan (`#62a8ff` to `#5de3eb`). This is a presentation
treatment of the unchanged raster silhouette, not a newly traced vector logo.
The mark retains the same screen/mobile/print dimensions, is decorative, and
has no glow or baked background. Original logo files and other site logos are
unchanged. The print renderer loads the same locally allowed source asset.
