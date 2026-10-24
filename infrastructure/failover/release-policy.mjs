import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { verifyPackage } from "./prepare-release.mjs";
import { RETENTION, assertAdmissionEvidence } from "./storage-admission.mjs";

export function assertTrustedContext(c) {
  if (
    c?.repository !== "JustinJIndustries/JustinJ_Industries_Website" ||
    c.ref !== "refs/heads/main" ||
    !["push", "workflow_dispatch"].includes(c.event) ||
    !/^[a-f0-9]{40}$/.test(c.sha ?? "") ||
    c.sha !== c.approvedSha ||
    !/^\d+$/.test(c.runId ?? "") ||
    c.environmentApproved !== true ||
    c.environment !== "failover-sync" ||
    c.workflowPath !== ".github/workflows/paired-release.yml" ||
    c.concurrencyGroup !== "pages" ||
    c.otherPublishersPaused !== true
  )
    throw new Error("Untrusted or competing publication context");
}

// Fail closed on unverified account capacity. Accumulated GB-hours are not a
// substitute for current bytes. Provider zero-dollar blocking remains required.
export function assertStorageBudget(s, now = Date.now(), policy = {}) {
  const fields = [
    "accountUsedBytes",
    "receiptBytes",
    "largestPagesArtifactBytes",
    "freeStorageBytes",
    "recoveryArtifactBytes",
    "retainedReceiptCount",
    "retainedReceiptBytes",
    "retainedTransientCount",
    "currentRunReceiptCount",
    "currentRunTransientCount",
  ];
  if (
    !s ||
    fields.some((k) => !Number.isSafeInteger(s[k]) || s[k] < 0) ||
    !Number.isSafeInteger(s.observedAt) ||
    now - s.observedAt > 15 * 60_000 ||
    s.observedAt > now ||
    s.spendingBlocked !== true ||
    s.publicStandardRunner !== true ||
    s.workersFree !== true ||
    s.pagesFree !== true ||
    s.retentionDays !== 1 ||
    s.retentionApproved !== true ||
    s.recoveryArchived !== true ||
    s.optionalCachesDisabled !== true ||
    s.transientCopies !== 2 ||
    s.checkpointArchiveBytes !== 0 ||
    s.receiptBytes > RETENTION.receiptBytes ||
    s.recoveryArtifactBytes !== RETENTION.recoveryArtifactBytes ||
    s.receiptRetentionDays !== RETENTION.receiptDays ||
    s.retainedReceiptCount + 1 > RETENTION.maxReceipts ||
    s.currentRunReceiptCount > 1 ||
    s.currentRunTransientCount > s.transientCopies ||
    s.retainedTransientCount + s.transientCopies >
      RETENTION.maxTransientArtifacts ||
    s.retainedReceiptBytes > s.accountUsedBytes ||
    s.receiptRetentionApproved !== true
  )
    throw new Error("Unverified zero-spend storage guard");
  assertAdmissionEvidence(s, policy);
  // No full public checkpoint archive. Keep BOTH Pages deployment artifacts in
  // the peak budget: no deletion or provider cleanup is assumed.
  const peak =
    s.accountUsedBytes +
    Math.ceil(s.recoveryArtifactBytes * 1.2) * (1 - s.currentRunReceiptCount) +
    s.largestPagesArtifactBytes *
      (s.transientCopies - s.currentRunTransientCount) +
    20 * 1024 * 1024;
  if (peak > s.freeStorageBytes)
    throw new Error(
      "Free storage headroom exceeded; stop without pruning or upgrade",
    );
  return {
    peakBytes: peak,
    retentionDays: 1,
    receiptRetentionDays: s.receiptRetentionDays,
    checkpointArchiveBytes: 0,
    projectedReceiptCount: s.retainedReceiptCount + 1,
    projectedTransientCount: s.retainedTransientCount + s.transientCopies,
    recoveryArtifactBytes: RETENTION.recoveryArtifactBytes,
  };
}

// Legacy owner-held checkpoint compatibility only. The lean workflow never
// calls this or uploads a new full checkpoint. Existing archives are preserved.
export async function compactCheckpoint(root, output) {
  const meta = await verifyPackage(root);
  await mkdir(output); // refuses overwrite
  await cp(path.join(root, "public"), path.join(output, "public"), {
    recursive: true,
  });
  await writeFile(
    path.join(output, "release.json"),
    JSON.stringify(meta, null, 2) + "\n",
  );
  return createHash("sha256")
    .update(await readFile(path.join(output, "release.json")))
    .digest("hex");
}

export async function hydrateCheckpoint(compact, previous, output) {
  const parent = await verifyPackage(previous, { requireStage: false });
  await mkdir(output);
  await cp(path.join(compact, "public"), path.join(output, "public"), {
    recursive: true,
  });
  await cp(
    path.join(compact, "release.json"),
    path.join(output, "release.json"),
  );
  const meta = JSON.parse(
    await readFile(path.join(output, "release.json"), "utf8"),
  );
  if (meta.previousRelease !== parent.release)
    throw new Error("Wrong checkpoint predecessor");
  await cp(path.join(previous, "public"), path.join(output, "stage"), {
    recursive: true,
  });
  await cp(
    path.join(output, "public/__jji_releases", meta.release),
    path.join(output, "stage/__jji_releases", meta.release),
    { recursive: true },
  );
  return verifyPackage(output);
}
