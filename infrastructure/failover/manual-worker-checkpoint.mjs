// Protected owner-attested dashboard readback. No Cloudflare token or API write.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, lstat, readdir } from "node:fs/promises";
import path from "node:path";
const digest = (b) => createHash("sha256").update(b).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hex = (v) => /^[a-f0-9]{64}$/.test(v ?? "");
const uuid = (v) => /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v ?? "");
const ACCOUNT = "986b5334eba2d05d253ee98ca9842dfe";
const REPO = "JustinJIndustries/JustinJ_Industries_Website";
// Pinned from the already owner-approved first deployment, not current-state adoption.
// Cloudflare's ETag is provider-attested hashed script content, not raw-source SHA.
export const APPROVED_WORKER_SOURCE = Object.freeze({
  version: "1f8cfb35-4126-4db7-8eef-d70714e6719a",
  etag: "58cc48e3755185408cb01cb63ef5db0b09539f6710d442709015deef531d452f",
  sourceSha256:
    "334097948253968287724f06383413321445d7e87fffdc9ceeba0ea6954f01ed",
});
export const APPROVED_WORKER_SETTINGS_SHA256 =
  "fa6a2787491164e17d3cc37410a87176d6c43e2d7589bf4325a03d9f12fc8760";
const MACHINE = {
  platform: "darwin",
  arch: "arm64",
  hostname: "M1-Max-MacBook-Pro",
};
export const WORKER_PHASES = ["workerbaseline", "workerpromote", "workerfinal"];
const keys = (v, k) =>
  v && !Array.isArray(v) && same(Object.keys(v).sort(), k.slice().sort());
