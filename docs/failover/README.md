# JJI failover: concrete inactive paired publisher

The current executable wiring and approval plan is
[paired publisher after provider verification](paired-publisher-20261024.md).
It supersedes preparation-only workflow instructions below. It remains inactive.
The completed backup-only CI test is separate; production still uses d6574ed.

This is **local code only**. Production remains `d6574ed`; no live route, credential,
environment, upload, publisher change or deployment was made for this revision.
The original `ac53eaa` and `8d9d1e3` checkouts and recovery artifacts are preserved.

The operative policy is [inactive wiring and retention](inactive-wiring-20261024.md).
The [prior checkpoint design](history/checkpoint-design-before-inactive-wiring.md)
is retained only as historical evidence. Its one-copy/deletion/full-checkpoint
instructions do not apply to the current proposal. Do not use historical code or
notes as authorization for cleanup, billing changes or live execution.

## Current components

- `worker.mjs`: previously tested request-level availability handler; unchanged.
- `prepare-release.mjs`: verified immutable asset preparation, retaining all
  exposed generations and an exact old-root/HTML rollback stage.
- `cloudflare-package.mjs`: public-byte-preserving Pages metadata adapter.
- `recovery-receipt.mjs`: externally pinned small receipt creation and recovery.
- `archive-verification.mjs`: full independent archive readback and digest checks.
- `recovery-store.mjs`: disabled-by-default receipt/artifact persistence wiring,
  bounded provider bridge, journaled writes and independent artifact readback.
- `bind-release-adapters.mjs`: bootstrap, normal publication and rollback wiring.
- `publication-session.mjs`: inactive composition of those adapters and recorder.
- `storage-admission.mjs`: seven-day/count/byte policy and a disabled logical
  inventory option. Unknown usage never becomes zero.
- `release-policy.mjs` / `artifact-plan.mjs`: measured fail-closed upload budget.
- `deployment-adapters.mjs`: existing scoped provider primitives, with writes
  disabled by default and optional fresh storage inspection at every write.
- `trusted-inspectors.mjs`: exact trusted-main/run/environment/publisher checks.
- `paired-ci.mjs` / `action-bridge.mjs`: concrete protected two-run preparation
  and promotion, connecting the existing coordinators to pinned Actions and APIs.
- `owner-archive.mjs`: existing-M1 archive and actual restore/readback helper.
- `.github/workflows/paired-release.yml.example`: concrete but unregistered
  paired publisher. Secrets are named only in this inactive proposal, never read
  by importing its support modules. No active workflow was changed.

All publication entry points require explicit `writesApproved: true` from a future
reviewed trusted caller. The defaults do not read credentials, create resources,
invoke upload transports or change production. Tests opt in only to local mocks.
A boolean is not owner authorization: future CI must bind the approved exact SHA,
run, protected environment and scoped artifact/provider bridges independently.

## Recovery and storage summary

The future record is **one receipt artifact per publication**, containing
`receipt.json`, `archive-proof.json` and a sanitized `journal.json`. The whole
unpacked artifact is capped at 2 MiB (receipt 1 MiB; journal 64 KiB; archive proof
8 KiB), with an additional 20% packaging reserve in the budget. Proposed retention
is exactly **7 days**, with at most **7** retained JJI recovery record artifacts.
No setting was applied. No automatic pruning or deletion is implemented.

Two transient GitHub Pages artifacts, stage and final, are reserved; proposed
expiry is 1 day, with a maximum of two retained transient artifacts. A prior run's
remaining transient artifacts stop a close subsequent release. Artifacts already
created by the current exact run are included in account usage and only remaining
copies are reserved. Receipt history and all other account storage are included.

The provider may still reject uploads due to accounting delay or accrued quota.
A refusal stops publication. The policy never raises budgets, retries uncertain
writes, deletes archives, buys storage or substitutes a guessed zero.

See the operative document for exact archive requirements, phase ordering,
inventory evidence, manual approval dependencies, runtime limitations and gates.

## Preserved runtime behavior and evidence

The primary fetch preserves the public request Host. Only eligible GET/HEAD
network/header-timeout/selected 5xx failures can fall back. No fallback for
404/403/429/challenges or writes. A fixed immutable same-project Pages origin is
required. Public fallback strips only the preview noindex directive; direct
preview remains noindex. No sensitive URL/header/provider logging is introduced.

The earlier isolated Worker runtime test passed 23 cases; it did not exercise
these new recovery/archive/CI adapters. Current adapter tests use local filesystem
fixtures, HTTP loopback and injected provider mocks. No new remote runtime result
is implied. Actual routed Host/quota fail-open and paired publication must still
be verified after their separate approvals.
