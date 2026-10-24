import { verifyPackage } from "./prepare-release.mjs";
import { decodeReceipt } from "./recovery-receipt.mjs";
import { assertArchiveProof } from "./archive-verification.mjs";

function recoveryRequired(adapters, method) {
  if (typeof adapters[method] !== "function")
    throw new Error("Durable recovery recorder required before publication");
}
function checkRecovery(proof, origin, release, files, retained) {
  if (proof?.durable !== true)
    throw new Error("Recovery receipt was not durably recorded/read back");
  const r = decodeReceipt(proof.bytes, proof.sha256);
  assertArchiveProof(proof.archive, { ...r, expectedDigest: proof.sha256 });
  if (
    r.origin !== origin ||
    r.metadata.release !== release ||
    JSON.stringify(r.metadata.files) !== JSON.stringify(files) ||
    r.metadata.releases.length !== retained.length ||
    retained.some((id) => !r.metadata.releases.includes(id))
  )
    throw new Error("Durable recovery receipt does not match publication");
}

// Deployment adapters are injected. This module contains no credentials or
// network calls. A live adapter must reconcile uncertain writes before retries.
export async function coordinateRelease(packageRoot, adapters) {
  const release = await verifyPackage(packageRoot);
  if (release.releases.length < 2)
    throw new Error("A reviewed bootstrap release is required first");
  // Must verify remote HTML digests, pointer, and shared deployment lock before
  // ANY write. An old successful workflow run alone is not a current predecessor.
  recoveryRequired(adapters, "recordRecovery");
  await adapters.assertCurrent(release.previousRelease, release);
  await adapters.publishAssetStage(packageRoot + "/stage");
  await adapters.verifyAssetStage(release);
  const immutableOrigin = await adapters.publishBackup(packageRoot + "/public");
  const parsed = new URL(immutableOrigin);
  if (
    parsed.protocol !== "https:" ||
    !/^[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev$/.test(parsed.hostname) ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("Backup deployment is not an allowlisted immutable origin");
  await adapters.verifyBackup(immutableOrigin, release);
  checkRecovery(
    await adapters.recordRecovery(release, immutableOrigin),
    immutableOrigin,
    release.release,
    release.files,
    release.releases,
  );
  await adapters.promoteFallback({
    origin: parsed.href,
    current: release.release,
    retained: release.releases.slice(1),
  });
  await adapters.publishPrimary(packageRoot + "/public");
  await adapters.verifyPairedRelease(release, immutableOrigin);
  return { release: release.release, immutableOrigin: parsed.href };
}

// Read-only preflight helper used before FIRST write; inspection must be from
// approved independent origin access, not only the possibly cached public edge.
export function assertCurrentSnapshot(release, observed) {
  if (
    observed?.release !== release.previousRelease ||
    observed.pointerCurrent !== release.previousRelease ||
    observed.exclusivePublisher !== true ||
    JSON.stringify(observed.primaryFiles) !==
      JSON.stringify(release.previousFiles)
  )
    throw new Error(
      "Stale predecessor or competing publisher; no publication permitted",
    );
}

// Deliberate recovery, never automatic on a failed/uncertain phase. After any new
// HTML exposure, roll back using STAGE (old root + BOTH asset generations), never
// the raw predecessor public tree. Backup must likewise contain the whole union.
export async function coordinateRollback(packageRoot, adapters) {
  const release = await verifyPackage(packageRoot);
  if (!release.previousRelease) throw new Error("No verified rollback stage");
  recoveryRequired(adapters, "recordRollbackRecovery");
  await adapters.assertRollbackCurrent(release);
  const immutableOrigin = await adapters.publishRollbackBackup(
    packageRoot + "/stage",
  );
  if (
    !/^https:\/\/[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev\/$/.test(
      immutableOrigin,
    )
  )
    throw new Error("Invalid rollback origin");
  await adapters.verifyRollbackBackup(immutableOrigin, release);
  checkRecovery(
    await adapters.recordRollbackRecovery(release, immutableOrigin),
    immutableOrigin,
    release.previousRelease,
    release.stageFiles,
    release.releases,
  );
  await adapters.publishRollbackPrimary(packageRoot + "/stage");
  await adapters.verifyRollbackPrimary(release);
  await adapters.promoteRollbackFallback({
    origin: immutableOrigin,
    current: release.previousRelease,
    retained: release.releases.filter((id) => id !== release.previousRelease),
  });
  await adapters.verifyRollbackPair(release, immutableOrigin);
  return { release: release.previousRelease, immutableOrigin };
}

// Initial pairing has no active fallback pointer to promote. The recovery receipt
// is still mandatory before new immutable-reference HTML becomes primary.
export async function coordinateBootstrap(packageRoot, adapters) {
  const release = await verifyPackage(packageRoot);
  if (release.bootstrap !== true)
    throw new Error("Explicit reviewed bootstrap required");
  recoveryRequired(adapters, "recordRecovery");
  await adapters.assertBootstrapCurrent(release);
  await adapters.publishAssetStage(packageRoot + "/stage");
  await adapters.verifyAssetStage(release);
  const immutableOrigin = await adapters.publishBackup(packageRoot + "/public");
  if (
    !/^https:\/\/[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev\/$/.test(
      immutableOrigin,
    )
  )
    throw new Error("Unapproved bootstrap origin");
  await adapters.verifyBackup(immutableOrigin, release);
  checkRecovery(
    await adapters.recordRecovery(release, immutableOrigin),
    immutableOrigin,
    release.release,
    release.files,
    release.releases,
  );
  await adapters.publishPrimary(packageRoot + "/public");
  await adapters.verifyPairedRelease(release, immutableOrigin);
  return { release: release.release, immutableOrigin };
}
