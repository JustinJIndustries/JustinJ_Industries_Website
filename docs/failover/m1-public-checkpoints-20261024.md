# Protected M1 public verification checkpoints

## Scope and trust boundary

The owner approved moving public-site verification to the authorized M1 while keeping artifact, provenance, immutable backup, storage and archive checks in GitHub. Cloudflare Bot Fight Mode remains unchanged. The M1 is required for releases, not for serving requests or automatic request failover.

This is **authenticated owner attestation of actual M1 execution, not hardware remote attestation**. A compromised owner account or Mac is outside this proof's trust boundary. No new signing key, API token, integration, security exception or token permission is introduced. An arbitrary success flag, untrusted workflow artifact or stale prior result cannot authorize continuation.

The local implementation is isolated from production and held CMS/copy changes. Publication and provider execution require the existing staged rollout gates and successful independent review.

## Protocol

1. The paired coordinator validates the exact approved source/package and GitHub context. Before a public phase it refreshes the approved complete logical inventory, reserves storage, creates a random single-use nonce and uploads a small request through the pinned official artifact action.
2. A request binds repository, parent run and attempt, reviewed control/source SHAs, release, baseline/stage/final phase, full exact manifest and its digest, primary-marker policy, nonce, creation/expiration and original storage-evidence timestamp.
3. The owner M1 helper checks Darwin/arm64 and the exact authorized hostname, existing owner GitHub identity, unchanged current control checkout, current main/parent run and protected environment. It downloads the exact request ZIP through existing authenticated `gh` access to github.com, verifies the server-reported ZIP SHA256, rejects unexpected ZIP members, and reads only the bounded request file.
4. The helper verifies every requested public response through ordinary Node HTTPS against the exact local package. It rejects certificate/host failures, challenges, wrong phase bytes and missing primary markers when required. No cookies, impersonated browser identity, direct-origin substitution, alternate host or security-setting workaround is used. A failed check produces no success proof.
5. The helper writes fresh evidence and dispatch-input JSON outside the source tree. Submission goes to a separate manually triggered proof workflow on the exact same main control SHA, with owner-only actor, required protected `failover-sync` review, no Cloudflare secrets and only existing contents/actions read permissions. Its separate concurrency group avoids deadlocking the parent's `pages` lock.
6. That workflow independently validates the request artifact/proof bindings, parent state, main SHA, owner/main-only environment, freshness and bounded artifact inventory. It uploads one small proof record. The artifact name contains the SHA256 of the exact record bytes.
7. The parent waits for the successful owner proof workflow, verifies official run/artifact provenance, downloads through the pinned official action, compares actual record bytes with the content-addressed artifact name, revalidates every binding and writes an exclusive consumed-nonce record before continuing. Duplicate artifacts, repeated phases, reruns, reused/mismatched or missing proofs stop the coordinator.

GitHub workflow validation authenticates the owner's attestation; it cannot independently inspect offline Mac hardware. The helper's real network check plus the explicit protected owner review is the approved evidence boundary. These public-edge checkpoints do not establish GitHub origin certificate renewal.

## Publication phases

- Preparation: fresh baseline proof before the immutable backup upload.
- Promotion: a new baseline proof for that run before staging; fresh stage proof after stage deployment and before durable recovery/final publication; fresh final proof after final deployment before declaring paired success.
- The redundant pre-coordinator baseline read was removed; the coordinator's pre-write assertion remains the single mandatory baseline gate.
- Existing owner archive/actual restore and strict immutable Pages backup hashing are unchanged. Stage/recovery/final ordering is unchanged.

A proof failure or timeout after a publication does **not** automatically restart the old publisher, delete artifacts, retry a write or roll back. Inspect the exact provider journal and public manifests first. Preserve exposed asset generations. Only the authorized, verified recovery plan may restore a prior publication. Before any primary write, restoring the original publisher remains safe after reconciliation.

## Bounds and cost controls

- Request JSON: at most 256 KiB; proof record: at most 16 KiB.
- At most three checkpoints per parent run, each phase once. Preparation uses one; promotion uses three.
- At most 24 retained request/proof artifacts in this repository. One-day retention; no automatic deletion or pruning.
- An additional 2 MiB is reserved explicitly in storage admission, beyond existing artifact framing and the 20 MiB headroom. Three request/proof pairs at the raw caps plus 20 percent framing fit below 1 MiB. Existing retained bytes remain included in the complete account inventory.
- Request lifetime: eight minutes. Proof maximum age: three minutes, with at most 30 seconds of clock skew. The original account evidence still expires after fifteen minutes and is refreshed before each main write; unknown usage is never zero.
- The bridge's longer timeout applies only to public checkpoints; provider artifact handoffs retain their prior bounds. Parent job timeout is 35 minutes, while admission freshness still gates every write.
- Standard public Linux runners, optional caches disabled, existing Free plans and $0 usage blocking remain required. No paid state, monitoring or service is added.

## Owner operation

After a request artifact appears on the exact approved run, from the reviewed current control checkout:

```sh
node infrastructure/failover/owner-public-check.mjs \
  PARENT_RUN_ID baseline \
  /absolute/path/to/verified/package \
  /absolute/path/to/new/owner-checkpoint-folder
```

Use `stage` or `final` only for that actual requested phase. The package must match the request's exact phase inventory. Initial baseline material can use the independently verified approved-source package; promotion should use the actual restored owner archive package.

Inspect the output, then submit the generated `dispatch-inputs.json` to the manual `paired-public-proof.yml` workflow on main using existing owner access. Verify that exact child run, request identities and protected review before approving. Do not reuse an old folder or old proof. The main workflow resumes only after successful proof verification. No proof helper action changes Cloudflare.

## Verification so far

The local suite passes 181 tests. New cases cover actual file fetching, ordinary TLS options, challenges/corruption, machine policy, stale/future/missing/forged fields, run/attempt/phase/nonce/manifest/source/control/artifact/marker mismatches, untrusted actors/workflows, artifact corruption/provenance/retention, owner protection, duplicate uploads, bounded polling, real IPC consumption, and complete bootstrap ordering. A stage-proof failure prevents all subsequent writes and leaves the known stage for deliberate recovery.

An actual M1 network test verified all 189 approved public files through ordinary HTTPS. Its run/artifact identities were explicitly synthetic local-test fixtures; that test is **not** admissible hosted CI proof. Live request/proof transport, provider/OIDC bootstrap and Worker activation remain rollout checks, not claims established by local mocks.
