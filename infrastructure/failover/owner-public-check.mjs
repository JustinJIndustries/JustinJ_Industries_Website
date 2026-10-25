import {
  assertLocalControlClean,
  captureWorkerState,
  makeWorkerProof,
} from "./owner-worker-readback.mjs";
import { WORKER_PHASES } from "./manual-worker-checkpoint.mjs";
import { verifyPackage } from "./prepare-release.mjs";
// Owner-operated M1 checkpoint. Uses existing gh authentication, never reads keys.
// Creates proof only after every actual public HTTPS response passes verification.
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, lstat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  REPO,
  OWNER,
  OWNER_ID,
  CHECKPOINT,
  hash,
  assertArtifact,
  assertRun,
  requestName,
  validateRequest,
  verifyOnM1,
} from "./public-checkpoint.mjs";
import { listArtifacts, assertProtectedOwner } from "./checkpoint-github.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const gh = (args, options = {}) =>
  execFileSync(
    "gh",
    args[0] === "api"
      ? ["api", "--hostname", "github.com", ...args.slice(1)]
      : args,
    {
      maxBuffer: CHECKPOINT.requestBytes * 2,
      ...options,
    },
  );
const read = async (endpoint) => {
  if (!endpoint.startsWith(`/repos/${REPO}/`) || /[\r\n#]/.test(endpoint))
    throw new Error("Unapproved owner inspection endpoint");
  return JSON.parse(gh(["api", endpoint]));
};
try {
  const [runId, phase, packageRoot, destination, operation] =
    process.argv.slice(2);
  if (
    os.platform() !== "darwin" ||
    os.arch() !== "arm64" ||
    os.hostname() !== "M1-Max-MacBook-Pro"
  )
    throw new Error("Authorized M1 required");
  if (
    !path.isAbsolute(packageRoot ?? "") ||
    !path.isAbsolute(destination ?? "")
  )
    throw new Error("Absolute package/output locations required");
  const user = JSON.parse(gh(["api", "user"]));
  if (user.login !== OWNER || user.id !== OWNER_ID)
    throw new Error("Existing owner GitHub identity required");
  const control = assertLocalControlClean(here);
  if ((await read(`/repos/${REPO}/commits/main`)).sha !== control)
    throw new Error("M1 control checkout is not reviewed current main");
  assertRun(await read(`/repos/${REPO}/actions/runs/${runId}`), {
    runId,
    control,
  });
  await assertProtectedOwner(read);
  const matches = (await listArtifacts(read)).filter(
    (a) => !a.expired && a.name === requestName(runId, phase),
  );
  if (matches.length !== 1)
    throw new Error("Missing or ambiguous checkpoint request artifact");
  const artifact = assertArtifact(matches[0], {
    runId,
    control,
    name: requestName(runId, phase),
    maxBytes: CHECKPOINT.requestBytes,
  });
  const archive = gh([
    "api",
    `/repos/${REPO}/actions/artifacts/${artifact.id}/zip`,
  ]);
  if (hash(archive) !== artifact.digest.slice(7))
    throw new Error("Request ZIP digest mismatch");
  const temp = await mkdtemp(path.join(os.tmpdir(), "jji-m1-public-request-"));
  const zip = path.join(temp, "request.zip");
  await writeFile(zip, archive, { flag: "wx", mode: 0o600 });
  const names = execFileSync("/usr/bin/unzip", ["-Z1", zip], {
    encoding: "utf8",
    maxBuffer: 8192,
  })
    .trim()
    .split("\n");
  if (names.length !== 1 || names[0] !== "request.json")
    throw new Error("Unsafe request ZIP members");
  const requestBytes = execFileSync(
    "/usr/bin/unzip",
    ["-p", zip, "request.json"],
    { maxBuffer: CHECKPOINT.requestBytes },
  );
  const request = validateRequest(JSON.parse(requestBytes));
  if (
    request.parentRunId !== runId ||
    request.workflowCommit !== control ||
    request.phase !== phase ||
    Date.parse(artifact.created_at) < request.issuedAt - CHECKPOINT.skewMs
  )
    throw new Error("M1 request identity mismatch");
  let proof;
  const worker = WORKER_PHASES.includes(phase);
  if (worker) {
    if ((await verifyPackage(packageRoot)).release !== request.release)
      throw new Error("Worker checkpoint package mismatch");
    const capture = () => captureWorkerState({ request });
    if (phase === "workerpromote") {
      if (operation === "begin") {
        const startedAt = Date.now(),
          before = await capture();
        if (
          before.deployment !== request.expectedDeployment ||
          (request.expectedVersion !== null &&
            before.version !== request.expectedVersion) ||
          JSON.stringify(before.config) !== JSON.stringify(request.beforeConfig)
        )
          throw new Error("Dashboard predecessor changed; no update permitted");
        await mkdir(destination);
        await writeFile(
          path.join(destination, "before.json"),
          JSON.stringify({
            requestSha256: hash(requestBytes),
            startedAt,
            before,
          }) + "\n",
          { flag: "wx", mode: 0o600 },
        );
        console.log(
          JSON.stringify({
            phase,
            runId,
            requestSha256: hash(requestBytes),
            beforeVersion: before.version,
            expiresAt: request.expiresAt,
            next: "Perform the exact reviewed dashboard pointer update, then finish this same request; do not restart or reuse stale evidence.",
          }),
        );
        process.exit(0);
      }
      if (operation !== "finish")
        throw new Error(
          "Manual promotion requires begin, exact dashboard update, then finish",
        );
      const file = path.join(destination, "before.json");
      if ((await lstat(file)).isSymbolicLink())
        throw new Error("Worker predecessor proof symlink");
      const saved = JSON.parse(await readFile(file));
      if (saved.requestSha256 !== hash(requestBytes))
        throw new Error("Worker predecessor request mismatch");
      const after = await capture();
      proof = makeWorkerProof({
        requestBytes,
        requestArtifact: artifact,
        before: saved.before,
        after,
        startedAt: saved.startedAt,
      });
    } else {
      if (operation)
        throw new Error("Read-only Worker phase takes no operation");
      const startedAt = Date.now(),
        before = await capture(),
        after = await capture();
      proof = makeWorkerProof({
        requestBytes,
        requestArtifact: artifact,
        before,
        after,
        startedAt,
      });
      await mkdir(destination);
    }
  } else {
    if (operation) throw new Error("Unexpected public-check operation");
    proof = await verifyOnM1({
      requestBytes,
      packageRoot,
      requestArtifact: artifact,
    });
    await mkdir(destination);
  }
  await writeFile(path.join(destination, "request.json"), requestBytes, {
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(
    path.join(destination, "proof.json"),
    JSON.stringify(proof, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  const inputs = {
    checkpoint_claim: JSON.stringify({
      parentRunId: runId,
      requestArtifactId: artifact.id,
      requestSha256: hash(requestBytes),
    }),
    m1_public_proof: JSON.stringify(proof),
  };
  await writeFile(
    path.join(destination, "dispatch-inputs.json"),
    JSON.stringify(inputs, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      phase,
      runId,
      control,
      requestArtifactId: artifact.id,
      requestSha256: hash(requestBytes),
      verifiedFiles: proof.fileCount,
      verifiedWorkerVersion: proof.after?.version,
      completedAt: proof.completedAt,
      proofSha256: hash(JSON.stringify(proof)),
      authentication: "Awaiting separate protected owner proof-workflow review",
      dispatchInputs: path.join(destination, "dispatch-inputs.json"),
    }),
  );
} catch (error) {
  console.error("M1 public checkpoint failed; no success proof issued.");
  console.error(
    [
      "Authorized M1 required",
      "Existing owner GitHub identity required",
      "M1 control checkout is not reviewed current main",
      "Missing or ambiguous checkpoint request artifact",
      "Request ZIP digest mismatch",
      "Unsafe request ZIP members",
    ].includes(error?.message)
      ? error.message
      : "Inspect request/phase, complete manifest and normal TLS; do not bypass a challenge.",
  );
  process.exitCode = 1;
}
