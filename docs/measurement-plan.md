# Measurement Plan (Draft)

Date: 2026-05-09

## Purpose

Provide a conservative, privacy-aware measurement baseline for JustinJ Industries website interactions without collecting sensitive form content or unnecessary personal data.

## Principles

- Track only events needed for site performance, CTA effectiveness, and implementation QA.
- Do not send form message bodies, names, email addresses, or other direct identifiers to analytics tools.
- Keep event naming consistent and documented.
- Validate events in QA before production release.

## Current implementation status

- No analytics vendor script is currently implemented in repository code.
- CTA elements now include standardized `data-analytics-event` attributes for future instrumentation.
- Contact form submission uses Formspree endpoint for contact handling.

## Event naming convention

Format: `area_action_object`

- Lowercase snake_case
- Verb-based action
- Stable names; avoid frequent renames

Examples in current HTML:

- `cta_start_project`
- `cta_government_buyers`
- `cta_discuss_solicitation`
- `cta_view_capability_statement`
- `cta_request_capability_statement`
- `cta_subcontracting_contact`
- `cta_contact_view_capability_statement`

## Event dictionary (proposed)

1. `cta_click`

- Trigger: click on an element with `data-analytics-event`
- Required parameters:
  - `event_name`: value of `data-analytics-event`
  - `page_path`
  - `section_id` (if known)
- Disallowed parameters:
  - `name`, `email`, `message`, `organization`, raw URL query params containing personal data

2. `contact_submit_attempt`

- Trigger: submit click/submit event on `#contact-form`
- Required parameters:
  - `inquiry_type`
  - `has_opportunity_link` (boolean)
  - `has_solicitation_number` (boolean)
- Disallowed parameters:
  - all free-text field contents

3. `contact_submit_success`

- Trigger: Formspree request returns success
- Required parameters:
  - `inquiry_type`

4. `contact_submit_error`

- Trigger: Formspree request fails
- Required parameters:
  - `error_type` (`validation`, `network`, `provider`)

## PII and sensitive-data exclusions

Never send these values to analytics:

- Name
- Email
- Message body
- Company/organization free text
- Opportunity URLs that may contain tokens or sensitive query strings
- Solicitation numbers entered by users if they could be sensitive in context

## QA and validation checklist

- Validate event names against this document before launch.
- Verify no form text fields are included in analytics payloads.
- Confirm consent-aware behavior if analytics is enabled in future.
- Confirm no duplicate event firing.
- Confirm all CTA events map to expected user actions.

## Owner decisions required

- Approve analytics vendor(s) before implementation.
- Approve final event list and retention approach.
- Approve whether solicitation number should be tracked as a boolean-only presence field.
