// Owner-operated local readback. No upload, credential lookup or remote write.
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  stat,
  lstat,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { decodeReceipt, recoverPackage } from "./recovery-receipt.mjs";
import { verifyPackage } from "./prepare-release.mjs";
const exec = promisify(execFile);
const hash = (b) => createHash("sha256").update(b).digest("hex");

export function verifyOwnerMacProof(
  proof,
  receipt,
  expectedDigest,
  { approved = false, now = Date.now() } = {},
) {
  const keys = [
    "schema",
    "owner",
    "storageIdentity",
    "release",
    "sourceCommit",
    "receiptSha256",
    "archiveSha256",
    "archiveBytes",
    "verifiedFiles",
    "verifiedAt",
  ];
  if (
    !approved ||
    !proof ||
    Object.keys(proof).sort().join() !== keys.sort().join() ||
    proof.schema !== "jji-owner-mac-readback-1" ||
    proof.owner !== "JustinJIndustries" ||
    proof.storageIdentity !== "owner-m1-held-archive" ||
    proof.release !== receipt.metadata.release ||
    proof.sourceCommit !== receipt.sourceCommit ||
    proof.receiptSha256 !== expectedDigest ||
    !/^[a-f0-9]{64}$/.test(proof.archiveSha256 ?? "") ||
    !Number.isSafeInteger(proof.archiveBytes) ||
    proof.archiveBytes < 1 ||
    proof.archiveBytes > 500 * 1024 * 1024 ||
    proof.verifiedFiles !==
      receipt.publicFiles.length + receipt.stageFiles.length ||
    !Number.isSafeInteger(proof.verifiedAt) ||
    proof.verifiedAt > now ||
    now - proof.verifiedAt > 24 * 60 * 60_000
  )
    throw new Error(
      "Explicit protected owner approval of exact Mac archive readback required",
    );
  // This authenticates the owner's attestation through reviewed workflow inputs.
  // CI cannot directly read the offline Mac. It is not off-device Mac redundancy.
  return {
    schema: 1,
    storageIdentity: proof.storageIdentity,
    independentOwnerApproval: true,
    materialVerified: true,
    release: proof.release,
    sourceCommit: proof.sourceCommit,
    receiptSha256: expectedDigest,
    verificationMode: "protected-owner-attested-mac-restore",
    archiveSha256: proof.archiveSha256,
    archiveBytes: proof.archiveBytes,
    offDeviceMacRedundancy: false,
  };
}

export async function archiveOnOwnerMac({
  receiptBytes,
  expectedDigest,
  destination,
  fetcher,
}) {
  const receipt = decodeReceipt(receiptBytes, expectedDigest);
  if (!path.isAbsolute(destination))
    throw new Error("Explicit absolute owner-held destination required");
  for (
    let parent = path.dirname(destination);
    ;
    parent = path.dirname(parent)
  ) {
    if (
      await lstat(path.join(parent, ".git")).then(
        () => true,
        (e) => {
          if (e.code !== "ENOENT") throw e;
          return false;
        },
      )
    )
      throw new Error("Owner archives must remain outside Git checkouts");
    if (parent === path.dirname(parent)) break;
  }
  await mkdir(destination); // refuse overwrite, preserve every prior archive
  const material = path.join(destination, "package");
  await recoverPackage({
    receiptBytes,
    expectedDigest,
    output: material,
    fetcher,
  });
  await writeFile(path.join(destination, "receipt.json"), receiptBytes, {
    flag: "wx",
  });
  await writeFile(
    path.join(destination, "receipt.sha256"),
    expectedDigest + "\n",
    { flag: "wx" },
  );
  const archive = path.join(destination, "release.tar.gz");
  await exec(
    "/usr/bin/tar",
    [
      "-czf",
      archive,
      "-C",
      destination,
      "package",
      "receipt.json",
      "receipt.sha256",
    ],
    { timeout: 120000 },
  );
  const archiveSha256 = hash(await readFile(archive));
  const restored = await mkdtemp(path.join(os.tmpdir(), "jji-owner-restore-"));
  await exec("/usr/bin/tar", ["-xzf", archive, "-C", restored], {
    timeout: 120000,
  });
  if (
    hash(await readFile(path.join(restored, "receipt.json"))) !==
      expectedDigest ||
    (await readFile(path.join(restored, "receipt.sha256"), "utf8")).trim() !==
      expectedDigest ||
    JSON.stringify(await verifyPackage(path.join(restored, "package"))) !==
      JSON.stringify(receipt.metadata)
  )
    throw new Error("Actual archive restore failed; no promotion proof issued");
  const proof = {
    schema: "jji-owner-mac-readback-1",
    owner: "JustinJIndustries",
    storageIdentity: "owner-m1-held-archive",
    release: receipt.metadata.release,
    sourceCommit: receipt.sourceCommit,
    receiptSha256: expectedDigest,
    archiveSha256,
    archiveBytes: (await stat(archive)).size,
    verifiedFiles: receipt.publicFiles.length + receipt.stageFiles.length,
    verifiedAt: Date.now(),
  };
  await writeFile(
    path.join(destination, "owner-proof.json"),
    JSON.stringify(proof, null, 2) + "\n",
    { flag: "wx" },
  );
  return proof;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [file, digest, destination] = process.argv.slice(2);
  console.log(
    JSON.stringify(
      await archiveOnOwnerMac({
        receiptBytes: await readFile(file),
        expectedDigest: digest,
        destination,
      }),
    ),
  );
}
