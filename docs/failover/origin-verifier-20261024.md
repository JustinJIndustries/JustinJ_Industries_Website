# Public artifact parity correction — October 24, 2026

## Status and cause

Local correction only. Remote main remains `c71dab4a91698d5e826c07158ceb6cfff645de58`; the original publisher is active and the paired publisher disabled. No new workflow run, upload, Worker, route, credential or infrastructure setting was changed during this correction.

Paired preparation run 40108077419 failed before a Pages preview upload because the verifier treated the public Cloudflare response as raw GitHub origin bytes. Cloudflare inserts email obfuscation, JavaScript Detection, hidden canary markup and a managed robots prefix. These explain the observed differences; a successful public-edge check does not validate or renew the separate GitHub origin certificate.

## Authority and comparison policy

The exact approved source/build identity, protected control-workflow identity and verified immutable package remain authoritative. Bootstrap additionally verifies the last successful original production workflow is for the exact approved source SHA. Preparation and promotion both check this provenance. Later releases retain the primary-response marker requirement so fallback cannot hide a failed origin.

Public comparisons request only `https://www.justinjindustries.com/` with the ordinary Node HTTPS implementation, normal Host/SNI and certificate validation. No IP override, alternate origin host, custom trust store, insecure TLS option or browser/security bypass is used. Same-origin redirects remain bounded; challenge responses and unsuccessful statuses stop verification.

The public verifier reverses only these constrained transformations, then requires complete original byte equality:

- One exact empty hidden same-origin Cloudflare canary immediately after BODY, with a bounded opaque identifier. Identifier values are never logged.
- Cloudflare email XOR encoding only when the decoded complete mailto target, query and displayed email match source. Opening-tag serialization is restored only if all attribute names and values match the reviewed tag.
- The exact pinned email-decoder helper path and full JavaScript Detection template; only constrained Ray/time fields may vary. Code is compared, never executed.
- Only on `robots.txt`, the exact observed 2,676-byte managed prefix with SHA256 `3073d1e371afb3271c7666148766fedc5145f7d8440f7114062db79b7bd58add`, followed by unchanged owner bytes. Cloudflare documents this prepend behavior at https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/ . A changed directive or prefix fails and requires review.

No generic DOM, whitespace, minification, arbitrary-script or asset normalization is accepted. All other assets remain byte-exact. Immutable Pages backup and recovery verification still use raw SHA256 equality, including HTML. Local package bytes are hashed before each comparison and inventories must match a complete package inventory.

## Verification

- 170 local failover tests passed, zero failures. New regressions cover exact known transformations, source/body/form/link/script corruption, unknown transformations, duplicate helpers, changed mailto targets/attributes, BOM/UTF-8, exact robots prefix and owner-body preservation, artifact/provenance/inventory binding, incorrect hosts, primary markers and unchanged strict backup hashing.
- Actual ephemeral localhost TLS tests reject an untrusted certificate and wrong hostname with normal certificate validation. Correct localhost trust succeeds only in that test's explicit local client. No global trust changes occur. Expiration rejection is separately simulated; this is not a newly expired-certificate live test.
- Read-only M1 public verification completed at 2026-10-24 16:28:05 UTC: all 189 baseline files passed, through 240 requests comprising 189 HTTP 200 and 51 HTTP 301 responses. The source is `d6574ede41a8620f838b6eafd3e7ba76ea7ebf68`; namespaced package identity `623a84da5ab3352ffe6736f335d5e3a2c0d6699c22ce976614fb386ffee9686a`.
- Aggregate reversals: 79 canaries, 51 email links, 51 email text nodes, 42 mailto opening-tag serializations, 35 decoder scripts, 79 JavaScript Detection scripts, one managed robots prefix.
- The public verification was a local read-only check, not a GitHub CI attestation. It did not submit forms, execute page scripts, change infrastructure or retry deployment. Production workflow 39871060583 remains successful for the approved source. Separate edge/origin TLS findings remain unresolved.
- Source HTML, repository formatting, changed-code formatting, build, 2,395 local links and the public-content check passed. The build contains exactly 189 files (62,393,537 bytes), each matching the approved source hash; no infrastructure, test or internal documentation file ships. Browser accessibility/layout checks were not repeated because public bytes are unchanged.

## Independent review and correction

Independent read-only review of the original seven-file patch identified one material correctness gap: globally matching known script/email strings could normalize text inside a textarea or other protected HTML context. The original patch was not published.

The revised matcher uses conservative, quote-aware lexical tag boundaries without reserializing the document. Comments, raw/RCDATA elements, templates, foreign content and select/option contexts cannot be rewritten. Crossing an inert boundary or unsupported/malformed declaration fails closed. Canary matching requires the actual BODY tag under HTML. Email link matching requires the actual href attribute of an active anchor. Script removal requires an actual direct BODY child; JavaScript Detection must also be immediately before the actual closing BODY. Unknown script escape syntax fails closed rather than guessing browser interpretation.

Adversarial regressions cover both pinned scripts and email spans in twelve protected contexts, plus mailto/canary strings in attributes, comments, textarea and templates, and a malformed crossing of a template boundary. All 170 tests pass after this correction. The original 167-pass result did not cover these cases and is superseded. A second independent probe found a quoted greater-than character in an attributed raw-text closing tag could prematurely end the lexical boundary. Non-bare raw-text closing tags now fail closed, with regressions for six raw-text element types and both pinned scripts. The original 167-test and intermediate 169-test results are superseded. Independent re-review of this final correction is required before retry.

## Review and retry boundary

This changes the verification policy from raw public-edge hash equality to exact reviewed artifact plus narrowly pinned edge parity. It adds no runtime permissions or changes to the approved site, Worker behavior, deployment sequence or rollback. Unknown future Cloudflare changes stop safely; the pinned parser is intentionally sensitive to template changes.

The correction is within the approved rollout's verification purpose, but this local task explicitly requires parent review of the evidence before any live retry. A retry must first refresh complete storage admission evidence, check current remote/publisher/run state and existing credential validity, and use the exact reviewed new control SHA. The GitHub runner's real execution, preview upload and eventual promotion remain untested for this patch. No claim of live failover readiness is made here.
