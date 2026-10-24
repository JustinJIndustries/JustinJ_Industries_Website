# Lean local failover candidate — October 24, 2026

Historical candidate record. The operative local follow-up is [inactive wiring](inactive-wiring-20261024.md).

## Status

Local revision of `ac53eaa591c98d06f720590c6df7c15c9e38c859`, in a separate
checkout. The original candidate and existing backup ZIPs/immutable deployments
remain unchanged. No push, remote CI, upload, credential, secret, billing change,
route or production deployment occurred. The workflow still ends in
`.yml.example` and does not publish anything.

## What changed

The future CI path no longer uploads a duplicate full public-tree checkpoint to
GitHub. Stage/final/Cloudflare working trees stay on temporary runner disk in the
same job. Only a small recovery receipt would persist as an additional artifact.
The required stage and final GitHub Pages deployment artifacts remain budgeted;
no deletion is assumed to make the numbers fit.

The prior checkpoint helpers remain solely for owner-held archive compatibility.
They are not called by the lean workflow. No existing archive was deleted.

`recovery-receipt.mjs` records the release metadata, public/stage manifests, exact
file sizes, source/workflow provenance, current immutable Pages origin and its
predecessor origin. The hard receipt limit is 1 MiB. It contains no site bodies,
credentials or private query data. Unknown metadata fields are rejected.

Its SHA256 must come from an independently approved release ledger/provider
artifact, never from the same downloaded receipt. Existing trusted-main/run and
protected-environment checks still apply. A digest alone is not proof of which
person approved a release, and these receipts are not digitally signed.

## Verified recovery

1. Issue a receipt only after checking all current and ancestor file bytes at
   the exact immutable deployments. For bootstrap, the ancestor is the preserved
   approved raw-site backup; for later releases it is the previous receipt's
   deployment. The current verified raw backup is not a completed namespaced
   bootstrap and cannot be silently substituted for one.
2. Store the receipt through a journaled write-once adapter and read it back.
   The independent digest and manifests must match. Unknown write outcomes stop
   the release and require reconciliation; there is no automatic write retry.
3. A fresh runner verifies that externally pinned receipt before writing a new
   scratch directory. It downloads files from the current immutable origin,
   checks sizes and SHA256, then reconstructs old HTML/root files from the
   predecessor. Matching immutable files are reused locally.
4. Verify both complete trees against the original metadata before they can be
   used as a predecessor or rollback package. Partial downloads never gain a
   publishable release.json. Existing output directories are refused.

Recovery permits HTTPS only on eight-hex deployment hosts of the existing Pages
project. Same-origin canonical redirects are bounded and checked. Foreign
redirects, loops, challenges, wrong status, missing/corrupt/oversized files and
unsafe paths stop it. Cookies/authentication are not forwarded. Header and body
waits have per-file and total network deadlines, including non-cooperative mock
fetches. No URL queries or provider exceptions are logged. Filesystem failure
also stops publication; CI still needs a job timeout and sufficient scratch disk.

No remote-recovery copy was created in this task. Receipt issuance and complete
site recovery were tested with local simulated origins; the simulated receipt is
explicitly named and is not a real deployment receipt.

## Ordering and rollback

Normal release: verify predecessor/current state → publish old HTML plus old/new
assets → verify → publish/verify immutable backup → durably record/read back its
small receipt → promote fallback pointer → publish new primary HTML → verify.
A missing or mismatched durable receipt stops before pointer/primary promotion.
Bootstrap uses the same durability boundary but has no Worker pointer to promote.

Rollback restores the old root/HTML while retaining every asset exposed by the
newer release. Its new immutable recovery receipt rebases the release metadata
around that restored root and asset union. A subsequent release therefore retains
newer assets still referenced by cached pages. Restoring a bare old checkpoint
that drops those assets remains forbidden. No fallback-on-404 exception was added.
Referenced current and predecessor immutable deployments must be retained, as
must owner-held receipts/archives. Their deletion/retirement requires review.

## Measured storage

The unchanged JJI source build has 189 files. Its namespaced public tree has
297 files and 123,682,823 bytes. The locally simulated receipt is 260,225 bytes.
All 297 final and 297 rollback-stage files recovered with identical manifests.
The full-site test also caught and fixed overly restrictive validation of the
existing `@3x` asset names; those are now covered by regressions.

For the same package, using a **synthetic empty current pool only for comparison**:

| Conservative reserved GitHub peak |       Bytes | Approx. MiB |
| --------------------------------- | ----------: | ----------: |
| Prior `ac53eaa` design            | 466,425,073 |       444.8 |
| Lean design                       | 319,068,588 |       304.3 |
| Reduction                         | 147,356,485 |       140.5 |

That is a 31.6% reduction. The lean guard reserves the entire 1 MiB receipt cap
with a 20% archive allowance, both deployment artifacts with the same allowance,
and 20 MiB extra headroom. These are conservative local estimates, not a provider
invoice measurement. Existing shared storage must be added to the peak.

The source byte identity remains
`623a84da5ab3352ffe6736f335d5e3a2c0d6699c22ce976614fb386ffee9686a`.
Public content, canonicals, forms and the existing 52 redirect mappings did not
change. Infrastructure, receipts and tests remain outside the public artifact.

## Remaining limits and approval gates

The existing account inventory showed zero retained Actions artifacts across
all eight owner repositories and an empty owner Packages view. The supplied CSV
records accrued GB-hours, not instantaneous quota. Storage-accounting delay or
historical quota state can still make an upload fail. The code stops on quota
refusal and never deletes data, raises budgets, upgrades plans or weakens checks
to get past it. Missing/stale account capacity evidence still fails the guard.

The 200 MiB public-tree, 2,000-file and 16-generation limits remain. Image-heavy
asset history may hit the byte cap after only a few generations. Receipt history
also consumes some storage. There is no indefinite autonomous $0 guarantee or
automatic pruning. Optional caches stay disabled. Both current provider plans
and zero-dollar paid-usage blocking must be rechecked before future activation.

Transient artifact expiry and receipt retention (proposed at most 90 days) require
explicit approval plus independently archived recovery copies. No expiry or
retention setting was changed here. A receipt/upload failure preserves the prior
working site and stops later phases, although an already uploaded unrouted Pages
preview may need manual reconciliation. No cleanup is automatic.

Next: review this local diff and its tests; settle the supported capacity/guard
attestation and protected CI publication wiring. Then separately approve the
Pages-only credential/environment/secret storage and bootstrap. Worker promotion,
OIDC/deployment environment alignment, real route behavior, quota fail-open and
production activation still need separate review/approval. The existing 23-case
isolated Worker test does not establish this new receipt recovery in production.
