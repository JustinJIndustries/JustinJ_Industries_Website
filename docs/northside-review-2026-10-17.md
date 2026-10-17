# Northside service-site enhancement — approved release

## Release boundary

Production commit `bc75cfa499aa344b84591240b574dbea9da00982` was pushed and deployed successfully in GitHub Actions run `39019175180`. All 125 files at the GitHub Pages origin matched the reviewed build byte for byte. Live Safari checks passed film pause/resume, the silent-film disclosure and zoomed enquiry access/Escape return. Public command-line requests still receive Cloudflare's managed 403, while the existing Safari session can load the public site. No Cloudflare, DNS, certificate or security setting was changed.

The owner approved publication of the enhanced Northside site and its matching homepage journey cover on 2026-10-17. This document records the reviewed release scope; deployment success is verified separately after the commit is pushed.

## Design changes

- Preserved the approved boiler-room photograph without editing its pixels. Built a light split hero around it, with “A warmer home. A clearer next step.” and direct inquiry/service actions.
- Replaced generic cards with a restrained service rail and useful detail for boiler care, heating repairs and replacement planning. Added a short three-step conversation/process section and maintenance FAQs.
- Gave Services, Boiler Care, About and Contact matching typography, spacing, navigation and inquiry paths. About describes the approach without invented history, qualifications or customer proof.
- Kept an exact “Demo” strip and synthetic-content disclosure. The form uses sample details, never sends a request, and confirms “Demo only: no message was sent.” Service links preselect their topic through the query string.
- Updated local catalogue/phone captures and the shared design metadata. The original approved photo remains the asset used by both the static preview and theme.

## Editable WordPress version

Version 1.1.0 uses native Group, Heading, Paragraph, Buttons, Image, List, Details, Navigation and template-part blocks. The demonstration form remains a native Custom HTML block with a small theme script; no form plugin or delivery endpoint was added. Header, navigation, footer, imagery and surrounding content remain editable.

Installed and activated in the browser-local Playground scope `ambitious-abandoned-river`. Created real Services, Boiler Care, About and Contact pages so all navigation destinations render their matching templates. The WordPress `/boiler-care/` page corresponds to static `/previews/northside/services/boiler-care/`.

The Site Editor exposes native headings and the Image block without an invalid-block warning. Changed the service heading, saved, loaded the frontend to verify persistence, then restored and saved the intended copy. Both changed and restored frontend states were verified. The Contact page preserved `service=Heating%20repairs` and its sample submission displayed the non-sending confirmation.

The theme source is included in the release commit; the ZIP is local and excluded from the public build. Playground is a browser-local runtime, not a durable public WordPress deployment; keep its host tab open for review.

The final archive was installed through WordPress's overwrite flow and confirmed “Theme updated successfully.” The restored homepage heading and approved photograph were verified again afterward. The release archive was rebuilt after removing submission names from demonstration form fields, so a JavaScript-disabled fallback cannot serialize names, emails or message contents into a URL. This packaging-only privacy guard was not reinstalled in the browser-local Playground. All archive entries match their source files. Archive SHA-256: `989d416998d958bdd893de9c80c70c17bacaf7388b14c4c15b02e827a76ccd9c`.

## Verification and fidelity

Safari was the interactive review browser. Reviewed the static phone and desktop layouts, native WordPress desktop/tablet/phone layouts, page navigation, native editing and the inquiry confirmation. Existing headless repository tools supplied mechanical viewport checks and local asset captures: 20 page/viewport combinations at 320, 390, 768 and 1440 px passed with no overflow, page errors, missing resources or broken images. Five axe page checks had zero violations and zero incomplete rules. Keyboard FAQ expansion, service preselection and zero form POSTs passed.

`npm run check` passed after the final cover update: 129-file build, 1,259 local references, HTML validation, six Pa11y pages and formatting. Its temporary server logged an address-in-use error because the requested 8080 preview was already running; Pa11y successfully checked that existing server and the overall command exited zero.

The shared design-tab audit and 35-route browser smoke also pass after the metadata and preview-image updates.

Two Image Gen layout references are retained in the task workspace's `generated_images/`: `exec-22731ebd-3edf-4cfb-a154-793cd0c3ce11.png` (hero/service rail) and `exec-6c5e9ceb-c9f5-4a3b-8bbf-bb791a9ba6b5.png` (process/FAQ/closing action). They are design references, not shipped UI or replacement photographs. Compared the references and current rendered captures with `view_image`, including the 1536×1024 desktop reference size. No new third-party production image was introduced.

| Comparison           | Implementation / intentional refinement                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition          | Light split hero, large un-tinted approved photograph, open service rail, split process/FAQ and a navy closing action.                                                                      |
| Palette              | Warm paper `#f6f5f0`, navy `#163542`, accessible teal `#176f72`; no image wash or invented decorative effects.                                                                              |
| Typography           | Explicit system-sans heading/body/control scale. Enlarged the desktop heading after comparison; retained readable phone wrapping.                                                           |
| Copy                 | Hero matches the reference. Service descriptions are deliberately more conservative than generated promotional copy. Header uses concise “Contact” so five phone links fit more easily.     |
| Containers           | No generic card stack. Fine separators organize services/process. Closing band stays inside the site's content width for consistency with the existing theme.                               |
| Mobile / interaction | Single-column content and full-width form controls; short header nav. FAQs start closed to keep phone pages concise. Native details and visible two-color focus remain keyboard accessible. |
| Assets               | Original approved photograph takes precedence over any small differences in the generated reference. New catalogue/phone images are captures of the actual code.                            |

Review evidence is in `/tmp/northside-review/` and `/tmp/northside-review-check.log`; native Safari screenshots and state checks are also in the task conversation. These checks are engineering evidence, not formal WCAG/Section 508 certification or physical-device testing.

## Homepage journey cover

The shared homepage/catalogue cover is a capture of the actual enhanced Northside header and full hero, ending before the next service section. It includes the navigation, complete headline, inquiry action and unchanged approved boiler-room photograph. Capture viewport: 1100 × 800 CSS px at 2× density; output: 2200 × 1206 px. Responsive WebP derivatives at 640, 1280 and 2200 px accompany the PNG fallback. Contain sizing preserves all essential content. The homepage uses its natural image aspect ratio at phone/tablet widths.

Safari Responsive Design Mode review at 1440, 768 and 390 px confirmed the cover fits the journey without cropping or distortion. Eight mechanical homepage/catalogue cases at 1440, 768, 390 and 320 px passed, verifying image decoding, responsive WebP selection, no horizontal overflow and no page/console errors. Evidence: `/tmp/northside-cover-check.json` and `/tmp/northside-cover-*.png`. Browser plugin was unavailable; native Safari supplied interactive visual review and the established repository browser dependency supplied mechanical checks and captures.

## Review URLs

- Static site: `http://127.0.0.1:8080/previews/northside/`
- Integrated catalogue: `http://127.0.0.1:8080/catalogue/`
- Interactive design presentation: `http://127.0.0.1:8080/design/?design=northside`
- Playground scope: `https://playground.wordpress.net/scope:ambitious-abandoned-river/` while its host runtime remains open.
