// Owner-attested M1 evidence, authenticated through a protected GitHub workflow.
// This is not hardware remote attestation. A bare success flag is never accepted.
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile, lstat, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { verifyPackage } from "./prepare-release.mjs";
import { createPublicArtifactVerifier } from "./public-parity.mjs";

export const REPO = "JustinJIndustries/JustinJ_Industries_Website";
export const OWNER = "JustinJIndustries";
export const OWNER_ID = 107809547;
export const CHECKPOINT = Object.freeze({
  requestBytes: 256 * 1024,
  proofBytes: 16 * 1024,
  maxArtifacts: 24,
  waitMs: 8 * 60000,
  freshMs: 3 * 60000,
  skewMs: 30000,
});
export const hash = (b) => createHash("sha256").update(b).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha = (v) => /^[a-f0-9]{40}$/.test(v ?? "");
const digest = (v) => /^[a-f0-9]{64}$/.test(v ?? "");
const id = (v) =>
  typeof v === "string" &&
  /^[1-9]\d*$/.test(v) &&
  Number.isSafeInteger(Number(v));
const machineIdentity = () => ({
  platform: os.platform(),
  arch: os.arch(),
  hostname: os.hostname(),
});
const MACHINE = {
  platform: "darwin",
  arch: "arm64",
  hostname: "M1-Max-MacBook-Pro",
};
const phases = new Set(["baseline", "stage", "final"]);
function exactKeys(value, keys) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    same(Object.keys(value).sort(), keys.slice().sort())
  );
}
export function inventoryFor(meta, phase) {
  if (!phases.has(phase)) throw new Error("Unknown public checkpoint phase");
  return phase === "baseline"
    ? meta.previousFiles
    : phase === "stage"
      ? meta.stageFiles
      : meta.files;
}
export function requestName(runId, phase) {
  if (!id(runId) || !phases.has(phase))
    throw new Error("Invalid public checkpoint identity");
  return `paired-checkpoint-${runId}-${phase}`;
}
export function proofName(r) {
  validateRequest(r, { fresh: false });
  return `paired-public-proof-${r.parentRunId}-${r.phase}-${r.nonce}`;
}
export function validateRequest(r, { now = Date.now(), fresh = true } = {}) {
  if (
    !exactKeys(r, [
      "schema",
      "repository",
      "parentRunId",
      "parentAttempt",
      "workflowCommit",
      "sourceCommit",
      "release",
      "phase",
      "nonce",
      "issuedAt",
      "expiresAt",
      "admissionObservedAt",
      "manifestSha256",
      "fileCount",
      "requirePrimaryMarker",
      "entries",
    ]) ||
    r.schema !== "jji-m1-public-request-1" ||
    r.repository !== REPO ||
    !id(r.parentRunId) ||
    r.parentAttempt !== 1 ||
    !sha(r.workflowCommit) ||
    !sha(r.sourceCommit) ||
    !digest(r.release) ||
    !phases.has(r.phase) ||
    !/^[a-f0-9-]{36}$/.test(r.nonce ?? "") ||
    !Number.isSafeInteger(r.issuedAt) ||
    !Number.isSafeInteger(r.expiresAt) ||
    r.expiresAt - r.issuedAt !== CHECKPOINT.waitMs ||
    !Number.isSafeInteger(r.admissionObservedAt) ||
    r.admissionObservedAt > r.issuedAt ||
    r.issuedAt - r.admissionObservedAt > 15 * 60000 ||
    typeof r.requirePrimaryMarker !== "boolean" ||
    !Array.isArray(r.entries) ||
    !r.entries.length ||
    r.entries.length > 2000 ||
    r.fileCount !== r.entries.length ||
    hash(JSON.stringify(r.entries)) !== r.manifestSha256 ||
    new Set(r.entries.map((e) => e.path)).size !== r.entries.length
  )
    throw new Error("Invalid public checkpoint request");
  for (const e of r.entries)
    if (
      !exactKeys(e, ["path", "sha256"]) ||
      !/^[\w.@/-]+$/.test(e.path) ||
      e.path.includes("..") ||
      e.path.startsWith("/") ||
      !digest(e.sha256)
    )
      throw new Error("Unsafe public checkpoint manifest");
  if (
    fresh &&
    (r.issuedAt > now + CHECKPOINT.skewMs ||
      now > r.expiresAt ||
      now - r.admissionObservedAt > 15 * 60000)
  )
    throw new Error("Stale public checkpoint request");
  return r;
}
export function createRequest({
  context,
  metadata,
  entries,
  phase,
  requirePrimaryMarker = false,
  admissionObservedAt,
  now = Date.now(),
  nonce = randomUUID(),
}) {
  if (
    context.repository !== REPO ||
    !id(context.runId) ||
    !sha(context.sha) ||
    !sha(context.sourceCommit) ||
    !same(entries, inventoryFor(metadata, phase))
  )
    throw new Error("Public checkpoint is not bound to exact phase artifact");
  const r = {
    schema: "jji-m1-public-request-1",
    repository: REPO,
    parentRunId: context.runId,
    parentAttempt: 1,
    workflowCommit: context.sha,
    sourceCommit: context.sourceCommit,
    release: metadata.release,
    phase,
    nonce,
    issuedAt: now,
    expiresAt: now + CHECKPOINT.waitMs,
    admissionObservedAt,
    manifestSha256: hash(JSON.stringify(entries)),
    fileCount: entries.length,
    requirePrimaryMarker,
    entries,
  };
  validateRequest(r, { now });
  const bytes = Buffer.from(JSON.stringify(r) + "\n");
  if (bytes.length > CHECKPOINT.requestBytes)
    throw new Error("Public checkpoint request exceeds cap");
  return { request: r, bytes, sha256: hash(bytes) };
}
export function validateProof(
  p,
  r,
  requestDigest,
  { now = Date.now(), requestArtifact } = {},
) {
  validateRequest(r, { now });
  if (
    !exactKeys(p, [
      "schema",
      "requestSha256",
      "repository",
      "parentRunId",
      "parentAttempt",
      "workflowCommit",
      "sourceCommit",
      "release",
      "phase",
      "nonce",
      "manifestSha256",
      "fileCount",
      "requirePrimaryMarker",
      "requestArtifactId",
      "requestArtifactDigest",
      "machine",
      "startedAt",
      "completedAt",
      "verification",
    ]) ||
    p.schema !== "jji-m1-public-proof-1" ||
    !digest(requestDigest) ||
    p.requestSha256 !== requestDigest ||
    !same(p.machine, MACHINE) ||
    !requestArtifact ||
    p.requestArtifactId !== requestArtifact.id ||
    p.requestArtifactDigest !== requestArtifact.digest
  )
    throw new Error("Missing or unauthenticated M1 public proof");
  for (const k of [
    "repository",
    "parentRunId",
    "parentAttempt",
    "workflowCommit",
    "sourceCommit",
    "release",
    "phase",
    "nonce",
    "manifestSha256",
    "fileCount",
    "requirePrimaryMarker",
  ])
    if (!same(p[k], r[k]))
      throw new Error("Public proof phase/run/artifact mismatch");
  if (
    !Number.isSafeInteger(p.startedAt) ||
    !Number.isSafeInteger(p.completedAt) ||
    p.startedAt < r.issuedAt - CHECKPOINT.skewMs ||
    p.completedAt < p.startedAt ||
    p.completedAt > now + CHECKPOINT.skewMs ||
    now - p.completedAt > CHECKPOINT.freshMs ||
    p.completedAt > r.expiresAt ||
    p.startedAt > r.expiresAt
  )
    throw new Error("Stale or future M1 public proof");
  const v = p.verification;
  if (
    !exactKeys(v, [
      "policy",
      "origin",
      "sourceCommit",
      "artifactRelease",
      "workflowCommit",
      "verifiedFiles",
      "transforms",
    ]) ||
    v.policy !== "reviewed-artifact-and-pinned-cf-parity-1" ||
    v.origin !== "https://www.justinjindustries.com/" ||
    v.sourceCommit !== r.sourceCommit ||
    v.artifactRelease !== r.release ||
    v.workflowCommit !== r.workflowCommit ||
    v.verifiedFiles !== r.fileCount ||
    !exactKeys(v.transforms, [
      "hiddenCanary",
      "emailHref",
      "emailText",
      "emailMarkup",
      "emailDecoder",
      "jsDetection",
      "managedRobots",
    ]) ||
    Object.values(v.transforms).some(
      (n) => !Number.isSafeInteger(n) || n < 0 || n > 128 * r.fileCount,
    )
  )
    throw new Error("Incomplete public verification evidence");
  return p;
}
export async function verifyOnM1({
  requestBytes,
  packageRoot,
  fetcher = globalThis.fetch,
  machine = machineIdentity(),
  now = Date.now,
  requestArtifact,
}) {
  if (
    !same(machine, MACHINE) ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ||
    process.env.NODE_EXTRA_CA_CERTS ||
    process.env.NODE_USE_ENV_PROXY === "1"
  )
    throw new Error("Authorized M1 and ordinary TLS required");
  if (requestBytes.length > CHECKPOINT.requestBytes)
    throw new Error("Checkpoint request size");
  const r = validateRequest(JSON.parse(requestBytes), { now: now() });
  const meta = await verifyPackage(packageRoot);
  if (
    meta.release !== r.release ||
    !same(inventoryFor(meta, r.phase), r.entries)
  )
    throw new Error("M1 package does not match requested publication phase");
  const startedAt = now();
  const verify = await createPublicArtifactVerifier({
    packageRoot,
    provenance: {
      repository: REPO,
      sourceCommit: r.sourceCommit,
      workflowCommit: r.workflowCommit,
      workflowRunId: r.parentRunId,
    },
    approvedSourceCommit: r.sourceCommit,
    approvedWorkflowCommit: r.workflowCommit,
    approvedRelease: r.release,
    requirePrimaryMarker: r.requirePrimaryMarker,
    fetcher,
  });
  const verification = await verify(r.entries); // Every requested file, normal public HTTPS.
  const proof = {
    schema: "jji-m1-public-proof-1",
    requestSha256: hash(requestBytes),
    ...Object.fromEntries(
      [
        "repository",
        "parentRunId",
        "parentAttempt",
        "workflowCommit",
        "sourceCommit",
        "release",
        "phase",
        "nonce",
        "manifestSha256",
        "fileCount",
        "requirePrimaryMarker",
      ].map((k) => [k, r[k]]),
    ),
    requestArtifactId: requestArtifact?.id,
    requestArtifactDigest: requestArtifact?.digest,
    machine,
    startedAt,
    completedAt: now(),
    verification,
  };
  validateProof(proof, r, hash(requestBytes), { now: now(), requestArtifact });
  return proof;
}
export function assertArtifact(
  a,
  { runId, control, name, maxBytes, now = Date.now() },
) {
  if (
    !Number.isSafeInteger(a?.id) ||
    a.id < 1 ||
    a.expired !== false ||
    a.name !== name ||
    a.workflow_run?.id !== Number(runId) ||
    a.workflow_run?.head_sha !== control ||
    a.workflow_run?.head_branch !== "main" ||
    !/^sha256:[a-f0-9]{64}$/.test(a.digest ?? "") ||
    !Number.isSafeInteger(a.size_in_bytes) ||
    a.size_in_bytes < 1 ||
    a.size_in_bytes > Math.ceil(maxBytes * 1.2) ||
    !Number.isFinite(Date.parse(a.created_at)) ||
    Date.parse(a.created_at) > now + CHECKPOINT.skewMs ||
    !Number.isFinite(Date.parse(a.expires_at)) ||
    Math.abs(Date.parse(a.expires_at) - Date.parse(a.created_at) - 86400000) >
      120000
  )
    throw new Error("Public checkpoint artifact provenance/retention mismatch");
  return a;
}
export function assertRun(run, { runId, control, proof = false }) {
  if (
    run?.id !== Number(runId) ||
    run.repository?.full_name !== REPO ||
    run.head_branch !== "main" ||
    run.head_sha !== control ||
    run.event !== "workflow_dispatch" ||
    run.run_attempt !== 1 ||
    run.actor?.login !== OWNER ||
    run.actor?.id !== OWNER_ID ||
    run.triggering_actor?.login !== OWNER ||
    run.triggering_actor?.id !== OWNER_ID ||
    run.path !==
      (proof
        ? ".github/workflows/paired-public-proof.yml"
        : ".github/workflows/paired-release.yml") ||
    (proof
      ? run.status !== "completed" || run.conclusion !== "success"
      : run.status !== "in_progress") ||
    run.pull_requests?.length
  )
    throw new Error("Untrusted public checkpoint workflow/run");
  return run;
}
export function assertCheckpointArtifactBudget(artifacts) {
  if (!Array.isArray(artifacts))
    throw new Error("Complete checkpoint inventory required");
  const kept = artifacts.filter(
    (a) =>
      !a.expired && /^(paired-checkpoint-|paired-public-proof-)/.test(a.name),
  );
  if (
    kept.length >= CHECKPOINT.maxArtifacts ||
    kept.some(
      (a) =>
        !Number.isSafeInteger(a.size_in_bytes) ||
        a.size_in_bytes > Math.ceil(CHECKPOINT.requestBytes * 1.2),
    )
  )
    throw new Error("Public checkpoint retention budget exceeded; no pruning");
  return {
    retained: kept.length,
    reservedNextBytes: Math.ceil(CHECKPOINT.requestBytes * 1.2),
  };
}
export async function createM1Gate({
  root,
  packageRoot,
  context,
  metadata,
  requirePrimaryMarker,
  bridge,
  beforeWrite,
  authenticateProof,
  now = Date.now,
}) {
  const attempted = new Set();
  return async (entries, phase) => {
    if (attempted.has(phase))
      throw new Error("Public checkpoint already attempted; no replay");
    attempted.add(phase);
    if (!same(await verifyPackage(packageRoot), metadata))
      throw new Error("Checkpoint artifact changed before request");
    const budget = await beforeWrite();
    const issued = createRequest({
      context,
      metadata,
      entries,
      phase,
      requirePrimaryMarker,
      admissionObservedAt: budget.observedAt,
      now: now(),
    });
    const folder = path.join(root, "checkpoints", phase);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "request.json"), issued.bytes, {
      flag: "wx",
      mode: 0o600,
    });
    const reply = await bridge.request("public-" + phase);
    const recordFile = path.join(root, "proofs", phase, "proof.json");
    if (
      (await lstat(recordFile)).isSymbolicLink() ||
      !same((await readdir(path.dirname(recordFile))).sort(), ["proof.json"])
    )
      throw new Error("Unexpected M1 proof files");
    const bytes = await readFile(recordFile);
    if (bytes.length > CHECKPOINT.proofBytes)
      throw new Error("M1 proof record size");
    const record = JSON.parse(bytes);
    const requestArtifact = await authenticateProof({
      reply,
      record,
      recordSha256: hash(bytes),
      request: issued.request,
      requestDigest: issued.sha256,
    });
    validateProof(record.proof, issued.request, issued.sha256, {
      now: now(),
      requestArtifact,
    });
    await writeFile(
      path.join(root, "public-" + phase + ".consumed.json"),
      JSON.stringify({
        requestSha256: issued.sha256,
        nonce: issued.request.nonce,
        artifactId: reply.id,
        artifactDigest: reply.digest,
        proofRunId: record.proofRunId,
      }) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    return {
      ...record.proof.verification,
      checkpoint: {
        phase,
        requestSha256: issued.sha256,
        proofRunId: record.proofRunId,
        proofArtifactId: reply.id,
        completedAt: record.proof.completedAt,
        authentication: "protected-owner-attested-M1",
      },
    };
  };
}
