# Accessibility and Section 508 Readiness Notes

Date: 2026-05-09

## Scope
Files reviewed and updated:
- `index.html`
- `styles.css`
- `script.js`
- `capability-statement.html`

## Improvements implemented
### Semantic structure and landmarks
- Preserved semantic landmarks (`header`, `nav`, `main`, `section`, `footer`).
- Added an explicit Accessibility Statement section on the homepage.

### Government-facing accessibility language
- Added careful Section 508-aware language to the Government Buyers section:
  - Accessibility support and QA are provided.
  - Final conformance is validated per project scope/content/platform.

### Keyboard and focus
- Added global `:focus-visible` styling for links, buttons, inputs, textareas, and selects.
- Preserved visible focus indicators (no outline suppression).
- Kept skip link behavior and improved overall discoverability via consistent focus ring.

### Mobile menu accessibility
- Added `aria-controls` to the menu button.
- Added `aria-hidden` state management for overlay dialog.
- Added dynamic `aria-label` updates (`Open menu`/`Close menu`).
- Added focus return to menu button when dialog closes.
- Added basic Tab focus trap behavior while menu is open.
- Preserved Escape-to-close support.

### Motion preferences
- Updated smooth-scroll behavior to respect `prefers-reduced-motion: reduce`.

### Form accessibility
- Preserved explicit labels and required attributes.
- Preserved accessible inline error/success status region (`role="status"`, `aria-live="polite"`).
- Preserved `aria-invalid` error-state signaling.

### Touch targets
- Enforced minimum 44px height for key controls (`.btn`, `#theme-toggle`).

### Capability statement print accessibility
- Replaced `javascript:` print link with a semantic button + unobtrusive JS listener.
- Kept print stylesheet and print-friendly one-page structure.

## Remaining manual checks (required before compliance claims)
These checks require manual assistive-tech and browser testing:
- Keyboard-only test through all controls and modal menu.
- Screen-reader pass (VoiceOver + NVDA/JAWS if target environments require) for:
  - menu open/close behavior
  - form labels and status announcements
  - heading navigation
- Color contrast verification with tool-based checks for both dark and light themes.
- Zoom/reflow checks at 200% and 400% where applicable.
- Touch-target testing on real mobile devices.
- Print preview verification on target browsers/printers for capability statement readability.

## Section 508 posture
- This update improves readiness and demonstrates accessibility-oriented engineering practices.
- It is **not** a formal Section 508 or WCAG conformance certification.
- Formal conformance should be determined by project-specific audit and testing evidence.

## Notes and limitations
- No automated accessibility test suite is configured in this repository.
- No build/lint/typecheck/test toolchain is configured, so automated validation commands were not run.