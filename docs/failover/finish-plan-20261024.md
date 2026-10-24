# Finish plan after the successful backup-only CI test

Historical checkpoint before the concrete wiring follow-up. The remaining local
connection work described here is superseded by
[the concrete paired publisher](paired-publisher-20261024.md). Live approvals
remain pending; this older checkpoint is not an operative activation instruction.

## Verified checkpoint

Checked on M1-Max-MacBook-Pro, arm64, October 24, 2026. Remote main is
`632ad710ab147dd7277eac3559b4cff74304347b`. The backup-only workflow run
[40101200393](https://github.com/JustinJIndustries/JustinJ_Industries_Website/actions/runs/40101200393)
completed successfully. The last primary publishing run is still
[39871060583](https://github.com/JustinJIndustries/JustinJ_Industries_Website/actions/runs/39871060583),
public source `d6574ede41a8620f838b6eafd3e7ba76ea7ebf68`.

Actual remote recovery/readback verified all 297 public and 297 staged files at
`https://50e9689e.jji-backup-20261023.pages.dev/`. This is a preview deployment;
the backup project's production deployment and the JJI publisher were unchanged.
The prior isolated Worker test established runtime behavior, not production
hostname routing. No hosted test or deployment was repeated in this follow-up.

Local candidate remains `7fbe95849351137590005a237330fee4b7d376de` plus an
uncommitted logging safeguard and its process-boundary regression test.
The pinned Wrangler child now explicitly disables disk logs and metrics.
117 local tests pass, including loopback. These tests do not establish live
paired publication, platform route behavior or automatic synchronization.

## Exact remaining engineering

The `.github/workflows/paired-release.yml.example` file only prepares a package.
It does not call publication-session or deploy either host. The candidate has
tested coordinator/provider modules, but enabling the example alone is not a
working publisher. Finish and review these specific connections before any run:

1. Bind the genuine pinned artifact upload/download and Pages preview upload
   already exercised by backup-only CI to the publication session. Retain exact
   artifact digest/provenance checks and reconcile uncertain writes without retry.
2. Connect the stage/final GitHub Pages artifact and OIDC deployment steps to the
   same protected `failover-sync` job. Use `contents:read`, `actions:read`,
   `pages:write`, `id-token:write`, shared concurrency group `pages`, no PR trigger,
   no optional cache, trusted main and exact approved source/workflow identities.
3. Provide the independent archive/owner-ledger bridge required by the existing
   policy. The actual same-Mac archive proves restore but does not establish
   off-device independence, nor archive future releases. An operator-assisted
   archive/readback checkpoint is the smallest present path; unattended releases
   remain blocked until an independent archive source is approved and verified.
4. Review an explicit logical-inventory admission policy: complete fresh account
   inventory plus verified Actions and Packages $0 usage blocking. This is still
   disabled, and is not an authoritative quota counter. Unknown usage stays
   unknown; provider quota refusal stops. An alternative is to retain the current
   authoritative-capacity requirement, which presently blocks paired publishing.
5. Prove a first paired bootstrap without a Worker route, then bind the existing
   Worker promotion adapter to subsequent releases. Do not run two independent
   publishers. Before selecting a push trigger, extend and test the current
   manual-event identity checks; do not simply add `push` to the example YAML.

## Proposed bounded approval package, in execution order

No item below has been executed or authorized by this document.

### A. Controlled paired publisher and bootstrap

- Approve the exact completed workflow/support-code diff and a one-time
  replacement of `.github/workflows/jekyll-gh-pages.yml` with the paired publisher.
  Preserve its exact previous bytes/commit for rollback. Publish the infrastructure
  change without triggering the old publisher, verify no run is active, then
  enable exactly one publishing path. Do not disable or edit it in advance.
- Retain owner-required review and main-only protection in `failover-sync`.
  Initially run manually, against approved public source d6574ed or a separately
  reviewed successor; exclude held CMS and other unpublished content.
- Approve the inventory-based admission and proposed retention: seven days,
  maximum seven recovery records of at most 2 MiB each, two transient site
  artifacts of one-day retention, no automatic deletion. Existing recovery data
  must not be deleted. A prior run's unexpired transient artifacts stop overlap.
- Select and verify an owner-held off-device destination for exact release
  material, receipt and independently recorded digest. This is a prerequisite
  before primary promotion, not a new storage service implicitly authorized here.
- The existing Pages-only token expires October 25, 2026 at **9:41 a.m. EDT**
  (13:41 UTC). It has no Worker or route rights. It can cover an approved bootstrap
  before expiry; after that, a replacement requires separate explicit approval.
  For ongoing publication, propose a separately approved 30-day renewable
  Pages Write credential, account 986b5334eba2d05d253ee98ca9842dfe only, stored only
  as `CLOUDFLARE_PAGES_TOKEN` in protected `failover-sync`. This permission can
  change/delete all Pages projects in that account; no narrower project scope
  has been verified. Do not extend or replace the current token silently.
- Bootstrap order: verified old HTML plus immutable assets -> verified immutable
  Pages backup -> independent full archive/readback -> small recovery artifact
  upload/readback -> new primary HTML -> both-host checks. No Worker change.

### B. Production Worker and controlled route activation

- After paired parity succeeds, approve creating one dedicated `jji-failover`
  Worker through existing dashboard access, with no route initially. Keep the
  isolated `jji-failover-test` endpoint separate. No account-wide Worker Admin
  token is proposed. Then approve a separate 30-day token with **Editor only on
  this existing Worker**, stored as `CLOUDFLARE_WORKER_TOKEN` in `failover-sync`.
  Verify actual platform scope before creation; stop if unavailable. Pages-only
  credentials cannot perform this step.
- Approve the exact immutable fallback pointer and retained asset generations,
  then routes only for `www.justinjindustries.com/*` and
  `justinjindustries.com/*`, with quota **fail open**. Configure these using
  existing authorized dashboard access; no persistent route token is needed.
  Route changes require Worker Editor plus zone Workers Routes Write authority,
  separately from the CI Worker credential. No DNS, TLS or WAF change is proposed.
- Test real original-host primary fetching, redirects, public fallback headers,
  selected safe failure paths, recovery and route bypass with bounded traffic.
  Do not deliberately exhaust the account quota, bypass challenges or force a
  production outage to simulate failure. Recheck current traffic before enabling.
- Only then approve a push-to-main trigger for the single paired publisher,
  retaining protected owner review and the archive checkpoint. Automatic request
  failover works without a deployment token once configured; automatic future
  releases remain approval/archival gated. Fully unattended sync is not complete.

## Rollback and limits

Disable/remove only the two new Worker routes to return traffic directly to the
existing GitHub origin. This does not restore a failed origin. For a bad release,
use the tested rebased rollback package preserving every exposed immutable asset,
archive and verify its recovery receipt before primary/pointer restoration.
Restore the prior publisher only after pausing the paired publisher and confirming
no deployment is in flight. Preserve all current/predecessor Pages deployments
and owner archives; no automatic cleanup or force push.

The current first-release storage estimate is 320,326,879 bytes plus existing
account usage, not guaranteed headroom. Proposed limits are 200 MiB per tree,
2,000 files, 16 asset generations, seven recovery records and two transient
artifacts. Growth/count limits halt new releases rather than delete recovery data.
Historical storage accounting may still reject uploads even with a complete
logical inventory and $0 usage blocking.

[Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/)
are 100,000 requests per account/day (including routed asset requests), 10 ms CPU
per invocation and 50 subrequests. With route fail-open, quota exhaustion bypasses
the Worker; fallback protection is then unavailable. No paid upgrade, KV, R2,
logging store or other paid service is part of this plan. A $0 setup has these
availability limits, not an uptime guarantee.

[Official Worker roles](https://developers.cloudflare.com/workers/authorization/workers/)
support Editor on individual existing Workers and separate zone route permission.
Read-only verification and local tests cannot establish that the planned scoped
token or live route works before its separately approved creation/runtime test.
