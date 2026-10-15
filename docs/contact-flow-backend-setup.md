# Contact Flow Backend Setup Notes

This site currently posts contact submissions to Formspree:

- Endpoint: `https://formspree.io/f/mgvlrzdq`
- Form file: `index.html` (`#contact-form`)
- Catalogue enquiry: `design.html` (`#enquiry-form`), using the same endpoint

The catalogue form uses `fetch` with `Accept: application/json`. It shows success
only after an HTTP success response, retains entered values after errors, and
offers a retry or direct email fallback. The interactive local journey was
previously checked with a separate mock endpoint.

On 2026-10-14, a read-only Safari inspection found the Target Email setting
blank and `info@justinjindustries.com` absent from the linked email list. The
owner subsequently added and verified that address. On 2026-10-15, a new
read-only Safari inspection
showed `info@justinjindustries.com` selected as the form's Target Email, with
the form and email notifications enabled. No account setting was changed in
this verification pass. One owner-authorized synthetic test, labeled `TEST
ONLY — JJI catalogue enquiry delivery verification`, was sent directly to the
existing endpoint at 18:39 UTC. The endpoint returned HTTP 200 and
`{"ok":true}`; the dashboard's 30-day submission count rose from 0 to 1.
The browser form itself was not used for this live test. The owner reported no
notification in the `info@justinjindustries.com` mailbox. A follow-up read-only
Safari check found the October 15, 2026, 14:39 America/New_York record with the
same test subject in Formspree's **Spam** tab. The overview showed one spam
submission and zero inbox submissions for the last 30 days. The form remains
enabled, notifications are on, `info@justinjindustries.com` is the selected
target and is verified in the linked-email list, and Formshield is enabled.
The Rules tab offers only an upgrade screen; no custom rules are visible. The
record's accessibility label identifies submission `163104750`. Its `_status`
shows an unauthorized-domain error: the origin did not match
`www.justinjindustries.com`. The test was posted directly to the endpoint,
outside the site's browser origin. Its synthetic email
`qa-catalogue@example.com`, `TEST ONLY` wording, and fake name are additional
test-like signals, but Formspree did not identify them as the cause. The
`_website` column in the submission list is blank, so no filled honeypot value
was visible. There was no outbound email delivery log in the record view.
Formspree intake therefore succeeded, but its domain check rejected this test
for notification purposes. No second test was sent and no account setting or
submission classification was changed. The smallest delivery check is one
owner-coordinated submission through the existing public site's browser form
at `https://www.justinjindustries.com/`, followed by confirmation that the
record lands in Formspree's Inbox and its notification reaches the `info@`
mailbox. Keep the direct email fallback visible until delivery is verified.

At approximately 15:56 America/New_York on 2026-10-15, the approved public-site
test could not begin: Safari showed Cloudflare's “Verify you are human” challenge
at `https://www.justinjindustries.com/#contact` before the contact form loaded
(Ray ID `a4b160e198c0012e`). No challenge response was attempted, no form
fields were entered, and no submission was sent. Resume the one approved test
only after the owner completes the normal browser verification or provides an
already verified Safari session.

The owner subsequently completed the browser verification, submitted the
existing public contact form, and reported receiving its notification in the
`info@justinjindustries.com` inbox on 2026-10-15. This is owner-confirmed
public-origin email delivery; this pass did not independently inspect the
recipient mailbox or record the submission ID. The agent did not submit or
resend a form after the owner's report. This confirms the current public
contact path, while the new catalogue's AJAX enquiry flow remains locally
tested with a mock endpoint and still needs review before deployment.

The owner also reported that the current public form cleared without a visible
thank-you message. The local implementation now handles the Formspree JSON
response directly. It shows a dedicated, focused confirmation only after an
HTTP success with `ok: true`; a failed or unaccepted response leaves the form
and its values available for retry, with a focused error. Safari local mock
checks covered accepted, rejected, `200` with `ok: false`, and repeated-submit
responses. The catalogue enquiry uses the same acceptance check and retains
its existing focused success/error behavior. These changes are local only and
have not been tested with another live submission or deployed.

## Required checks in Formspree

- Confirm form ID `mgvlrzdq` exists.
- Confirm recipient email is verified in Formspree.
- Confirm the form is active (not archived/disabled).
- Enable domain restriction for `justinjindustries.com` (and any approved subdomains used for production form submits).
- Enable Formspree spam filtering / Formshield protections.
- Keep reCAPTCHA disabled unless a custom AJAX key is configured for the current integration path.
- If spam volume increases, consider enabling Cloudflare Turnstile and ensure required token handling is configured.
- If domain restrictions are enabled, confirm production domain is allowed.
- Confirm spam settings (including Turnstile/captcha) are not requiring a missing token.
- Confirm submission count/monthly limits are not exceeded.
- Confirm Formspree dashboard shows rejected submissions/errors when failures happen.
- Confirm a minimal test form can submit to the same endpoint (`https://formspree.io/f/mgvlrzdq`).
- Confirm all new fields are accepted and visible in submission payloads:
  - `inquiry_type`
  - `organization`
  - `opportunity_link`
  - `solicitation_number`
  - `response_deadline`
  - `services_needed`
  - `message`
  - `data_consent`
- Confirm notification email routing for procurement inquiries.
- Confirm spam filtering and honeypot handling for `_website`.

## Privacy and analytics handling

- Do not forward form message contents to analytics tools.
- Keep submission content limited to contact handling and response workflows.
- Ensure any autoresponder text does not request sensitive or controlled information.

## Optional routing enhancement

- If owner wants differentiated handling by inquiry type, configure Formspree rules/zaps by `inquiry_type` (for example, RFQ/RFP vs Subcontracting).

## Owner approval items

- Final wording for consent notice
- Final notification email recipients
- Any additional legal/privacy statement links if published later
