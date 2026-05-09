# Contact Flow Backend Setup Notes

This site currently posts contact submissions to Formspree:

- Endpoint: `https://formspree.io/f/mgvlrzdq`
- Form file: `index.html` (`#contact-form`)

## Required checks in Formspree

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
