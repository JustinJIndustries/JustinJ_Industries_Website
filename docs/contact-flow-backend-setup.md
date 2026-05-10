# Contact Flow Backend Setup Notes

This site currently posts contact submissions to Formspree:

- Endpoint: `https://formspree.io/f/mgvlrzdq`
- Form file: `index.html` (`#contact-form`)

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
