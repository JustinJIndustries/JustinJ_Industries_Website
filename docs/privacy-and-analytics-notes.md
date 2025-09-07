# Privacy and Analytics Notes

Date: 2026-05-09

## Summary
This site is currently structured for privacy-conscious contact handling and conservative measurement readiness.

## Current risk review
### Third-party scripts
- No analytics vendor scripts are currently loaded in `index.html`.
- No tag manager containers are currently loaded in repository code.

### Contact data handling
- Contact form posts directly to Formspree endpoint.
- Site copy explicitly instructs users not to submit sensitive information.
- Site copy states form submissions are not sent to analytics.

### PII analytics risk
- No analytics implementation is present in code today.
- Risk becomes implementation-time if analytics vendors are added later.

## Trust messaging added
- Government Buyers copy now emphasizes documented, testable, privacy-aware measurement.
- Privacy and Responsible Measurement section added to homepage.
- Contact form note links users to privacy section.

## Required guardrails for future analytics implementation
- Do not introduce new analytics vendors without owner approval.
- Do not collect or forward name, email, message, or other PII to analytics payloads.
- Use event-name standards from `docs/measurement-plan.md`.
- Keep sensitive fields in contact workflow only.

## Manual configuration items remaining
1. Formspree settings review:
- Verify retention, notifications, and access controls for submissions.
- Confirm no external forwarding of full message contents.

2. Analytics enablement (if later approved):
- Implement consent-aware behavior.
- QA payloads to confirm no PII fields are transmitted.
- Add release checklist sign-off before production deployment.

3. Content governance:
- Keep privacy/measurement statements factual and non-legal in tone.
- Review copy whenever new tooling is introduced.

## Limitations
- This file is an implementation note, not legal advice.
- No formal compliance claims (HIPAA, FedRAMP, SOC 2, etc.) are made.
