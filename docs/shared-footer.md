# Shared JJI footer

## Editing and publication

Edit `partials/site-footer.html` for footer content and `assets/site-footer.css`
for its presentation, then run `npm run sync:footer`. This updates the complete
static HTML in all eight JJI pages and versions the stylesheet URL by its hash.
No client-side fetch or JavaScript is needed to render or use the footer.

`npm run check:footer` and the public build reject a stale copy. The source
partial is internal and is excluded from the explicit public artifact.
Independent concept/demo websites retain their own footers.

The screen version of the capability statement includes the shared footer;
printing hides it so it does not alter the statement's print layout.
Disclosures retain their full-width position immediately above the footer.

## Design and accessibility decisions

- Render the original JJI monogram once as a faint CSS background centered behind
  the tagline in the identity column (220 px desktop/tablet, 112 px phone). The 4.5% opacity decoration has no accessible image,
  focus target or pointer events, stays inside its box, and is hidden in forced
  colors. The redundant foreground logo/name pair is removed; the approved
  uppercase tagline and legal copyright naming remain. Header brand text uses
  weight 700. Independent demo brands are unchanged.
- Preserve verified email/phone details. No new
  address, social account, legal claim or credential is introduced.
- Use a navy footer in both site themes, with grouped Explore and For buyers
  navigation, a contact area, and a separate policy row. Contact buttons retain
  JJI's existing light/dark button colors and interaction treatment.
- Use the native body-level footer landmark and three distinctly labeled
  navigation landmarks. Group headings remain real headings.
- Provide at least 44 px of link height and a visible white focus ring. Footer
  text/link palette pairs retain at least 9.31:1 contrast even against the
  brightest possible white watermark pixel (4.5% opacity over navy); the white
  focus ring retains at least 15.94:1 contrast. Gradient CTA
  states retain the existing site treatment and require visual interpretation
  alongside automated contrast checks.
- Desktop uses four open columns, tablet uses two columns, and phone layouts
  place brand/contact across the full width with paired navigation groups.

Primary guidance reviewed: [WAI page regions and navigation labels](https://www.w3.org/WAI/tutorials/page-structure/regions/),
[WCAG 2.2 target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
and [visible focus](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).
These implementation checks do not establish formal accessibility conformance.

## Reference comparison and evidence

Compared the section concept and the actual rendered footer using `view_image`.
The reference is retained in the task workspace as
`generated_images/exec-0d63932d-a974-4ef3-b747-c07386b7201c.png`; it is a design
reference and is not a public asset. Composition, open columns, typography,
navy palette and bottom divider/utility row follow that reference. The original
monogram takes precedence over its generated placeholder. The original full
disclosures and established theme-specific buttons take precedence over the
reference's simplified disclosure strip and button.

Responsive and keyboard evidence is in `/tmp/jji-footer-check-initial.json`,
`/tmp/jji-footer-check.json` and `/tmp/jji-footer-*.png`. Safari phone review
confirmed the layout and visible keyboard focus. Tests verify one identical
footer across all eight pages, link target size, no horizontal overflow,
unchanged disclosure placement and hidden print footer. Physical-device and
full screen-reader output are outside this review.

## Copyright name

The shared copyright line uses the approved legal name, JustinJ Industries LLC.
Its final period is sentence punctuation, not part of the legal-name suffix.
The shorter header brand and independent demo identities remain unchanged.
