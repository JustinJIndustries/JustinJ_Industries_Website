# Manual dashboard Worker handoff — local correction

This control patch is separate from the approved copy source commit
`51aa9e068c0bc49ef180f0dc33144df4e9ea74da`. CMS visuals remain held. No
Worker API key is created or referenced by the paired publisher.

## Trust and exact source identity

The protected owner/main-only proof workflow transports three additional
single-use, nonce-bound Worker readbacks: `workerbaseline`, `workerpromote`
and `workerfinal`. Requests bind the exact source/control/run/release, expected
full deployment/version IDs, configuration, freshness and archive ordering.
The native reader navigates only fixed read-only metadata URLs for the owned
Worker using the existing Safari session. It does not read cookies, keys or
clipboard, inject JavaScript, or issue a provider write. Authentication remains
owner attestation under protected GitHub review, not hardware attestation.

The approved initial deployment is `ca97aae5-2623-4754-8f25-d26b624148f3`,
version `1f8cfb35-4126-4db7-8eef-d70714e6719a`. Its provider script ETag is
`58cc48e3755185408cb01cb63ef5db0b09539f6710d442709015deef531d452f`.
The separately reviewed raw single-file source SHA256 is
`334097948253968287724f06383413321445d7e87fffdc9ceeba0ea6954f01ed`.
The ETag is provider-attested hashed deployed script content, **not** the raw
source hash. This correction permits only unchanged deployed script content.
It checks immutable version identity, ETag, handlers, complete runtime and
bindings against the pinned approved version. The reviewed source has no imports
or external module/resource bindings. It does not trust the mutable editor buffer.
Cloudflare documents the field as hashed script content:
https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/get/

Effective non-versioned settings are pinned by fingerprint to the observed
approved state. The observability container is enabled, while Logs, Traces and
Issues are individually disabled. No setting is changed to resolve this schema
distinction. Any setting drift stops the reader.

## Order and operator steps

1. Fresh public baseline proof completes first. A new `workerbaseline` readback
   immediately verifies the exact old pointer before the first primary stage write.
2. Existing stage deployment/public proof, immutable backup verification and
   durable receipt/archive readback remain mandatory.
3. On `workerpromote`, run the owner helper with operation `begin`, preserving its
   request-bound before state. Confirm the current predecessor still matches.
   Using the existing dashboard, change only the `RELEASE_CONFIG` plain-text value
   to the request's exact configuration; preserve script, other settings and routes.
   Verify its saved 100-percent deployment. Run operation `finish` on the same
   request/destination, then submit and review the generated protected proof.
   Do not repeat an uncertain save; inspect actual deployment metadata first.
4. Only authenticated matching promotion readback allows final primary HTML.
   Fresh final public proof and `workerfinal` immutable metadata readback must
   both pass before paired success is reported.

The helper syntax remains:
`node infrastructure/failover/owner-public-check.mjs RUN PHASE PACKAGE OUTPUT`.
Only `workerpromote` adds a final `begin` or `finish` argument. The same output
folder is used for that pair, never reused for another request. Every other phase
uses a new output folder. Source/control tracked and untracked edits are rejected
from a top-anchored Git pathspec. Missing, stale, mismatched or replayed proof is
refused. A failed Worker gate is latched; later calls cannot return cached success.

## Capacity, rollback and limits

The unchanged cap is 24 retained checkpoint artifacts, with one-day retention.
Preparation reserves the entire next release's 14 checkpoint records before any
provider write; promotion reserves its remaining 12. No automatic pruning or cap
increase exists. Six request/proof pairs at the existing raw byte caps plus 20 percent
framing occupy less than the existing 2 MiB checkpoint reservation. Account-wide
storage/$0 checks and fifteen-minute evidence freshness remain unchanged.

On October 24 the read-only inventory contained 11 checkpoints.11 + 14 = 25, so this
release is blocked before writes. The earliest expiry is October 25 18:39 UTC,
after the existing Pages key expires at 13:41 UTC; waiting alone does not provide a
rollout window. No key renewal or remote deletion is authorized. Verified local
copies of the superseded prepare run 40121633653 baseline request/proof can support
an explicit owner cleanup decision. These are not the current release receipt,
owner recovery archive, deployed backup or asset generations.

Preserve the current successful release/receipts and owner archive. Before final
HTML exposure, a failed manual pointer operation requires inspection and, if
necessary, the exact verified old dashboard configuration while the asset stage
retains both generations. After new HTML exposure, do not restore a raw old build
that drops cached-page assets. Use the existing verified union-asset recovery
process; never blind-retry an uncertain provider write. No routing/security or
publisher rollback is silently performed by this control patch.

Local verification: 210 tests pass, including actual loopback tests and 16 new
manual-handoff regressions. A real M1 read-only capture matches the current full
Worker IDs, source ETag, settings fingerprint and pointer. Its synthetic test run
identity is not admissible hosted CI proof. Protected CI/manual handoff execution
and final content publication remain unverified pending capacity authorization.
