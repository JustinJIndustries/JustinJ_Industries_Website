import { assertCurrentSnapshot } from "./coordinate-release.mjs";
import { verifyCloudflareDirectory } from "./cloudflare-package.mjs";
import path from "node:path";
import { verifyPackage } from "./prepare-release.mjs";

// Wiring only; provider primitives and pinned-action artifact receipts are
// injected. Required verifier callbacks must compare response bytes against ALL
// supplied manifest entries on the named origin (not a fallback-masked edge).
// Intentionally no default inspectors or credential/environment lookups.
export function bindReleaseAdapters({
  provider,
  release,
  code,
  cloudflareDirectory,
  packageRoot,
  routes,
  githubArtifactFor,
  inspectCurrent,
  verifyPrimary,
  verifyBackup,
  expectedWorkerDeployment,
  receiptRecorder,
  writesApproved = false,
}) {
  const boundManifest = JSON.stringify(release);
  const boundRoot = path.resolve(packageRoot);
  let deployment = expectedWorkerDeployment;
  const suffix = release.release.slice(0, 40);
  const publishGithub = async (directory, phase) => {
    if (!writesApproved) throw new Error("Publication wiring is disabled");
    const expected = path.join(
      boundRoot,
      phase === "stage" ? "stage" : "public",
    );
    if (path.resolve(directory) !== expected)
      throw new Error("Directory does not match bound candidate; no write");
    const artifact = await githubArtifactFor(directory, phase); // pinned upload-pages-artifact receipt
    const r = await provider.deployGithub({
      ...artifact,
      key: `${phase}-${suffix}`,
    });
    await provider.waitGithub(r.id);
  };
  return {
    async assertCurrent(previousRelease, verifiedMeta) {
      if (!writesApproved) throw new Error("Publication wiring is disabled");
      if (typeof receiptRecorder !== "function")
        throw new Error("Durable receipt recorder missing; no write");
      if (
        previousRelease !== release.previousRelease ||
        JSON.stringify(verifiedMeta) !== boundManifest ||
        JSON.stringify(await verifyPackage(boundRoot)) !== boundManifest
      )
        throw new Error(
          "Verified package does not match bound candidate; no write",
        );
      await verifyCloudflareDirectory(packageRoot, cloudflareDirectory, routes);
      assertCurrentSnapshot(release, await inspectCurrent());
      if ((await provider.currentWorkerDeployment()).id !== deployment)
        throw new Error("Worker changed before asset stage; no write");
    },
    publishAssetStage: (directory) => publishGithub(directory, "stage"),
    verifyAssetStage: () => verifyPrimary(release.stageFiles),
    async publishBackup() {
      if (!writesApproved) throw new Error("Publication wiring is disabled");
      await verifyCloudflareDirectory(packageRoot, cloudflareDirectory, routes);
      return (
        await provider.uploadBackup({
          directory: cloudflareDirectory,
          key: `backup-${suffix}`,
        })
      ).origin;
    },
    verifyBackup: (origin) => verifyBackup(origin, release.files),
    recordRecovery: (meta, origin) => {
      if (!writesApproved) throw new Error("Publication wiring is disabled");
      return receiptRecorder(meta, origin);
    },
    async promoteFallback(config) {
      if (!writesApproved) throw new Error("Publication wiring is disabled");
      const v = await provider.uploadWorkerVersion({
        code,
        config,
        key: `version-${suffix}`,
      });
      const d = await provider.promoteWorker({
        version: v.version,
        expectedDeployment: deployment,
        key: `promote-${suffix}`,
      });
      deployment = d.id;
    },
    publishPrimary: (directory) => publishGithub(directory, "final"),
    async verifyPairedRelease(_meta, origin) {
      await verifyPrimary(release.files);
      await verifyBackup(origin, release.files);
      if ((await provider.currentWorkerDeployment()).id !== deployment)
        throw new Error("Worker changed during paired verification");
    },
  };
}

