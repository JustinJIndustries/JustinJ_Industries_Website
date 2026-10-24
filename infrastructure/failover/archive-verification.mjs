// Read back an independently held FULL release package. A different runner
// folder alone does not prove independence: the protected owner approval must
// identify the independently held storage and exact receipt digest.
import { readFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { verifyPackage } from "./prepare-release.mjs";
import { decodeReceipt } from "./recovery-receipt.mjs";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const within = (a, b) => a === b || a.startsWith(b + path.sep);
export function assertArchiveProof(proof, receipt) {
  if (
    proof?.schema !== 1 ||
    proof.materialVerified !== true ||
    proof.independentOwnerApproval !== true ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(proof.storageIdentity ?? "") ||
    proof.release !== receipt.metadata.release ||
    proof.sourceCommit !== receipt.sourceCommit ||
    proof.receiptSha256 !== receipt.expectedDigest
  )
    throw new Error(
      "Exact independently archived release and receipt required",
    );
}

export async function verifyIndependentArchive({
  packageRoot,
  receiptBytes,
  expectedDigest,
  readArchive,
  readOwnerApproval,
}) {
  const r = decodeReceipt(receiptBytes, expectedDigest);
  if (
    typeof readArchive !== "function" ||
    typeof readOwnerApproval !== "function"
  )
    throw new Error("Independent archive readers required");
  // The protected owner ledger is independent of the downloaded archive itself.
  const approval = await readOwnerApproval(
    expectedDigest,
    Buffer.from(receiptBytes),
  );
  const proof = { ...approval, materialVerified: true };
  assertArchiveProof(proof, { ...r, expectedDigest });
  const a = await readArchive(proof.storageIdentity, expectedDigest);
  if (!a || a.independentStorageVerified !== true)
    throw new Error("Archive storage independence unverified");
  for (const f of [a.packageRoot, a.receiptFile, a.digestFile])
    if (
      typeof f !== "string" ||
      !path.isAbsolute(f) ||
      (await lstat(f)).isSymbolicLink()
    )
      throw new Error("Unsafe archive readback path");
  const original = await realpath(packageRoot),
    archived = await realpath(a.packageRoot);
  if (within(original, archived) || within(archived, original))
    throw new Error("Working release is not an independent archive");
  for (const f of [a.receiptFile, a.digestFile])
    if (within(await realpath(f), original))
      throw new Error("Working receipt is not independently archived");
  const receipt = await readFile(a.receiptFile),
    digest = (await readFile(a.digestFile, "utf8")).trim();
  if (digest !== expectedDigest || !receipt.equals(receiptBytes))
    throw new Error("Archived exact receipt or independent digest missing");
  decodeReceipt(receipt, digest);
  const material = await verifyPackage(archived);
  if (!same(material, r.metadata))
    throw new Error(
      "Archive does not contain exact public AND rollback material",
    );
  // Do not persist runner paths, private archive URLs or personal information.
  return {
    schema: 1,
    storageIdentity: proof.storageIdentity,
    independentOwnerApproval: true,
    materialVerified: true,
    release: r.metadata.release,
    sourceCommit: r.sourceCommit,
    receiptSha256: expectedDigest,
  };
}
