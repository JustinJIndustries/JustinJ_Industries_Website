// Proposed admission policy only. No remote reads, billing changes or pruning.
import { createHash } from "node:crypto";

export const RETENTION = Object.freeze({
  receiptDays: 7,
  maxReceipts: 7,
  maxTransientArtifacts: 2,
  receiptBytes: 1024 * 1024,
  recoveryArtifactBytes: 2 * 1024 * 1024,
  journalBytes: 64 * 1024,
  archiveProofBytes: 8 * 1024,
});
const OWNER = "JustinJIndustries";
const REPO = `${OWNER}/JustinJ_Industries_Website`;
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
function repositoryIdentity(r) {
  if (
    typeof r.fullName === "string" &&
    new RegExp(`^${OWNER}/[A-Za-z0-9_.-]+$`).test(r.fullName)
  )
    return "name:" + r.fullName;
  if (
    r.fullName === undefined &&
    r.owner === OWNER &&
    r.metadataRedacted === true &&
    /^[a-f0-9]{64}$/.test(r.opaqueIdentity ?? "")
  )
    return "opaque:" + r.opaqueIdentity;
  throw new Error("Verified owned repository identity required");
}

// A trusted read-only inspector supplies the complete account inventory. These
// owner attestations are not authenticated by this module; live CI must bind
// them to its protected approval/inspection path. Missing bytes never become 0.
export function inspectLogicalInventory(i, observedAt) {
  if (
    i?.owner !== OWNER ||
    i.observedAt !== observedAt ||
    i.ownerVerified !== true ||
    i.repositoriesComplete !== true ||
    !/^\d+$/.test(i.currentRunId ?? "") ||
    !Array.isArray(i.repositories) ||
    !i.repositories.length ||
    new Set(i.repositories.map(repositoryIdentity)).size !==
      i.repositories.length ||
    i.packages?.complete !== true ||
    !integer(i.packages.bytes) ||
    !["api-complete", "owner-ui-empty"].includes(i.packages.source) ||
    (i.packages.source === "owner-ui-empty" && i.packages.bytes !== 0)
  )
    throw new Error("Complete owner-verified logical inventory required");
  let accountUsedBytes = i.packages.bytes,
    retainedReceiptCount = 0,
    retainedReceiptBytes = 0,
    retainedTransientCount = 0,
    currentRunReceiptCount = 0,
    currentRunTransientCount = 0;
  for (const r of i.repositories) {
    if (
      r.artifactsComplete !== true ||
      !Array.isArray(r.artifacts) ||
      new Set(r.artifacts.map((a) => a.id)).size !== r.artifacts.length
    )
      throw new Error("Incomplete repository artifact inventory");
    for (const a of r.artifacts) {
      if (
        !Number.isSafeInteger(a.id) ||
        a.id < 1 ||
        typeof a.name !== "string" ||
        !integer(a.bytes)
      )
        throw new Error("Unknown artifact identity or storage bytes");
      accountUsedBytes += a.bytes;
      if (r.fullName !== REPO) continue;
      if (a.name === "paired-release-receipt") {
        if (!/^\d+$/.test(a.runId ?? ""))
          throw new Error("Unknown recovery artifact run");
        if (a.runId === i.currentRunId) currentRunReceiptCount++;
        else retainedReceiptCount++;
        retainedReceiptBytes += a.bytes;
        if (a.bytes > Math.ceil(RETENTION.recoveryArtifactBytes * 1.2))
          throw new Error("Existing recovery artifact exceeds approved cap");
      } else if (
        /^(?:github-pages|paired-stage(?:-\d+)?|paired-final(?:-\d+)?)$/.test(
          a.name,
        )
      ) {
        if (!/^\d+$/.test(a.runId ?? ""))
          throw new Error("Unknown deployment artifact run");
        if (a.runId === i.currentRunId) currentRunTransientCount++;
        else retainedTransientCount++;
      }
    }
  }
  if (!integer(accountUsedBytes))
    throw new Error("Inventory byte total overflow");
  return {
    accountUsedBytes,
    retainedReceiptCount,
    retainedReceiptBytes,
    retainedTransientCount,
    currentRunReceiptCount,
    currentRunTransientCount,
    inventorySha256: createHash("sha256")
      .update(JSON.stringify(i))
      .digest("hex"),
  };
}

export function assertAdmissionEvidence(s, policy = {}) {
  if ((s.admissionMode ?? "authoritative") === "authoritative") {
    if (s.authoritativeCapacityVerified !== true)
      throw new Error("Verified authoritative storage evidence required");
    return;
  }
  if (
    s.admissionMode !== "logical-inventory" ||
    policy.allowInventoryAdmission !== true ||
    s.inventoryAdmissionApproved !== true ||
    policy.currentRunId !== s.logicalInventory?.currentRunId ||
    s.actionsSpendingBlocked !== true ||
    s.packagesSpendingBlocked !== true
  )
    throw new Error("Logical inventory admission is disabled or unapproved");
  const counts = inspectLogicalInventory(s.logicalInventory, s.observedAt);
  for (const k of [
    "accountUsedBytes",
    "retainedReceiptCount",
    "retainedReceiptBytes",
    "retainedTransientCount",
    "currentRunReceiptCount",
    "currentRunTransientCount",
  ])
    if (s[k] !== counts[k])
      throw new Error("Snapshot does not match complete inventory");
}
