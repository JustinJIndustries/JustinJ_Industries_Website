# Concrete inactive paired publisher

## What is implemented

The `.yml.example` suffix still prevents GitHub registration. No active publisher,
credential, route or account setting changed. The previous candidates remain
preserved. This proposal now invokes actual coordinator/provider wiring instead
of ending at a preparation-only step.

One reviewed manual workflow supports two separately protected runs:

1. **Prepare:** build the exact approved public-source commit, verify current
   primary bytes, create the immutable package and rollback stage, upload only an
   unrouted Pages preview, verify hosted hashes, and issue a small candidate
   receipt. No primary publishing occurs. The candidate artifact expires in one
   day. Its externally recorded receipt digest is shown in the run summary.
2. **Promote:** download the named candidate from a successful trusted preparation
   run, verify the owner's pinned receipt digest and source identity, reconstruct
   exact bytes from immutable hosting, validate the owner archive proof, then run
   the existing tested bootstrap/release coordinator. Pinned official Actions
   upload stage/final Pages artifacts and upload/download the recovery record.
   The Node adapter deploys via the official Pages API and an in-memory OIDC
   token. No secret or OIDC token goes into an artifact, IPC file or log.

The action bridge uses a random nonce per phase and bounded waits. Failed or
uncertain uploads are never automatically repeated. The sanitized provider
journal is retained in the run summary even after failure; it contains public
deployment identities only. It is not permission to retry an uncertain write.

The bootstrap coordinator does not read or change a Worker. Later releases
verify the prior primary inventory and Worker pointer, stage old HTML plus all
asset generations, reuse/reverify the prepared backup, persist/read back the
recovery record, promote the fallback pointer and publish final primary HTML.
No second preview upload is performed during promotion.

The local Worker now marks safe primary responses `x-jji-source: primary` and
fallback responses `x-jji-source: fallback`. Later publication requires primary
markers as well as correct bytes, so a matching backup cannot hide a failed
origin. This header change is local and requires the separately approved Worker
deployment; the earlier hosted runtime test does not verify it. Challenges and
non-idempotent requests keep their existing pass-through behavior.

## Implementable archive plan using existing resources

Use the existing M1 owner-held recovery directory, outside every Git checkout.
No new service, account, credential, public upload or private URL is required.

After preparation succeeds, download its small candidate artifact using existing
GitHub access. Independently record its receipt SHA256 from the run summary.
Run from the reviewed control checkout:

```sh
node infrastructure/failover/owner-archive.mjs \
  /absolute/path/to/downloaded/receipt.json \
  RECEIPT_SHA256_FROM_VERIFIED_RUN \
  /Users/macbookpro/Documents/Codex/2026-10-16/task-3/owner-held-recovery/NEW_UNIQUE_RELEASE_DIRECTORY
```

The helper downloads and hashes every public and rollback file, creates a fresh
tar archive containing the exact package, receipt and digest, extracts that actual
archive into a fresh restore directory, and verifies the restored manifests and
receipt. It refuses overwrite and destinations inside a Git checkout. It emits
`owner-proof.json` with the archive digest/size, exact release/source/receipt
identities, file count and verification time. It never uploads the archive or
prints its private location. Ordinary TLS/challenge failures stop the download;
there is no browser/UA spoofing or certificate bypass.

Paste that small proof JSON into the promotion run's `owner_archive_proof` input
and review the exact run under `failover-sync`. CI authenticates the owner/manual
main context and checks the exact proof. **This is owner-attested Mac readback,
not a claim that the cloud runner can directly inspect offline Mac storage.**
The strict earlier direct-archive-reader path remains unchanged and available.
This alternative is disabled unless explicitly approved in the workflow policy.

The Mac copy is separate from GitHub Actions and Cloudflare. It is not off-device
redundancy for the Mac and remains subject to disk loss and task-folder cleanup.
No copy outside the currently authorized filesystem or remote destination is
assumed. If this recovery boundary is unacceptable, promotion remains blocked
until the owner selects and authorizes another archive location. Future releases
need their own exact archive; today's raw ZIP or receipt cannot cover them.

## Inputs and policy gates