export function validateWorkerConfig(c) {
  if (
    !keys(c, ["origin", "current", "retained"]) ||
    !/^https:\/\/[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev\/$/.test(
      c.origin ?? "",
    ) ||
    !hex(c.current) ||
    !Array.isArray(c.retained) ||
    c.retained.length > 15 ||
    c.retained.some((x) => !hex(x)) ||
    new Set([c.current, ...c.retained]).size !== c.retained.length + 1
  )
    throw Error("Invalid dashboard release configuration");
  return c;
}
export function validateWorkerRequest(
  r,
  { now = Date.now(), fresh = true } = {},
) {
  if (
    !keys(r, [
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
      "account",
      "script",
      "sourceSha256",
      "sourceVersion",
      "sourceEtag",
      "expectedDeployment",
      "expectedVersion",
      "beforeConfig",
      "config",
    ]) ||
    r.schema !== "jji-manual-worker-request-1" ||
    r.repository !== REPO ||
    !/^[1-9]\d*$/.test(r.parentRunId ?? "") ||
    r.parentAttempt !== 1 ||
    !/^[a-f0-9]{40}$/.test(r.workflowCommit ?? "") ||
    !/^[a-f0-9]{40}$/.test(r.sourceCommit ?? "") ||
    !hex(r.release) ||
    !WORKER_PHASES.includes(r.phase) ||
    !uuid(r.nonce) ||
    r.account !== ACCOUNT ||
    r.script !== "jji-failover" ||
    r.sourceSha256 !== APPROVED_WORKER_SOURCE.sourceSha256 ||
    r.sourceVersion !== APPROVED_WORKER_SOURCE.version ||
    r.sourceEtag !== APPROVED_WORKER_SOURCE.etag ||
    !uuid(r.expectedDeployment) ||
    (r.expectedVersion !== null && !uuid(r.expectedVersion)) ||
    !Number.isSafeInteger(r.issuedAt) ||
    r.expiresAt - r.issuedAt !== 480000 ||
    !Number.isSafeInteger(r.admissionObservedAt) ||
    r.admissionObservedAt > r.issuedAt ||
    r.issuedAt - r.admissionObservedAt > 900000
  )
    throw Error("Invalid dashboard checkpoint request");
  validateWorkerConfig(r.config);
  validateWorkerConfig(r.beforeConfig);
  if (r.phase !== "workerpromote" && !same(r.config, r.beforeConfig))
    throw Error("Read-only checkpoint cannot change pointer");
  if (
    fresh &&
    (r.issuedAt > now + 30000 ||
      now > r.expiresAt ||
      now - r.admissionObservedAt > 900000)
  )
    throw Error("Stale dashboard checkpoint request");
  return r;
}
export function validateWorkerProof(
  p,
  r,
  requestDigest,
  { now = Date.now(), requestArtifact } = {},
) {
  validateWorkerRequest(r, { now });
  if (
    !keys(p, [
      "schema",
      "requestSha256",
      "requestArtifactId",
      "requestArtifactDigest",
      "repository",
      "parentRunId",
      "parentAttempt",
      "workflowCommit",
      "sourceCommit",
      "release",
      "phase",
      "nonce",
      "machine",
      "startedAt",
      "completedAt",
      "before",
      "after",
    ]) ||
    p.schema !== "jji-manual-worker-proof-1" ||
    p.requestSha256 !== requestDigest ||
    !hex(requestDigest) ||
    !same(p.machine, MACHINE) ||
    !requestArtifact ||
    p.requestArtifactId !== requestArtifact.id ||
    p.requestArtifactDigest !== requestArtifact.digest
  )
    throw Error("Missing authenticated dashboard proof");
  for (const k of [
    "repository",
    "parentRunId",
    "parentAttempt",
    "workflowCommit",
    "sourceCommit",
    "release",
    "phase",
    "nonce",
  ])
    if (!same(p[k], r[k]))
      throw Error("Dashboard proof run/source/phase mismatch");
  if (
    !Number.isSafeInteger(p.startedAt) ||
    !Number.isSafeInteger(p.completedAt) ||
    p.startedAt < r.issuedAt - 30000 ||
    p.completedAt < p.startedAt ||
    p.completedAt > now + 30000 ||
    now - p.completedAt > 180000 ||
    p.completedAt > r.expiresAt
  )
    throw Error("Stale dashboard proof");
  for (const s of [p.before, p.after]) {
    if (
      !keys(s, [
        "account",
        "script",
        "deployment",
        "version",
        "percentage",
        "sourceSha256",
        "sourceVersion",
        "sourceEtag",
        "settingsSha256",
        "config",
        "observedAt",
        "evidenceSha256",
      ]) ||
      s.account !== ACCOUNT ||
      s.script !== "jji-failover" ||
      !uuid(s.deployment) ||
      !uuid(s.version) ||
      s.percentage !== 100 ||
      s.sourceSha256 !== r.sourceSha256 ||
      s.sourceVersion !== r.sourceVersion ||
      s.sourceEtag !== r.sourceEtag ||
      s.settingsSha256 !== APPROVED_WORKER_SETTINGS_SHA256 ||
      !hex(s.evidenceSha256) ||
      !Number.isSafeInteger(s.observedAt) ||
      s.observedAt < p.startedAt ||
      s.observedAt > p.completedAt
    )
      throw Error("Incomplete dashboard source/version readback");
    validateWorkerConfig(s.config);
  }
  if (
    p.before.deployment !== r.expectedDeployment ||
    (r.expectedVersion !== null && p.before.version !== r.expectedVersion) ||
    !same(p.before.config, r.beforeConfig) ||
    !same(p.after.config, r.config) ||
    p.after.observedAt < p.before.observedAt
  )
    throw Error("Dashboard pointer/predecessor mismatch");
  if (
    r.phase === "workerpromote"
      ? p.after.deployment === p.before.deployment ||
        p.after.version === p.before.version
      : p.after.deployment !== p.before.deployment ||
        p.after.version !== p.before.version
  )
    throw Error("Dashboard version transition mismatch");
  return p;
}
export async function createWorkerDashboardGate({
  root,
  context,
  metadata,
  sourceSha256,
  bridge,
  beforeWrite,
  authenticateProof,
  now = Date.now,
}) {
  const attempted = new Set();
  return async (phase, expected) => {
    if (attempted.has(phase))
      throw Error(
        "Dashboard checkpoint already attempted; inspect, do not replay",
      );
    attempted.add(phase);
    const budget = await beforeWrite();
    const issuedAt = now();
    const request = validateWorkerRequest(
      {
        schema: "jji-manual-worker-request-1",
        repository: REPO,
        parentRunId: context.runId,
        parentAttempt: 1,
        workflowCommit: context.sha,
        sourceCommit: context.sourceCommit,
        release: metadata.release,
        phase,
        nonce: randomUUID(),
        issuedAt,
        expiresAt: issuedAt + 480000,
        admissionObservedAt: budget.observedAt,
        account: ACCOUNT,
        script: "jji-failover",
        sourceSha256,
        sourceVersion: APPROVED_WORKER_SOURCE.version,
        sourceEtag: APPROVED_WORKER_SOURCE.etag,
        ...expected,
      },
      { now: issuedAt },
    );
    const bytes = Buffer.from(JSON.stringify(request) + "\n");
    const sha256 = digest(bytes);
    const folder = path.join(root, "checkpoints", phase);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "request.json"), bytes, {
      flag: "wx",
      mode: 0o600,
    });
    const reply = await bridge.request("public-" + phase);
    const file = path.join(root, "proofs", phase, "proof.json");
    if (
      (await lstat(file)).isSymbolicLink() ||
      !same((await readdir(path.dirname(file))).sort(), ["proof.json"])
    )
      throw Error("Unexpected dashboard proof files");
    const recordBytes = await readFile(file);
    if (recordBytes.length > 16384) throw Error("Dashboard proof too large");
    const record = JSON.parse(recordBytes);
    const artifact = await authenticateProof({
      reply,
      record,
      recordSha256: digest(recordBytes),
      request,
      requestDigest: sha256,
    });
    validateWorkerProof(record.proof, request, sha256, {
      now: now(),
      requestArtifact: artifact,
    });
    await writeFile(
      path.join(root, phase + ".consumed.json"),
      JSON.stringify({
        requestSha256: sha256,
        nonce: request.nonce,
        proofRunId: record.proofRunId,
        artifactId: reply.id,
      }) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    return record.proof.after;
  };
}
// Provider-shaped adapter: all state comes from fresh protected readbacks. The
// operator performs exactly one dashboard update during workerpromote; CI never
// changes Worker code or routing. No synthetic UUID or bare success is accepted.
export function manualWorkerProvider({
  gate,
  baselineConfig,
  expectedDeployment,
  now = Date.now,
}) {
  validateWorkerConfig(baselineConfig);
  if (!uuid(expectedDeployment))
    throw Error("Exact reviewed deployment required");
  let state,
    pending,
    finalRead = false,
    baselineRead = false;
  let failure;
  const check = () => {
    if (failure)
      throw Error("Prior dashboard checkpoint failed; inspect before recovery");
  };
  const ask = async (...args) => {
    check();
    try {
      return await gate(...args);
    } catch (e) {
      failure = e;
      throw e;
    }
  };
  const fresh = () => {
    check();
    if (
      !state ||
      now() - state.observedAt > 180000 ||
      state.observedAt > now() + 30000
    )
      throw Error("Dashboard observation expired");
    return state;
  };
  return {
    async currentWorkerDeployment() {
      check();
      if (!baselineRead) {
        state = await ask("workerbaseline", {
          expectedDeployment,
          expectedVersion: null,
          beforeConfig: baselineConfig,
          config: baselineConfig,
        });
        baselineRead = true;
      } else if (pending && !finalRead) {
        const s = state;
        state = await ask("workerfinal", {
          expectedDeployment: s.deployment,
          expectedVersion: s.version,
          beforeConfig: s.config,
          config: s.config,
        });
        finalRead = true;
      }
      const s = fresh();
      return { id: s.deployment, version: s.version };
    },
    async currentWorkerConfiguration() {
      return fresh().config;
    },
    async uploadWorkerVersion({ code, config }) {
      check();
      if (pending || !baselineRead || digest(code) !== state?.sourceSha256)
        throw Error("Invalid manual promotion ordering");
      const s = state;
      pending = await ask("workerpromote", {
        expectedDeployment: s.deployment,
        expectedVersion: s.version,
        beforeConfig: s.config,
        config,
      });
      state = pending;
      return { version: state.version };
    },
    async promoteWorker({ version, expectedDeployment: previous }) {
      check();
      if (
        !pending ||
        version !== pending.version ||
        previous !== expectedDeployment
      )
        throw Error("Manual deployment readback mismatch");
      return { id: fresh().deployment, version };
    },
  };
}

export async function inspectDashboardReleaseCurrent({
  verifyPrimary,
  baseline,
  metadata,
  provider,
  expectedDeployment,
}) {
  await verifyPrimary(baseline, "baseline");
  const observed = await provider.currentWorkerDeployment();
  if (observed.id !== expectedDeployment)
    throw Error("Worker changed since review");
  return {
    exclusivePublisher: true,
    primaryFiles: metadata.previousFiles,
    release: metadata.previousRelease,
    pointerCurrent: (await provider.currentWorkerConfiguration()).current,
  };
}
