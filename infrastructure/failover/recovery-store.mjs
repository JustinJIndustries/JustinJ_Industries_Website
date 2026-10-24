// Inactive provider wiring. The official pinned artifact bridge and independent
// archive readers are injected; no SDK, token lookup, CLI or default network I/O.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  createRecoveryReceipt,
  decodeReceipt,
  persistRecoveryReceipt,
} from "./recovery-receipt.mjs";
import { verifyIndependentArchive } from "./archive-verification.mjs";
import { RETENTION } from "./storage-admission.mjs";
import {
  assertStorageBudget,
  assertTrustedContext,
} from "./release-policy.mjs";
const REPO = "JustinJIndustries/JustinJ_Industries_Website";
const digest = (b) => createHash("sha256").update(b).digest("hex");
export function sanitizedJournal(bytes) {
  if (bytes.length > RETENTION.journalBytes)
    throw new Error("Journal size limit");
  const entries = JSON.parse(bytes);
  if (!entries || typeof entries !== "object" || Array.isArray(entries))
    throw new Error("Journal shape");
  for (const [key, e] of Object.entries(entries)) {
    if (
      !/^[a-z][a-z0-9-]{1,80}$/.test(key) ||
      !e ||
      Object.keys(e).some(
        (k) => !["state", "intentDigest", "receipt"].includes(k),
      ) ||
      !["uncertain", "confirmed"].includes(e.state) ||
      !/^[a-f0-9]{64}$/.test(e.intentDigest ?? "")
    )
      throw new Error("Unsafe journal entry");
    if (e.receipt)
      for (const [k, v] of Object.entries(e.receipt)) {
        const patterns = {
          id: /^[a-f0-9-]{1,64}$/,
          version: /^[a-f0-9-]{36}$/,
          release: /^[a-f0-9]{64}$/,
          origin: /^https:\/\/[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev\/$/,
        };
        if (typeof v !== "string" || !patterns[k]?.test(v))
          throw new Error("Unsafe journal receipt");
      }
  }
  return Buffer.from(JSON.stringify(entries) + "\n");
}
async function bounded(call, ms) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(call),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Artifact transport outcome uncertain")),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function createRecoveryRecorder({
  packageRoot,
  provenance,
  previous,
  bootstrapOrigin,
  fetcher,
  readArchive,
  readOwnerApproval,
  transport,
  journal,
  context,
  refreshStorage,
  storagePolicy = {},
  writesApproved = false,
  transportTimeoutMs = 120000,
}) {
  // A poisoned/uncertain artifact write cannot be retried by recreating the
  // recorder. The stable key is release + workflow run, not a changing timestamp.
  return async function record(meta, origin) {
    if (!writesApproved) throw new Error("Recovery publication is disabled");
    if (!(transportTimeoutMs > 0 && transportTimeoutMs <= 120000))
      throw new Error("Invalid bounded artifact transport timeout");
    assertTrustedContext(context);
    if (
      context.sha !== provenance.workflowCommit ||
      context.runId !== provenance.workflowRunId ||
      (storagePolicy.allowInventoryAdmission === true &&
        storagePolicy.currentRunId !== context.runId) ||
      typeof refreshStorage !== "function" ||
      typeof transport?.upload !== "function" ||
      typeof transport?.readBack !== "function" ||
      !journal?.run ||
      !/^\d+$/.test(provenance.workflowRunId ?? "")
    )
      throw new Error("Trusted receipt publication wiring missing");
    const issued = await createRecoveryReceipt({
      packageRoot,
      origin,
      ...provenance,
      bootstrapOrigin,
      previousReceiptBytes: previous?.bytes,
      previousReceiptDigest: previous?.sha256,
      fetcher,
    });
    if (JSON.stringify(issued.receipt.metadata) !== JSON.stringify(meta))
      throw new Error("Receipt recorder bound to a different release");
    const archive = await verifyIndependentArchive({
      packageRoot,
      receiptBytes: issued.bytes,
      expectedDigest: issued.sha256,
      readArchive,
      readOwnerApproval,
    });
    const archiveBytes = Buffer.from(JSON.stringify(archive) + "\n");
    if (archiveBytes.length > RETENTION.archiveProofBytes)
      throw new Error("Archive proof size budget exceeded");
    let uploadedFiles;
    const store = {
      writeOnce: async (bytes, expectedDigest) => {
        assertStorageBudget(await refreshStorage(), Date.now(), storagePolicy);
        return journal.run(
          `receipt-${meta.release.slice(0, 24)}-${provenance.workflowRunId}`,
          async () => {
            const journalBytes = sanitizedJournal(await readFile(journal.file));
            uploadedFiles = {
              "receipt.json": bytes,
              "archive-proof.json": archiveBytes,
              "journal.json": journalBytes,
            };
            if (
              Object.values(uploadedFiles).reduce((n, b) => n + b.length, 0) >
              RETENTION.recoveryArtifactBytes
            )
              throw new Error("Recovery artifact exceeds approved byte budget");
            const result = await bounded(
              () =>
                transport.upload({
                  repository: REPO,
                  runId: provenance.workflowRunId,
                  workflowCommit: provenance.workflowCommit,
                  name: "paired-release-receipt",
                  retentionDays: RETENTION.receiptDays,
                  files: uploadedFiles,
                  expectedReceiptDigest: expectedDigest,
                }),
              transportTimeoutMs,
            );
            return { id: result?.id };
          },
          {
            repository: REPO,
            runId: provenance.workflowRunId,
            release: meta.release,
            origin,
            receiptSha256: expectedDigest,
            archiveProofSha256: digest(archiveBytes),
          },
        );
      },
      readBack: async (identity) => {
        const a = await bounded(
          () => transport.readBack(identity.id),
          Math.min(15000, transportTimeoutMs),
        );
        if (
          a.repository !== REPO ||
          a.runId !== provenance.workflowRunId ||
          a.workflowCommit !== provenance.workflowCommit ||
          a.name !== "paired-release-receipt" ||
          a.expired !== false ||
          a.retentionDays !== RETENTION.receiptDays ||
          !a.files ||
          JSON.stringify(Object.keys(a.files).sort()) !==
            JSON.stringify([
              "archive-proof.json",
              "journal.json",
              "receipt.json",
            ])
        )
          throw new Error("Untrusted recovery artifact provenance or contents");
        // After reconciliation the journal payload may differ; compare exact
        // pinned receipt/archive and a bounded sanitized journal in all cases.
        const receipt = Buffer.from(a.files["receipt.json"]),
          archived = Buffer.from(a.files["archive-proof.json"]),
          logged = Buffer.from(a.files["journal.json"]);
        if (
          !archived.equals(archiveBytes) ||
          logged.length > RETENTION.journalBytes ||
          receipt.length + archived.length + logged.length >
            RETENTION.recoveryArtifactBytes
        )
          throw new Error("Recovery artifact readback mismatch");
        if (
          uploadedFiles &&
          Object.entries(uploadedFiles).some(
            ([name, b]) => !Buffer.from(a.files[name]).equals(b),
          )
        )
          throw new Error("Recovery artifact bytes changed on readback");
        sanitizedJournal(logged);
        decodeReceipt(receipt, issued.sha256);
        return receipt;
      },
    };
    return {
      ...(await persistRecoveryReceipt({
        bytes: issued.bytes,
        expectedDigest: issued.sha256,
        store,
      })),
      archive,
    };
  };
}
