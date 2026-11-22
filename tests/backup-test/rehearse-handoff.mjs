// A PR rehearsal. All provider responses are served from the reconstructed
// package on disk. This script issues no release approval or hosted receipt.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  describe,
  restore,
} from "../../infrastructure/failover/build-handoff.mjs";
import {
  prepare,
  RELEASE,
  SOURCE,
} from "../../infrastructure/backup-test/backup-only.mjs";
import { verifyPackage } from "../../infrastructure/backup-test/prepare-release.mjs";
import {
  createRecoveryReceipt,
  recoverPackage,
  prepareRollbackRecovery,
} from "../../infrastructure/backup-test/recovery-receipt.mjs";

const manifest = process.env.BUILD_MANIFEST;
const root = await mkdtemp(path.join(tmpdir(), "jji-backup-rehearsal-"));
try {
  const sourceDirectory = path.join(root, "restored");
  const prepared = path.join(root, "prepared");
  await restore(sourceDirectory, manifest, SOURCE, RELEASE);
  assert.equal(await describe(sourceDirectory), manifest);
  const release = await prepare(sourceDirectory, prepared);
  assert.equal(release.release, RELEASE);
  const changed = JSON.parse(manifest);
  changed[0].sha256 =
    changed[0].sha256 === "0".repeat(64) ? "1".repeat(64) : "0".repeat(64);
  await assert.rejects(
    restore(
      path.join(root, "invalid"),
      JSON.stringify(changed),
      SOURCE,
      RELEASE,
    ),
    /manifest mismatch/,
  );

  const packageRoot = path.join(prepared, "package");
  const preview = "https://11111111.jji-backup-20261023.pages.dev/";
  const ancestor = "https://22222222.jji-backup-20261023.pages.dev/";
  const publicFiles = new Set(release.files.map((file) => file.path));
  const historicalFiles = new Set(release.sourceFiles.map((file) => file.path));
  const fetcher = async (url) => {
    const name = url.pathname.slice(1);
    if (url.origin + "/" === preview && publicFiles.has(name))
      return new Response(
        await readFile(path.join(packageRoot, "public", name)),
      );
    if (url.origin + "/" === ancestor && historicalFiles.has(name))
      return new Response(await readFile(path.join(sourceDirectory, name)));
    throw new Error("Request outside rehearsal inventory");
  };
  const control = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const runId = process.env.GITHUB_RUN_ID;
  assert.match(runId ?? "", /^[1-9][0-9]*$/);
  const issued = await createRecoveryReceipt({
    packageRoot,
    origin: preview,
    bootstrapOrigin: ancestor,
    sourceCommit: SOURCE,
    workflowCommit: control,
    workflowRunId: runId,
    fetcher,
  });
  const receipt = { receiptBytes: issued.bytes, expectedDigest: issued.sha256 };
  const recoveredRoot = path.join(root, "recovered");
  await recoverPackage({ ...receipt, output: recoveredRoot, fetcher });
  assert.deepEqual(await verifyPackage(recoveredRoot), release);
  const rollback = path.join(root, "rollback");
  const restored = await prepareRollbackRecovery({
    ...receipt,
    recoveredRoot,
    output: rollback,
  });
  assert.deepEqual((await verifyPackage(rollback)).files, release.stageFiles);
  assert.deepEqual(restored.sourceFiles, release.sourceFiles);
  console.log(
    JSON.stringify({
      operation: "offline preview rehearsal",
      source: SOURCE,
      control,
      runId,
      release: RELEASE,
      manifestBytes: Buffer.byteLength(manifest),
      sourceFiles: release.sourceFiles.length,
      verifiedPublicFiles: release.files.length,
      verifiedRollbackFiles: restored.files.length,
      providerWrites: 0,
    }),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