The workflow has ten dispatch inputs. `source_commit` is a full reviewed SHA;
`approved_public_release` is the exact built manifest identity;
`approved_workflow_sha` is the reviewed current main control SHA. Preparation and
promotion require the same control SHA. Intervening main changes stop the run.

For promotion, `prepared_candidate` is:

```json
{
  "run_id": "PREPARATION_RUN_ID",
  "artifact_id": "CANDIDATE_ARTIFACT_ID",
  "receipt_sha256": "64_LOWERCASE_HEX_DIGEST",
  "expected_worker_deployment": "EXACT_UUID_FOR_LATER_RELEASES_ONLY"
}
```

For later preparation, `previous_receipt` similarly names the successful prior
promotion run, its `paired-release-receipt` artifact ID and the independently
recorded receipt digest. Every predecessor is verified and rehydrated; it is not
an arbitrary previous build directory.

The proposed explicit policy input for first bootstrap is:

```json
{
  "allowInventoryAdmission": true,
  "allowOwnerMacArchive": true,
  "retentionApproved": true,
  "noWorkerRouteConfirmed": true
}
```

The last field is an owner-confirmed absence of production routing, not an API
observation through the Pages-only token. Later releases do not assert absence.
`storage_snapshot` must follow the existing complete logical-inventory schema,
with current account repositories/Packages and separately verified $0 Actions
and Packages blocking. Current-repository artifacts are refreshed before writes;
other account evidence retains its original timestamp and expires after fifteen
minutes. Unknown usage never becomes zero. The provider may still refuse an
upload because of delayed accounting; refusal stops without deletion or upgrade.

## Limits and manual dependencies

- Two full transient Pages artifacts per promotion, one-day retention.
- One recovery record, at most 2 MiB unpacked, seven-day retention; maximum seven
  retained records. Current and predecessor immutable deployments are preserved.
- One small preparation candidate, one-day retention; included in account usage.
  No duplicate full-site GitHub checkpoint or automatic pruning.
- Existing conservative first-publication estimate is 320,326,879 bytes, plus
  other retained account data and the small candidate. This is not measured quota.
- A prior run's unexpired transient artifacts stop overlapping publication. The
  owner may need to wait for expiry; no deletion of recovery data is authorized.
- CI still requires protected owner review, fresh account evidence and a Mac
  archive check. **Unattended publication is not implemented or promised.** A
  production push trigger is deliberately absent. Automatic request failover is
  a separate runtime feature and does not require a live deployment token.
- The Worker Free limit is 100,000 account requests/day including routed assets,
  10 ms CPU and 50 subrequests. Quota fail-open returns to GitHub without fallback
  protection. Verify real account volume and route behavior before activation.

## Exact remaining live actions and approval text

### First paired bootstrap only

> Approve publishing the reviewed inactive paired-publisher candidate to
> JustinJIndustries/JustinJ_Industries_Website, pausing the existing
> jekyll-gh-pages publisher after confirming no run is in flight, enabling only
> the manually triggered paired-release workflow under the existing protected
> failover-sync environment, and executing its prepare/archive/promote bootstrap
> against approved public source d6574ede41a8620f838b6eafd3e7ba76ea7ebf68.
> Approve the documented complete-inventory admission, $0 blocked spending,
> seven-day recovery receipts, one-day transient/candidate artifacts, no automatic
> deletion, and owner-verified M1 archive/readback boundary and its limitations.
> Use only the existing Pages Write token for Cloudflare account
> 986b5334eba2d05d253ee98ca9842dfe and project jji-backup-20261023. Do not change
> Worker routes, DNS, SSL or WAF. Stop on uncertain writes or quota refusal.

The token expires **October 25, 2026, 9:41 a.m. EDT / 13:41 UTC**. After expiry,
stop any step requiring a Pages API write. Promotion reuses an already verified
preview and requires no Pages token. A replacement is a separate security approval: proposed thirty-day Pages
Write, same account only, stored only as `CLOUDFLARE_PAGES_TOKEN` in protected
`failover-sync`. Pages Write can edit/delete all Pages projects in that account;
no narrower verified project scope is implied. No replacement has been created.

