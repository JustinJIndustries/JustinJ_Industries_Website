import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createRecoveryReceipt,
  prepareRollbackRecovery,
} from "../../infrastructure/failover/recovery-receipt.mjs";
export const A = "https://aaaaaaaa.jji-backup-20261023.pages.dev/";
export const B = "https://ac3af448.jji-backup-20261023.pages.dev/";
export const OLD = "https://00000000.jji-backup-20261023.pages.dev/";
export const ROLLBACK = "https://bbbbbbbb.jji-backup-20261023.pages.dev/";
export function fileFetcher(routes, calls = []) {
  return async (url, options = {}) => {
    const u = new URL(url);
    calls.push({ url: u.href, ...options });
    const root = routes[u.origin + "/"];
    if (!root) throw new Error("Unconfigured mock origin");
    try {
      return new Response(
        await readFile(path.join(root, u.pathname.slice(1))),
        { headers: { "x-robots-tag": "noindex" } },
      );
    } catch {
      return new Response("missing", { status: 404 });
    }
  };
}
export const proof = (result) => ({
  bytes: result.bytes,
  sha256: result.sha256,
  durable: true,
  archive: {
    schema: 1,
    storageIdentity: "owner-test-archive",
    independentOwnerApproval: true,
    materialVerified: true,
    release: result.receipt.metadata.release,
    sourceCommit: result.receipt.sourceCommit,
    receiptSha256: result.sha256,
  },
});
export async function receiptFixtures(f) {
  const a = await createRecoveryReceipt({
    packageRoot: f.a,
    origin: A,
    bootstrapOrigin: OLD,
    sourceCommit: "a".repeat(40),
    workflowCommit: "c".repeat(40),
    workflowRunId: "1",
    fetcher: fileFetcher({
      [A]: path.join(f.a, "public"),
      [OLD]: path.join(f.a, "stage"),
    }),
  });
  const b = await createRecoveryReceipt({
    packageRoot: f.b,
    origin: B,
    sourceCommit: "b".repeat(40),
    workflowCommit: "c".repeat(40),
    workflowRunId: "2",
    previousReceiptBytes: a.bytes,
    previousReceiptDigest: a.sha256,
    fetcher: fileFetcher({
      [B]: path.join(f.b, "public"),
      [A]: path.join(f.a, "public"),
    }),
  });
  const rollbackRoot = path.join(f.root, "rollback-fixture");
  await prepareRollbackRecovery({
    recoveredRoot: f.b,
    receiptBytes: b.bytes,
    expectedDigest: b.sha256,
    output: rollbackRoot,
  });
  const rollback = await createRecoveryReceipt({
    packageRoot: rollbackRoot,
    origin: ROLLBACK,
    sourceCommit: "a".repeat(40),
    workflowCommit: "c".repeat(40),
    workflowRunId: "3",
    previousReceiptBytes: b.bytes,
    previousReceiptDigest: b.sha256,
    fetcher: fileFetcher({
      [ROLLBACK]: path.join(rollbackRoot, "public"),
      [B]: path.join(f.b, "public"),
    }),
  });
  return {
    receiptA: a,
    receiptB: b,
    receiptRollback: rollback,
    rollbackRoot,
    proofA: proof(a),
    proofB: proof(b),
    proofRollback: proof(rollback),
  };
}
