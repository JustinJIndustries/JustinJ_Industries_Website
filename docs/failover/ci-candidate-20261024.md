# Local CI prerequisite candidate — October 24, 2026

## State and scope

This is a local branch based on production
`d6574ede41a8620f838b6eafd3e7ba76ea7ebf68`. Its origin is the verified public
repository `https://github.com/JustinJIndustries/JustinJ_Industries_Website.git`.
It has not been pushed. The active production workflow, public source, root
package manifest/lockfile, held CMS work and recovery artifacts are unchanged.
The workflow proposal retains its inactive `.yml.example` suffix. No token,
secret, environment, remote run, publisher-state change or deployment occurred.

## Changes in this candidate

- Disable optional setup-node caching; use temporary runner/npm disk only.
- Pin an isolated deployment toolchain to Wrangler 4.152.0, with every registry
  dependency locked by integrity and the Wrangler entry point SHA256 pinned.
  Lifecycle scripts are disabled. No CLI login or deployment was executed.
- Inspect exact GitHub repository/remote, approved workflow SHA, manual main-only
  run provenance, owner-review/main-only `failover-sync` environment protection,
  and an independently paused legacy publisher before considering publication.
  The existing publisher is still active; it was not changed by this task.
- Verify requested origin inventories, response status, bytes and same-origin
  redirects. Security challenges and normal TLS failures stop verification.
  A public-www hash check verifies edge-served bytes; it is not independent proof
  of GitHub origin bytes when a routed fallback exists. Production routing is
  currently absent, and future authoritative origin checks remain a release gate.
- Prepare the initial old-HTML/raw-root stage plus immutable asset namespace.
  Authenticate that stage against approved source and verify final bytes. Bootstrap
  source identity remains
  `623a84da5ab3352ffe6736f335d5e3a2c0d6699c22ce976614fb386ffee9686a`.
- Budget both stage and final transient artifacts plus one compact checkpoint,
  with measured sizes, 20% archive allowance and 20 MiB additional headroom.
  No deletion is assumed. Require explicit retention approval and an owner-held
  recovery archive before one-day CI artifact expiry can be used.

## Read-only account findings

Authenticated GitHub billing overview shows GitHub Free at $0/month. October
metered gross usage is $0.44 and included-usage discounts are also $0.44. The
account-level Actions and Packages budgets each show $0.00 of $0.00 and **Usage
blocked**. These are existing settings, not changes made here.

JJI has zero retained Actions artifacts and two caches totaling 39,596,638 bytes
at inspection. This is repository metadata, not the account's combined artifact
and Packages storage total. Current GitHub documentation gives Free accounts
500 MB shared artifact/Packages storage and a separate 10 GB cache allowance per
repository. The cache figure must not be subtracted from that shared pool.
Current storage and monthly accrued storage also differ.

The personal shared-storage/billing API returned 404 and explicitly requires
additional `user` scope. No scope was added. Existing billing UI exposed spend
and budgets but not a trustworthy current combined storage-byte total. Therefore
free-capacity evidence remains incomplete: do not enable CI uploads by treating
that value as zero or inferring it from the $0 billed amount.

Cloudflare still shows Workers Free as the current $0 plan. One Pages project
exists, with one successful direct-upload deployment `ac3af448`; no Git build
integration exists. Published Free Pages limits are 20,000 files, 25 MiB per
asset, 500 Git builds/month, 100 projects/account and unlimited active preview
deployments. Actual remaining monthly build count was not exposed in inspected
UI. This proposal uploads static prebuilt files, adding no Pages Functions or
Cloudflare Git build. No plan or quota setting changed.

## Cost decision

**No-go for enabling uploads yet.** Existing zero-dollar blocking is useful
provider-side protection, but combined current artifact/Packages capacity is
unverified. The code fails closed on unknown/stale capacity, absent retention
approval or insufficient peak headroom. It does not raise budgets, upgrade plans,
delete recovery artifacts or guarantee ongoing autonomous operation at $0.

## Next smallest step

Obtain a fresh account-wide current shared-storage total from supported account
UI or an owner-provided export without expanding OAuth permissions. Then review
this exact local commit and approve only the next Pages-only integration step:
protected `failover-sync`, a 24-hour Pages Edit token limited to the existing
account, environment-secret storage and reviewed static bootstrap. Worker-edit
credentials and routes remain separate. The proposal still stops at verified
artifact preparation; it intentionally does not enable publication while billing,
environment and publisher-pause prerequisites are unresolved.

## Primary sources

- [GitHub Actions storage, caching and billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Pages direct-upload CI permissions](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
