# Authorized backup-only CI test

This workflow is manually triggered on main, owner reviewed in `failover-sync`,
and has contents/actions READ only. It cannot deploy GitHub Pages, change Worker
routes, edit DNS/TLS/WAF, change project settings or alter the primary publisher.
Only the approved Pages token is mapped to its upload/verification step.

The source checkout is fixed to production `d6574ede41a8620f838b6eafd3e7ba76ea7ebf68`,
public build identity `623a84da5ab3352ffe6736f335d5e3a2c0d6699c22ce976614fb386ffee9686a`.
Held CMS and other unpublished work are absent. Support modules/toolchain come
from locally reviewed `7fbe958`; no primary bootstrap/coordinator is included.

Publish this infrastructure-only commit with GitHub's documented `[skip ci]`
message to suppress the existing push publisher for this commit only. It remains
active and byte-identical. Confirm no production push run was created, then
manually dispatch the exact reviewed workflow commit. The Pages site uses
workflow builds, so this does not request a branch-based production rebuild.

The test uses only preview branch `backup-ci-test-20261024` of existing project
`jji-backup-20261023`. It reads the actual production branch/canonical deployment
before upload, rejects a matching production branch, verifies environment=preview,
source metadata, all public hashes and confirms canonical production unchanged.
No custom domain or project setting is written. Wrangler logs/telemetry are off;
its output is captured privately and never dumped on error. Upload executes once.
Unknown outcomes stop. If a preview already exists, inspect its UUID and explicitly
use verification-only mode; never blindly re-upload or rerun an uncertain write.

The receipt is a genuine immutable-origin recovery receipt after actual byte
verification, not primary-promotion authorization. Restore both public and old-root
stage from HTTPS, upload only <=2 MiB of sanitized receipts for ONE DAY, download
those actual artifact bytes, compare them, then perform hosted recovery again.
Local owner-held recovery archives are preserved. Existing raw backup is the
bootstrap ancestor; the new prepared preview is not a paired primary bootstrap.

Only standard public GitHub runners, no optional caches, the existing free static
Pages project and no Functions are used. Fresh operator verification of Actions/
Packages $0 paid-usage blocking is required. This test-specific attestation is not
inventory-based primary bootstrap admission or authoritative available quota.
Any provider/quota rejection stops; no cleanup, upgrade or new scope is attempted.
Small receipt expiry is test-only; no production seven-day retention policy is
activated. The credential expires October 25, 2026 at 9:41 a.m. Eastern.

No inquiry submission or live failover is part of this test. The owner-required
environment review is a normal approval, never an administrator bypass. A later
paired primary bootstrap, persistent synchronization, credential renewal, Worker
configuration and traffic routes require separate authorization.
