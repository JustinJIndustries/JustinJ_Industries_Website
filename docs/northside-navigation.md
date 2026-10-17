# Northside navigation: local review batch

## Shared implementation

All five static Northside routes load versioned `navigation.css` and
`navigation.js`. Byte-identical copies live in `northside-wordpress/assets/`;
the maintained theme enqueues them after its main stylesheet and in the footer.
The current local theme source is version 1.3.0. A separate disposable native
runtime now includes the menu and inquiry changes; historical ZIPs are unchanged.

The script progressively enhances the native main navigation only. At 760 px
and below, a real Menu button controls the nav's existing/generated ID with
`aria-controls`, `aria-expanded` and an Open/Close navigation name. The icon is
a decorative inline line SVG. The closed nav uses `hidden` plus an explicit
CSS display rule, so its links are absent from keyboard and accessibility flow.
Without JavaScript, the original navigation stays available.

The menu is nonmodal: Tab follows normal document order; no focus trap is
introduced. Escape closes and returns focus to the button. Button close restores
focus; link navigation starts the new page closed. Breakpoint changes restore
focus to a visible control/link in both directions. No animation is used, so
reduced-motion settings require no extra transition handling. Links/button
retain at least 44 px height. The demo return bar and logo/brand remain separate.

Stronger header-link selectors preserve `inline-flex` alignment against
WordPress navigation-block rules that otherwise set link content to `block`.
The WordPress-markup fixture reproduces the reported 10 px text-center difference
without the new CSS; the shared styles remove it. Desktop Contact appearance
and footer navigation remain intact. The native Navigation block remains
editable; the frontend menu enhancement is not injected into the block editor.

## Verification

- All five static routes at 320/390/430/760/768/1024/1440 px: 35 cases passed.
  Mobile checks cover touch/click, Enter, Tab, Escape, close/reopen, Services
  navigation, correct ARIA state, hidden links, tap sizes and no overflow.
- Desktop label text centers match to less than 1 px. Thirty additional
  WordPress-shaped markup/stylesheet cases pass; CSS/JS copies match byte for byte.
- The JJI embedded phone-width preview keeps its return bar hidden while the
  menu navigates to About, and the next page starts closed. Standalone return
  navigation remains visible. The no-JavaScript fallback remains navigable.
- Focus restoration across the breakpoint passes both ways. Three axe scans
  (320 closed/open and desktop) report no WCAG A/AA violations.
- Evidence: `/tmp/jji-capability-nav-qa.json`,
  `/tmp/jji-northside-wp-markup-qa.json`, `/tmp/jji-northside-focus-qa.json`.

The current navigation/enqueue changes also pass an actual isolated WordPress
7.1.2 / PHP 8.2.29 mobile open/Escape/focus-return test on port 8082. This is
local Chrome automation, not the saved external Playground or physical Safari.
Evidence: `/tmp/jji-final-local-followup-qa.json`.
The earlier return-bar opt-in runtime test is recorded separately and remains
valid for the 1.1.1 callback scope. No physical-device or full screen-reader
conformance claim is made. Keep the batch local for owner review.

The existing Northside 390 × 620 PNG and 1170 × 1860 WebP phone preview pair
was refreshed to show the closed menu instead of the stale wrapped navigation.
Only the capture hides the Demo return bar; standalone pages retain it. The
design-page image/script cache versions were refreshed and the 3× source loads.
