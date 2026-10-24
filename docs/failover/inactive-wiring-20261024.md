# Inactive publication wiring and operative retention policy

## Scope and status

Local follow-up to `8d9d1e3`, in `failover-inactive-wiring-20261024` on M1 Max.
No remote writes, uploads, token/environment/secret creation, publisher change,
push or deployment. Public source and active publisher are unchanged. Prior
candidate commits, raw backup ZIP and immutable backup are preserved.

The proposed workflow stays `.yml.example`; it is not registered. All publication
composition/provider/receipt adapters default to disabled writes. There is no
ambient credential lookup or default artifact/archive transport. Local tests use
explicit mocked provider ports and a simulated independently held filesystem
archive. These are not live GitHub or Cloudflare results.

## Exact proposed copies, counts and expiry

| Material                                      | Count/limit                                                                              | Proposed expiry              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------- |
| GitHub Pages deployment artifacts             | Two per publication: stage and final; at most two retained JJI transient artifacts total | 1 day                        |
| Recovery record artifact                      | One per publication/rollback; at most seven retained JJI records                         | Exactly 7 days               |
| Receipt inside record                         | At most 1 MiB                                                                            | Same record retention        |
| Sanitized journal inside record               | At most 64 KiB                                                                           | Same record retention        |
| Archive proof inside record                   | At most 8 KiB                                                                            | Same record retention        |
| Whole unpacked recovery record                | At most 2 MiB, plus 20% packaging allowance                                              | Same record retention        |
| Immutable Pages deployment                    | One new deployment per publication/rollback; current and predecessor needed for recovery | No automatic expiry/deletion |
| Independent exact material + receipt + digest | Required for EACH promoted publication, including rollback                               | No automatic expiry/deletion |

Seven full recovery records reserve at most 14 MiB unpacked (16.8 MiB with the
20% allowance). Other account storage and both transient uploads are additional.
This is a count cap as well as a byte cap, not permission to create unlimited
receipts in seven days. When seven records are retained, the next publication
stops until independently verified permitted expiry or an owner-reviewed policy
change. There is no deletion API or pruning algorithm here. Existing artifacts
and their expiry settings remain untouched.

Snapshots distinguish current-run receipts/transient uploads from prior runs.
Every byte remains included in account usage. Reserve only this run's uncreated
record and remaining stage/final copies, avoiding double counting. A previous
run's unexpired deployment artifacts stop a new run even if byte headroom exists.
All counts/bytes must be known. No cleanup is presumed to make a run fit.

The 200 MiB/tree, 2,000 files and 16 asset-generation caps remain. New generations
retain old bytes for cached HTML, so large imagery may hit the byte cap after only
a few releases. No unlimited autonomous $0 operation is promised.

## Mandatory independent archive before promotion

A raw-site ZIP cannot cover future namespaced releases. The independent archive
must contain the exact verified `public/`, `stage/` and `release.json`, the exact
issued `receipt.json`, and a matching independently held receipt SHA256. Both
public and rollback trees are rehashed and their metadata compared to the receipt.
A missing file, raw-only ZIP/directory, omitted stage, wrong digest or working
release reused as its own archive stops promotion.

The trusted archive readback returns material fetched from independently held
storage. Separately, an owner-approved ledger binds storage identity, source SHA,
release identity and the EXACT receipt digest. A self-attestation inside the
archive is insufficient. Paths do not prove storage independence: live inspectors
must establish it. The module checks separate resolved material paths and verifies
all bytes; it cannot authenticate the human owner or storage provider by itself.
Runner paths/private URLs are excluded from persisted proof. No signature/key or
new archive service was created.

The archive reader/owner-ledger bridge has no implicit implementation. A future
protected UI/CI bridge can present the issued receipt to the owner and inspect
already archived exact material. Owner availability or an independently approved
archive system remains a real operational prerequisite. This is not unattended
publication until that archive/approval source exists. Seven-day GitHub expiry
must never be the only retained receipt/digest or full release copy.

## Wiring and state transitions

`runPublicationSession` binds exact package/provider adapters and the recovery
recorder. Bootstrap has no Worker read or write. Normal publication checks the
current primary manifests, expected pointer and exclusive publisher. Rollback
uses a separately rebased package preserving every exposed immutable asset.

Bootstrap: preflight -> old HTML + immutable assets -> verify -> immutable backup
-> verify remote bytes -> independent exact archive readback -> upload/read back
small receipt artifact -> new primary HTML -> verify both hosts. No Worker action.

