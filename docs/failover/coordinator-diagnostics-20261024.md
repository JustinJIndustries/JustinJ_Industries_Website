# Coordinator startup diagnosis — local review, October 24, 2026

## Verified outcome and limits

Promotion [40123753991](https://github.com/JustinJIndustries/JustinJ_Industries_Website/actions/runs/40123753991) created no checkpoint artifact and made no primary deployment. The starter shell returned at 19:08:14.731 UTC; the wait step ran 19:08:15–19:18:15, approximately ten minutes. The external operator had an eight-minute polling bound; these are different intervals. The run is cancelled, not a successful promotion. The original publisher was restored active and paired publication disabled.

The historical coordinator's stderr was redirected to runner temporary storage and was not retained in the completed run. Its exit status, liveness and last internal operation were also absent. Consequently **the actual historical runtime cause cannot be established from this evidence**. No credential, runtime or network cause should be represented as confirmed.

A source-level reporting fault is reproduced: an exception before the previous `mkdir(root)` attempted to write a failed outcome into a nonexistent directory. That secondary error was ignored, so the waiter had neither a request nor a failed outcome and kept polling. This is a confirmed reporting defect; it is not proof that the same exception occurred in this run. A normal caught recovery error after root creation should instead have stopped the waiter promptly.

## Narrow local correction

- Initialize a new exact `RUNNER_TEMP/jji-paired` directory, refusing existing paths and symlinks, before asynchronous coordinator prerequisites.
- Record only a fixed startup/stage vocabulary and numeric process ID. Never record provider bodies, URLs, tokens, environment values, stack traces or arbitrary error messages.
- Persist terminal failure once using a fixed diagnostic-code vocabulary. Unknown errors become `unclassified_failure`.
- Add bounded, non-symlink-following diagnostic reads/appends. A summary rebuilds only permitted fields and labels progress explicitly as neither publication evidence nor a process-liveness check.
- Preserve all original source/control bindings, storage checks, normal TLS, provenance, public proof freshness, archive and publication ordering gates. No workflow permission or deployment adapter changed.

A failure while creating the trusted diagnostics directory itself cannot safely be recorded in that directory. It still exits unsuccessfully and must not be retried blindly. This correction is not a process supervisor and cannot record an uncatchable process kill.

## Local reproduction and tests

The exact logged non-secret promotion inputs were replayed with the clock fixed to the original execution time. The real CLI, Git remote check, receipt decoder, archive-proof check, package recovery, Cloudflare packaging and checkpoint-request generation ran. GitHub responses and HTTPS transport were local test doubles; public and rollback bytes came from the actual owner-held verified archive. Every unexpected destination or non-GET/HEAD operation was refused.

Both the original and corrected CLI reached the baseline request. The corrected replay performed 405 mocked reads and regenerated the expected approximately 23 KiB request. A separate `/bin/bash -e` starter shell exited successfully while its background coordinator survived and produced the request. The process was then deliberately terminated locally before any proof, provider write or promotion. No provider credential was used in these replays.

This establishes a working local startup/recovery/request path and shell lifetime under the M1's Node 24 and Bash. It does **not** reproduce Ubuntu's kernel, GitHub-hosted process management, real runner networking or the original job token. Those remaining differences prevent claiming the GitHub cause has been demonstrated fixed.

Eight focused tests cover early CLI input failure, identity-read failure, prompt waiter propagation, fixed-code/free-form error redaction, first-write outcome preservation, unsafe/existing/symlinked roots, symlink replacement, bounded readers and non-authoritative summaries. The full local failover regression suite must pass before review concludes. Existing pinned toolchain dependencies are reused locally; no dependency lockfile is changed.

## Candidate and next gate

The prepared candidate from successful run 40121633653 and its owner-held archive remain preserved, with receipt SHA256 `eb41bf430b09be670bb7523a0ff12a105814dbcdc66869b1f66b1b545de7f76b`. The archive SHA256 is `ab8a03bf7d1c290225c9d210a08322f7e686260433e17ac4ff475d410e635ac0` (240,995,257 bytes; 594 files verified previously).

That candidate is bound to control commit `06d86074d46f4b1f0339b97d32c784fb5b1ab8b2`. Publishing any corrected control commit requires a newly bound candidate and actual archive/readback. Do not weaken that binding to reuse it under a new control SHA.

**No new live promotion is justified by this local result.** The next evidence needed is a narrowly bounded, non-publishing runner diagnostic that retains fixed startup/stage/exit information with the original publisher active and paired disabled. It must not create a public proof or access a publishing credential. The owner has now authorized that bounded diagnostic publication/run. The dedicated manual diagnostic has read-only repository/Actions permissions, no protected secret environment, no publishing or OIDC permission, and a hard stop at local checkpoint creation. The original publisher stays active and the paired publisher disabled. The control push must use the documented `[skip ci]` commit marker so the original push-triggered publisher does not run. No promotion is authorized by a diagnostic result. A successful local replay is not a substitute for the missing hosted cause.

No public content, held CMS/copy work, credentials, Cloudflare security settings, Worker routes, DNS or TLS settings changed. Automatic failover remains inactive.

## Dedicated read-only runner diagnostic

The manual workflow downloads only the existing pinned candidate. It checks current diagnostic provenance, original candidate provenance, protected-environment metadata without using its secrets, unchanged safe publisher states, fresh inventory, actual immutable recovery bytes, packaging, and baseline request creation. It does not create or accept a proof or instantiate a provider-write adapter. A shell wrapper records the actual exit code across starter-step completion; the next step emits only fixed codes, stage/PID, read-operation/status and validated recovery status/challenge fields. Redirected stderr remains private to the temporary runner and is never uploaded or printed.

Normal Safari access during this diagnostic preparation showed the actual JJI homepage. A normal automated request separately received Cloudflare HTTP403, text/plain, without `cf-mitigated` or challenge-page markers. That establishes differing client outcomes, not a confirmed challenge mechanism or a visitor outage. No challenge was bypassed and no Cloudflare setting changed.