Bootstrap rollout: freeze content/publisher changes; verify remote baseline;
publish infrastructure without triggering old production; pause old publisher;
rename/register only the reviewed workflow; review exact source/run; prepare the
unrouted backup; verify owner archive; promote and check both hosts. Verify actual
OIDC/environment acceptance and real API status, not just local mocks.

### Subsequent Worker activation only, after bootstrap parity

> Approve creating one dedicated jji-failover Worker in Cloudflare account
> 986b5334eba2d05d253ee98ca9842dfe using existing dashboard access, deploying the
> reviewed code with the exact verified immutable backup pointer, and creating a
> separate thirty-day API token with Editor only on this existing Worker, stored
> only as CLOUDFLARE_WORKER_TOKEN in protected failover-sync. No account-wide
> Worker Admin token or Pages-token expansion. Stop if that narrow scope is not
> supported. Separately authorize Worker Editor plus Workers Routes Write only
> for zone justinjindustries.com to attach exactly www.justinjindustries.com/*
> and justinjindustries.com/* with quota fail-open, using dashboard access without
> storing a persistent route credential. Verify primary/fallback/redirect and
> recovery behavior with bounded traffic; do not induce a public outage or exhaust
> quota. No DNS, SSL, WAF, paid plan or other-zone change.

The zone is specified by its verified name; no unverified numeric zone ID is
invented. Keep the existing isolated `jji-failover-test` separate. Worker creation
uses the signed-in owner; an API token is scoped only after the script exists.

### Automatic release trigger

This candidate provides the complete protected manual publication path. Enabling
backup synchronization from future pushes is a separate approval and must retain
the owner archive/promotion checkpoint. The current identity guard accepts only
manual main runs, so simply adding `push` would fail closed. It must not be sold
as fully unattended synchronization. No active automation was changed here.

## Rollback

Detach only the two newly attached Worker routes to return directly to GitHub.
This removes failover protection and does not repair an unhealthy GitHub origin.
Restore the prior publisher only after stopping the paired publisher and checking
that no deployment is running. Preserve the exact old publisher bytes and d6574ed
public source.

For a content rollback, use `prepareRollbackRecovery` and the tested rollback
coordinator/bindings, with the complete retained asset union, verified immutable
backup and exact archive/receipt before primary changes. This dispatch workflow
does not add an automatic rollback trigger. The specific rollback package and
run require owner approval; do not deploy a raw predecessor or blindly rerun an
uncertain publication. Bootstrap-stage material is retained for restoring original
HTML while keeping the newly exposed asset namespace.

## Verification basis

Local tests exercise actual tar extraction, phase IPC, bootstrap/release adapter
composition, nonce/replay/timeout handling, provenance, corrupt readback, quota
refusal and uncertain stage failure. Official source/API documentation was checked
for Pages artifact outputs, default OIDC audience, deployment environment and
the status endpoint without `/status`. No new hosted run or provider write occurred.

The final integrated suite passes 138 tests, including the real provider adapter
and file IPC joined end to end with mocked official artifact transport. Build,
HTML, links, capability PDF, formatting and YAML parsing are checked separately.
The active publisher, public source and root dependencies are unchanged. No new
browser/a11y run is implied for this infrastructure-only change.

Two stage/final deployments share the reviewed workflow SHA, matching the official
Pages action's build-version behavior. API status alone is not proof of the new
artifact being served: every phase verifies actual complete hosted hashes. Real
same-SHA stage/final behavior, environment/OIDC acceptance, CDN propagation and
the new Worker provenance marker remain live-only checks. A stale/incorrect
response stops rather than claiming success. Do not invent a build-version string
or retry publication to work around a provider refusal. Official SDK transport
internals are not represented as having no retries; this publisher adds no replay
loop and requires reconciliation after an uncertain action outcome.

Sources: [Pages deployment API](https://docs.github.com/en/rest/pages/pages),
[pinned upload-pages action](https://github.com/actions/upload-pages-artifact/blob/fc324d3547104276b827a68afc52ff2a11cc49c9/action.yml),
[Worker permissions](https://developers.cloudflare.com/workers/authorization/workers/),
[Worker limits](https://developers.cloudflare.com/workers/platform/limits/).
