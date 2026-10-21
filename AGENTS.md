# JustinJ Industries Website — Codex Instructions

## Project context

JustinJ Industries is a Boston-based web, analytics, and digital implementation studio. The website positions the business around accessible websites, reliable analytics/tagging systems, documented measurement workflows, privacy-aware implementation, and practical handoff support.

Current priorities:

- Web development
- WordPress and Craft CMS support
- GA4 and GTM implementation
- Consent-aware analytics
- Server-side tagging support
- Data Studio dashboards
- Technical SEO and schema
- Accessibility-first implementation
- Security-minded coding practices
- Documentation and handoffs
- Government-buyer and prime-contractor readiness

## Brand direction

Preserve the current polished, technical, concise brand direction. Do not redesign the site unless required for accessibility, usability, or clear procurement-readiness value.

Use professional, direct copy. Avoid exaggerated procurement language.

## Government-contract truthfulness rules

Do not invent or imply:

- Government clients
- Government past performance
- SAM registration
- UEI
- CAGE
- NAICS codes
- PSC codes
- Certifications
- Contract vehicles
- Security clearances
- Insurance coverage
- Socioeconomic status
- Agency relationships
- Compliance certifications

If a procurement detail is unknown, use conservative public copy such as:
“Procurement profile available upon request.”

Keep detailed missing fields in internal documentation only.

## Confidentiality rules

Do not expose confidential employer, client, healthcare, financial services, analytics, tagging, or internal business information.

Anonymized commercial examples may be used only when they do not reveal client/employer identity and are not presented as government past performance.

## Accessibility and Section 508 posture

Use semantic HTML, accessible forms, visible focus states, keyboard-friendly navigation, and conservative accessibility language.

Do not claim “fully compliant,” “Section 508 compliant,” or similar unless a real audit verifies it. Prefer language such as:
“Accessibility conformance should be validated for each project’s scope, content, and platform.”

## Privacy and analytics rules

Do not add tracking scripts or analytics vendors without owner approval.

Do not send names, emails, message fields, solicitation details, or other sensitive form contents to analytics.

Measurement work should be documented, testable, and privacy-aware.

## Code quality expectations

Preserve static-site architecture unless explicitly instructed otherwise.

Before finalizing changes, run available checks only when permitted:

- npm run check:html
- npm run check:links
- npm run check:a11y
- npm run check:format
- npm run check

If checks cannot be run, document why.

## Public content hygiene

Keep audit notes, AI work notes, TODOs, owner-review instructions and internal reports out of all JJI, client and demonstration websites, including HTML comments and shipped scripts/styles. Store work records outside deployment artifacts. Review rendered pages and built source before release. Preserve required licenses, attribution and truthful disclosures; never falsely claim authorship. Use the public-content release check where available and manually review its findings.

## Disclosure placement

Place public disclosure blocks at the bottom of each page, immediately above the shared footer and within the established content margins. Preserve mobile gutters. Consolidate necessary disclosures into concise, readable notes; do not repeat qualification text throughout an illustration or on every validation row. Keep compact Demo labels and useful technical explanations beside their relevant content. Preserve substantive limitations, required licenses and attribution, and truthful accessibility language. Do not present static demo values as captured client evidence. When a task is scoped to specific pages, report other placements for later alignment instead of silently changing unrelated pages.

## Documentation expectations

Keep internal documentation under /docs.

Update docs/final-govcon-readiness-summary.md after meaningful changes.

Use docs/owner-data-needed.md to track missing owner-supplied procurement data.

## Opportunity documents

Opportunity documents may live under capture/opportunity/ for local analysis. Do not publish confidential solicitation details. Public site changes should be reusable, truthful, and not overly tailored to a single opportunity.

## Shared process copy

Preserve these exact owner-selected stage headings in the Home and Services overview process sections: “Define the need”, “Build and Validate”, and “Document and Handoff”. Supporting copy must explain goals/requirements/success criteria; building and validating the agreed solution; and useful documentation with a clear handoff. Do not rewrite these headings during vendor or marketing copy updates. Distinct technical implementation examples keep their own relevant headings.

## Reporting product naming

Use Data Studio in current public marketing copy. The owner prefers this name without the Google prefix. Google renamed Looker Studio in April 2026. Keep the separate Looker product distinct, preserve historical records and source filenames, and do not rewrite report URLs/IDs solely for branding. Adobe Analytics Analysis Workspace is a separate reporting tool.