Normal release: same stage/backup/archive/receipt ordering -> promote fallback
pointer -> final primary HTML -> verify. Missing/corrupt/uncertain recovery stops
before pointer/final HTML. A stage or an unrouted backup may already exist and
requires read-only reconciliation if any subsequent phase fails.

Rollback: verify current state -> publish/verify rollback backup -> independently
archive and persist/read back its exact rebased receipt -> restore old primary
HTML with complete immutable asset union -> restore pointer -> verify. This
strengthens the previous primary-first rollback order: incomplete archive cannot
change primary HTML. Uncertain writes stop; never guess or retry automatically.

The artifact bridge receives a fixed name, run/repository/workflow identity,
exact byte map and seven-day retention. It must call the separately approved
pinned official Actions upload bridge; readback must independently obtain the
artifact contents and provider provenance, rather than echo cached upload input.
Transport bounds are 120s/upload and at most 15s/readback. A timeout can still
complete remotely; the durable journal blocks retry pending reconciliation.
The journal is allowlisted/sanitized before upload; arbitrary provider bodies,
credentials, query data or extra files are rejected.

## Disabled logical-inventory admission option

Default admission still requires explicitly verified authoritative evidence.
The alternative is disabled unless BOTH the trusted local policy sets
`allowInventoryAdmission: true` and the protected owner snapshot explicitly
approves it. Bind `currentRunId` to the actual trusted workflow run.

Inventory evidence must be fresh (at most 15 minutes), owner-verified and complete
for all account repositories (including private repositories), every retained
Actions artifact and Packages storage. An empty authenticated owner Packages UI
may establish zero only when explicitly attested empty; missing numeric data or
an incomplete listing is never zero. All artifact byte counts and the full account
sum are checked; receipt/transient counts must match the inventory. Require
separate verified Actions and Packages $0 usage blocking, known Free plans,
standard public runner, disabled optional caches and explicit expiry approvals.
No credentials/scopes are expanded to make this option work.

This establishes a conservative logical inventory, not authoritative remaining
quota. Historical accounting or quota refusal can still block an upload. Refusal
stops all later phases; there is no cleanup, upgrade or permission bypass. Future
activation requires an owner decision accepting this evidence basis and actual
fresh observations, not merely a passing mock or JSON flag.

GitHub deployment requests now name the same protected `failover-sync` environment
as the proposed job, rather than hardcoding `github-pages`. The server must verify
the actual OIDC/environment identity; local assertions do not prove a live token.
The [official deployment API](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-deployment)
accepts an explicit target environment.

## Remaining live-only verification and approvals

1. Review the exact local commit, seven-day/two-artifact/seven-record retention,
   independent archive plan, and disabled inventory option.
2. Approve Pages-only CI credential and protected environment/secret storage;
   account-level Pages Edit is broader than one project. No Worker token is needed
   for bootstrap. Exact token scope/lifetime remain a separate owner decision.
3. Approve the exact enabled workflow/pinned official artifact bridges, environment
   and OIDC alignment, single publisher and trusted SHA. The current publisher is
   unchanged. No live function can be inferred from an inactive `.example` file.
4. Separately authorize actual backup synchronization and any paired primary
   bootstrap. Verify provider receipt readback, archive independence, recovery,
   actual quota behavior and hosted byte/route/form/layout parity without leads.
5. Future Worker configuration/promotion and production routes require their own
   approval and routed runtime/quota fail-open checks. No DNS/TLS/WAF changes.

## Verified local evidence

- 116/116 Node tests pass, including loopback, complete bootstrap/release/rollback
  composition, missing/partial/raw-only archives, wrong digest/approval, provider
  quota refusal, receipt readback failures, bounded unknown uploads, no replay,
  current-run accounting and prior-run overlap. No provider was contacted by tests.
- Full JJI bootstrap simulation used file-backed origins and a separately copied
  simulated owner archive: 297 public files and 297 rollback files matched; phase
  order was stage -> backup -> archive -> receipt -> final. No Worker was accessed.
- Receipt plus archive proof and journal measured 260,709 bytes (receipt 260,227).
  Public source identity remained
  `623a84da5ab3352ffe6736f335d5e3a2c0d6699c22ce976614fb386ffee9686a`.
- Conservative peak with a simulated empty account pool: 320,326,879 bytes
  (305.5 MiB), up from 319,068,588 because the reserved record now includes bounded
  archive proof/journal, not only a receipt. Existing account usage is additional.
  This is not an available-quota or billable-storage measurement.
- The unchanged source build produced 189 files and passed capability PDF/shared
  footer/public-content checks. Formatting, inactive YAML syntax and diff checks
  pass. Public source/root dependencies/active publisher are unchanged.
