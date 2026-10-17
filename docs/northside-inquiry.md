# Northside heating inquiry maintenance

## Scope and safety

Northside is a synthetic portfolio demonstration. Its contact form previews a
heating inquiry locally. It does not send, store or book anything. Keep this
clear in the form note and success message. Use sample details only.

The three fieldsets cover service/system, issue details and contact preference.
Town or ZIP is sufficient; no street address is requested. Email, Phone and
Either adjust the required contact fields. Keep Not sure options and avoid
promising business hours, emergency dispatch or appointment availability.

Controls intentionally have no submitted names. The preview button is disabled
until the local handler is installed and remains type=button. The script
prevents native submission and uses no fetch, storage or message-delivery API.
The no-JavaScript text explains why the demo check is disabled.

## Maintained sources

- `northside-wordpress/inquiry.php`: renderer, Settings screen and shortcode.
- `northside-wordpress/inquiry-defaults.json`: default labels/options/help/copy.
- `northside-wordpress/templates/page-contact.html`: native Shortcode block.
- `northside-wordpress/demo.js` and `assets/inquiry.css`: local validation/UI.
- `previews/northside/contact/index.html`: static rendering of the same defaults.
- `previews/northside/site.js` and `inquiry.css`: matching public assets.

Keep the JS/CSS pairs byte-identical and refresh static content/version hashes
after changes. `scripts/build-public.mjs` explicitly allowlists the public CSS.
Theme version 1.3.0 includes the inquiry and responsive navigation changes.
Do not replace historical root ZIPs; the current candidate package is held in
the local task workspace deliverables directory.

## Editing in WordPress

Use Settings → Northside inquiry for labels, choices, help and feedback. List
service/system/timing options one per line. Settings sanitize plain text, cap
list length and retain defaults for empty inputs. These settings do not enable
message delivery. The registered Northside heating inquiry pattern inserts
`[northside_demo_enquiry]` in a native Shortcode block. The shortcode can also
be inserted directly; adjacent page content remains editable in blocks.

JJI's homepage journey includes a separate static heating inquiry illustration.
Its fields and Submit action are spans, not form controls. A named image role
summarizes the illustration; its decorative internals stay hidden from the
accessibility tree. Its visible sample note was removed at the owner's request.
This does not change the actual demo or JJI's corporate contact form.

The adjacent homepage-only website example uses “A warmer home starts here.”
and the owner's maintenance/repair sentence, with Request service. It renders
readable HTML and reuses the unchanged approved boiler-room photograph. No
shared cover image or actual Northside homepage/template copy was overwritten.
The inquiry shows service, system, optional timing, a synthetic name/reserved
555 phone number and a short pressure-loss issue. Narrow cards stack fields
and omit timing; the action is display-only. The owner requested no visible
Example/Sample data badges inside this artwork; synthetic context belongs in
the attributed footer disclosure and accessible names. Maintain these examples in
`index.html` and the scoped `.home-story__site*` / `.home-story__form*` rules
in `styles.css`, separately from the actual demo sources.

## Verification on 2026-10-17

Isolated WordPress 7.1.2 / PHP 8.2.29 on M1 Max, with outbound WordPress HTTP
and mail blocked. The native review is http://127.0.0.1:8082/contact/ and the
static review is http://127.0.0.1:8080/previews/northside/contact/.

- Ten static/native layouts at 320/390/768/1024/1440 px: labels, help, ten
  fields, three legends, Not sure, no corporate-service residue or overflow.
- Email/Phone/Either validation, keyboard error navigation, service query,
  reset and success tested in both versions, with zero interaction requests.
- Two focused axe scans report zero violations. Native Settings Save/reload
  changed labels/help/options, appeared on the frontend, then was restored.
- Both mobile menus open and close with Escape/focus return. With JavaScript
  disabled, both forms retain nameless fields and a disabled preview button.

Evidence: `/tmp/jji-northside-form-qa.json`,
`/tmp/jji-northside-settings-qa.json`, `/tmp/jji-final-local-followup-qa.json`.
These checks do not establish formal WCAG conformance, physical-device
coverage or compatibility with every WordPress/PHP/hosting version. No lead
was sent and no production change was made.

The homepage dashboard is a readable summary rather than a scaled full report:
it retains the approved 1,382 leads, 34,941 sessions and 3.96% lead rate. Its
homepage-only synthetic SVG trend was adjusted at the owner's request to end
at the peak. The original dashboard PNG and actual Looker report are unchanged.
The three examples share outer framing/rhythm, with readable native text,
stacking at narrow widths and no active controls.