// Pages-only FIRST pairing: deliberately no Worker read, edit or promotion.
// The production publisher still must be exclusively paused/locked by preflight.
export function bindBootstrapAdapters({
  provider,
  release,
  packageRoot,
  cloudflareDirectory,
  routes,
  githubArtifactFor,
  inspectCurrent,
  verifyPrimary,
  verifyBackup,
  receiptRecorder,
  writesApproved = false,
}) {
  const root = path.resolve(packageRoot),
    bound = JSON.stringify(release),
    suffix = release.release.slice(0, 40);
  const gate = () => {
    if (!writesApproved) throw new Error("Bootstrap wiring is disabled");
  };
  const publish = async (directory, phase) => {
    gate();
    if (
      path.resolve(directory) !==
      path.join(root, phase === "stage" ? "stage" : "public")
    )
      throw new Error("Bootstrap directory does not match bound candidate");
    const a = await githubArtifactFor(directory, phase);
    const result = await provider.deployGithub({
      ...a,
      key: `${phase}-${suffix}`,
    });
    await provider.waitGithub(result.id);
  };
  return {
    async assertBootstrapCurrent(meta) {
      gate();
      if (
        release.bootstrap !== true ||
        JSON.stringify(meta) !== bound ||
        JSON.stringify(await verifyPackage(root)) !== bound ||
        typeof receiptRecorder !== "function"
      )
        throw new Error(
          "Exact bootstrap package and archive recorder required",
        );
      await verifyCloudflareDirectory(root, cloudflareDirectory, routes);
      const current = await inspectCurrent();
      if (
        current?.exclusivePublisher !== true ||
        current.workerActive !== false ||
        JSON.stringify(current.primaryFiles) !==
          JSON.stringify(release.sourceFiles)
      )
        throw new Error("Bootstrap raw baseline/exclusive publisher mismatch");
    },
    publishAssetStage: (directory) => publish(directory, "stage"),
    verifyAssetStage: () => verifyPrimary(release.stageFiles),
    async publishBackup() {
      gate();
      await verifyCloudflareDirectory(root, cloudflareDirectory, routes);
      return (
        await provider.uploadBackup({
          directory: cloudflareDirectory,
          key: `bootstrap-${suffix}`,
        })
      ).origin;
    },
    verifyBackup: (origin) => verifyBackup(origin, release.files),
    recordRecovery: (meta, origin) => {
      gate();
      return receiptRecorder(meta, origin);
    },
    publishPrimary: (directory) => publish(directory, "final"),
    async verifyPairedRelease(_meta, origin) {
      await verifyPrimary(release.files);
      await verifyBackup(origin, release.files);
    },
  };
}

// Rollback's verified package is separately rebased by prepareRollbackRecovery.
// Its backup + exact archive/receipt are durable BEFORE old primary HTML changes.
export function bindRollbackAdapters({
  provider,
  originalRelease,
  rollbackRelease,
  originalRoot,
  rollbackRoot,
  cloudflareDirectory,
  routes,
  githubArtifactFor,
  inspectCurrent,
  verifyPrimary,
  verifyBackup,
  receiptRecorder,
  expectedWorkerDeployment,
  code,
  writesApproved = false,
}) {
  const initial = JSON.stringify(originalRelease),
    restored = JSON.stringify(rollbackRelease),
    root = path.resolve(originalRoot),
    backupRoot = path.resolve(rollbackRoot),
    suffix = originalRelease.release.slice(0, 40);
  let deployment = expectedWorkerDeployment;
  const gate = () => {
    if (!writesApproved) throw new Error("Rollback wiring is disabled");
  };
  const expectedStage = (directory) => {
    if (path.resolve(directory) !== path.join(root, "stage"))
      throw new Error("Rollback directory does not match bound stage");
  };
  return {
    async assertRollbackCurrent(meta) {
      gate();
      if (
        JSON.stringify(meta) !== initial ||
        JSON.stringify(await verifyPackage(root)) !== initial ||
        JSON.stringify(await verifyPackage(backupRoot)) !== restored ||
        rollbackRelease.release !== originalRelease.previousRelease ||
        JSON.stringify(rollbackRelease.files) !==
          JSON.stringify(originalRelease.stageFiles) ||
        typeof receiptRecorder !== "function"
      )
        throw new Error("Exact rollback package and archive recorder required");
      await verifyCloudflareDirectory(backupRoot, cloudflareDirectory, routes);
      const current = await inspectCurrent();
      if (
        current?.exclusivePublisher !== true ||
        current.release !== originalRelease.release ||
        current.pointerCurrent !== originalRelease.release ||
        JSON.stringify(current.primaryFiles) !==
          JSON.stringify(originalRelease.files) ||
        (await provider.currentWorkerDeployment()).id !== deployment
      )
        throw new Error("Rollback current state mismatch; reconcile first");
    },
    async publishRollbackBackup(directory) {
      gate();
      expectedStage(directory);
      await verifyCloudflareDirectory(backupRoot, cloudflareDirectory, routes);
      return (
        await provider.uploadBackup({
          directory: cloudflareDirectory,
          key: `rollback-backup-${suffix}`,
        })
      ).origin;
    },
    verifyRollbackBackup: (origin) =>
      verifyBackup(origin, rollbackRelease.files),
    recordRollbackRecovery: (_meta, origin) => {
      gate();
      return receiptRecorder(rollbackRelease, origin);
    },
    async publishRollbackPrimary(directory) {
      gate();
      expectedStage(directory);
      const a = await githubArtifactFor(directory, "rollback");
      const result = await provider.deployGithub({
        ...a,
        key: `rollback-primary-${suffix}`,
      });
      await provider.waitGithub(result.id);
    },
    verifyRollbackPrimary: () => verifyPrimary(rollbackRelease.files),
    async promoteRollbackFallback(config) {
      gate();
      const v = await provider.uploadWorkerVersion({
        code,
        config,
        key: `rollback-version-${suffix}`,
      });
      deployment = (
        await provider.promoteWorker({
          version: v.version,
          expectedDeployment: deployment,
          key: `rollback-promote-${suffix}`,
        })
      ).id;
    },
    async verifyRollbackPair(_meta, origin) {
      await verifyPrimary(rollbackRelease.files);
      await verifyBackup(origin, rollbackRelease.files);
      if ((await provider.currentWorkerDeployment()).id !== deployment)
        throw new Error("Rollback Worker changed during verification");
    },
  };
}
