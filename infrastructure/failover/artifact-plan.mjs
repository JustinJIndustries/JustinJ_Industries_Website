import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertStorageBudget } from "./release-policy.mjs";
import { verifyPackage } from "./prepare-release.mjs";
import { RETENTION } from "./storage-admission.mjs";
async function bytes(root) {
  let total = 0;
  for (const item of await readdir(root, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error("Artifact symlink rejected");
    if (item.isDirectory()) total += await bytes(path.join(root, item.name));
    else if (item.isFile())
      total += (await stat(path.join(root, item.name))).size;
    else throw new Error("Unsupported artifact entry");
  }
  return total;
}
export async function artifactPlan(root, previous, snapshot, policy = {}) {
  await verifyPackage(root);
  if (previous) await verifyPackage(previous, { requireStage: false });
  // 20% reserve for archive framing/metadata, before account-level headroom.
  const reserve = (size) => Math.ceil(size * 1.2);
  // The final immutable hostname is known only after a future Pages upload.
  // Reserve the full receipt cap before ANY upload; actual receipts must fit it.
  const receiptBytes = RETENTION.receiptBytes;
  const largestPagesArtifactBytes = reserve(
    Math.max(
      await bytes(path.join(root, "stage")),
      await bytes(path.join(root, "public")),
    ),
  );
  return assertStorageBudget(
    {
      ...snapshot,
      receiptBytes,
      checkpointArchiveBytes: 0,
      recoveryArtifactBytes: RETENTION.recoveryArtifactBytes,
      largestPagesArtifactBytes,
    },
    Date.now(),
    policy,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [root, previous, snapshotFile] = process.argv.slice(2);
  if (!snapshotFile)
    throw new Error("Verified account snapshot required; no upload permitted");
  const plan = await artifactPlan(
    root,
    previous,
    JSON.parse(await readFile(snapshotFile, "utf8")),
  );
  console.log(JSON.stringify(plan)); // byte counts only; never credentials/provider body
}
