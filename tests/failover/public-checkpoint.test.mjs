import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { prepareRelease } from "../../infrastructure/failover/prepare-release.mjs";
import { actionBridge } from "../../infrastructure/failover/action-bridge.mjs";
import { coordinateBootstrap } from "../../infrastructure/failover/coordinate-release.mjs";
import { createRecoveryReceipt } from "../../infrastructure/failover/recovery-receipt.mjs";
import {
  fileFetcher,
  proof as archiveProof,
  A,
  OLD,
} from "./receipt-fixture.mjs";
import {
  createRequest,
  validateRequest,
  validateProof,
  verifyOnM1,
  createM1Gate,
  hash,
  REPO,
  OWNER,
  OWNER_ID,
  CHECKPOINT,
  requestName,
  proofName,
  assertRun,
  assertArtifact,
  assertCheckpointArtifactBudget,
} from "../../infrastructure/failover/public-checkpoint.mjs";
import {
  authenticateRecord,
  waitForProof,
  writeProtectedProof,
  proofWorkflowGuard,
} from "../../infrastructure/failover/checkpoint-github.mjs";

const CONTROL = "c".repeat(40),
  SOURCE = "a".repeat(40),
  machine = {
    platform: "darwin",
    arch: "arm64",
    hostname: "M1-Max-MacBook-Pro",
  };
const principal = { login: OWNER, id: OWNER_ID };
function run(id, proof = false) {
  return {
    id: Number(id),
    repository: { full_name: REPO },
    head_branch: "main",
    head_sha: CONTROL,
    event: "workflow_dispatch",
    run_attempt: 1,
    actor: principal,
    triggering_actor: principal,
    path: proof
      ? ".github/workflows/paired-public-proof.yml"
      : ".github/workflows/paired-release.yml",
    status: proof ? "completed" : "in_progress",
    conclusion: proof ? "success" : null,
    pull_requests: [],
  };
}
function artifact(id, runId, name, now, max = 1000) {
  return {
    id,
    name,
    workflow_run: { id: Number(runId), head_sha: CONTROL, head_branch: "main" },
    expired: false,
    digest: "sha256:" + "d".repeat(64),
    size_in_bytes: max,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + 86400000).toISOString(),
  };
}
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-m1-gate-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  await mkdir(source);
  await writeFile(
    path.join(source, "index.html"),
    '<!doctype html><html><body><h1>Approved page</h1><link href="/style.css"></body></html>',
  );
  await writeFile(path.join(source, "style.css"), "body{color:#123}");
  const packageRoot = path.join(root, "package"),
    meta = await prepareRelease({
      source,
      output: packageRoot,
      bootstrap: true,
    });
  const now = Date.now(),
    context = {
      repository: REPO,
      runId: "42",
      sha: CONTROL,
      sourceCommit: SOURCE,
    };
  const issued = createRequest({
    context,
    metadata: meta,
    entries: meta.previousFiles,
    phase: "baseline",
    admissionObservedAt: now,
    now,
  });
  const requestArtifact = artifact(
    10,
    "42",
    requestName("42", "baseline"),
    now,
  );
  const calls = [];
  const fetcher = async (url, options) => {
    const u = new URL(url);
    calls.push({ url: u.href, options });
    assert.equal(u.origin, "https://www.justinjindustries.com");
    return new Response(
      await readFile(path.join(packageRoot, "stage", u.pathname.slice(1))),
      {
        headers: {
          "content-type": u.pathname.endsWith(".html")
            ? "text/html"
            : "text/css",
          "x-jji-source": "primary",
        },
      },
    );
  };
  const proof = await verifyOnM1({
    requestBytes: issued.bytes,
    packageRoot,
    requestArtifact,
    fetcher,
    machine,
    now: () => now,
  });
  const record = {
    schema: "jji-protected-m1-proof-1",
    proofRunId: "99",
    requestArtifactId: 10,
    requestArtifactDigest: requestArtifact.digest,
    proof,
  };
  const proofArtifact = artifact(
    11,
    "99",
    proofName(issued.request) + "-" + hash(JSON.stringify(record) + "\n"),
    now,
  );
  const envProof = {
    GITHUB_REPOSITORY: REPO,
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_ACTOR: OWNER,
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_WORKFLOW_REF: `${REPO}/.github/workflows/paired-public-proof.yml@refs/heads/main`,
    RUNNER_ENVIRONMENT: "github-hosted",
    RUNNER_OS: "Linux",
    GITHUB_RUN_ID: "99",
    GITHUB_SHA: CONTROL,
    CHECKPOINT_CLAIM: JSON.stringify({
      parentRunId: "42",
      requestArtifactId: 10,
      requestSha256: issued.sha256,
    }),
    M1_PUBLIC_PROOF: JSON.stringify(proof),
    GITHUB_ENV: path.join(root, "env"),
  };
  const event = {
    repository: { full_name: REPO },
    ref: "refs/heads/main",
    inputs: {
      checkpoint_claim: envProof.CHECKPOINT_CLAIM,
      m1_public_proof: envProof.M1_PUBLIC_PROOF,
    },
  };
  const data = new Map([
    [`/repos/${REPO}/commits/main`, { sha: CONTROL }],
    [
      `/repos/${REPO}/environments/failover-sync`,
      {
        name: "failover-sync",
        can_admins_bypass: false,
        deployment_branch_policy: { custom_branch_policies: true },
        protection_rules: [
          {
            type: "required_reviewers",
            reviewers: [{ type: "User", reviewer: principal }],
          },
        ],
      },
    ],
    [
      `/repos/${REPO}/environments/failover-sync/deployment-branch-policies`,
      { branch_policies: [{ name: "main", type: "branch" }] },
    ],
    [`/repos/${REPO}/actions/runs/42`, run("42")],
    [`/repos/${REPO}/actions/runs/99`, run("99", true)],
    [`/repos/${REPO}/actions/artifacts/10`, requestArtifact],
    [`/repos/${REPO}/actions/artifacts/11`, proofArtifact],
    [
      `/repos/${REPO}/actions/workflows/jekyll-gh-pages.yml`,
      { state: "disabled_manually" },
    ],
    [
      `/repos/${REPO}/actions/artifacts?per_page=100&page=1`,
      { artifacts: [requestArtifact, proofArtifact] },
    ],
  ]);
  const read = async (ep) => {
    if (!data.has(ep)) throw new Error("Unconfigured mock read");
    return structuredClone(data.get(ep));
  };
  return {
    root,
    packageRoot,
    meta,
    now,
    context,
    issued,
    requestArtifact,
    proof,
    record,
    proofArtifact,
    fetcher,
    calls,
    envProof,
    event,
    data,
    read,
  };
}

test("M1 helper actually verifies every bound public file with ordinary TLS request options", async (t) => {
  const f = await fixture(t);
  assert.equal(f.calls.length, f.meta.previousFiles.length);
  assert.equal(f.proof.fileCount, f.calls.length);
  assert.equal(f.proof.requestSha256, f.issued.sha256);
  assert.equal(f.proof.verification.artifactRelease, f.meta.release);
  for (const { options } of f.calls)
    assert.deepEqual(Object.keys(options).sort(), [
      "headers",
      "redirect",
      "signal",
    ]);
  for (const fetcher of [
    async () =>
      new Response("challenge", { headers: { "cf-mitigated": "challenge" } }),
    async () =>
      new Response("corrupt", { headers: { "content-type": "text/html" } }),
    async () => {
      throw Object.assign(new Error(), { code: "CERT_HAS_EXPIRED" });
    },
  ])
    await assert.rejects(
      verifyOnM1({
        requestBytes: f.issued.bytes,
        packageRoot: f.packageRoot,
        requestArtifact: f.requestArtifact,
        fetcher,
        machine,
        now: () => f.now,
      }),
    );
  for (const bad of [
    { ...machine, hostname: "other" },
    { ...machine, platform: "linux" },
    { ...machine, arch: "x64" },
  ])
    await assert.rejects(
      verifyOnM1({
        requestBytes: f.issued.bytes,
        packageRoot: f.packageRoot,
        requestArtifact: f.requestArtifact,
        fetcher: f.fetcher,
        machine: bad,
        now: () => f.now,
      }),
    );
});

test("proof schema rejects forged success flags, wrong phase/run/nonce/source/marker/artifact and incomplete observations", async (t) => {
  const f = await fixture(t),
    r = f.issued.request;
  const mutations = [
    { success: true },
    { parentRunId: "43" },
    { parentAttempt: 2 },
    { phase: "final" },
    { nonce: "f".repeat(36) },
    { sourceCommit: "b".repeat(40) },
    { workflowCommit: "b".repeat(40) },
    { release: "b".repeat(64) },
    { manifestSha256: "b".repeat(64) },
    { fileCount: 1 },
    { requirePrimaryMarker: true },
    { requestArtifactId: 12 },
    { requestArtifactDigest: "sha256:" + "e".repeat(64) },
    { verification: { ...f.proof.verification, verifiedFiles: 0 } },
    {
      verification: {
        ...f.proof.verification,
        origin: "https://evil.invalid/",
      },
    },
    { verification: { ...f.proof.verification, policy: "ignored" } },
    { startedAt: f.now - 60000 },
    { completedAt: f.now + 60000 },
  ];
  for (const m of mutations)
    assert.throws(() =>
      validateProof({ ...f.proof, ...m }, r, f.issued.sha256, {
        now: f.now,
        requestArtifact: f.requestArtifact,
      }),
    );
  assert.throws(() =>
    validateProof({ success: true }, r, f.issued.sha256, {
      now: f.now,
      requestArtifact: f.requestArtifact,
    }),
  );
  assert.throws(() =>
    validateProof(f.proof, r, f.issued.sha256, {
      now: f.now + CHECKPOINT.freshMs + 1,
      requestArtifact: f.requestArtifact,
    }),
  );
  assert.throws(() =>
    validateRequest({ ...r, expiresAt: f.now - 1 }, { now: f.now }),
  );
  assert.throws(() =>
    createRequest({
      context: f.context,
      metadata: f.meta,
      entries: f.meta.files,
      phase: "baseline",
      admissionObservedAt: f.now,
      now: f.now,
    }),
  );
});

test("official proof artifact, exact successful owner workflow and protected environment authenticate payloads", async (t) => {
  const f = await fixture(t),
    args = {
      read: f.read,
      record: f.record,
      recordSha256: hash(JSON.stringify(f.record) + "\n"),
      request: f.issued.request,
      requestDigest: f.issued.sha256,
      reply: { id: 11, digest: f.proofArtifact.digest.slice(7) },
      now: f.now,
    };
  assert.equal((await authenticateRecord(args)).id, 10);
  await assert.rejects(
    authenticateRecord({ ...args, recordSha256: "f".repeat(64) }),
    /provenance/,
  );
  const ep = `/repos/${REPO}/actions/runs/99`;
  for (const change of [
    { actor: { login: "intruder", id: 1 } },
    { triggering_actor: { login: "intruder", id: 1 } },
    { head_sha: "b".repeat(40) },
    { head_branch: "other" },
    { run_attempt: 2 },
    { event: "pull_request" },
    { conclusion: "failure" },
    { path: ".github/workflows/other.yml" },
  ]) {
    f.data.set(ep, { ...run("99", true), ...change });
    await assert.rejects(authenticateRecord(args));
  }
  f.data.set(ep, run("99", true));
  const ae = `/repos/${REPO}/actions/artifacts/11`;
  for (const change of [
    { expired: true },
    { digest: "sha256:" + "f".repeat(64) },
    { name: "other" },
    { size_in_bytes: 1e8 },
    { workflow_run: { id: 1, head_sha: CONTROL, head_branch: "main" } },
  ]) {
    f.data.set(ae, { ...f.proofArtifact, ...change });
    await assert.rejects(authenticateRecord(args));
  }
  f.data.set(ae, f.proofArtifact);
  const protect = `/repos/${REPO}/environments/failover-sync`,
    original = f.data.get(protect);
  f.data.set(protect, { ...original, can_admins_bypass: true });
  await assert.rejects(authenticateRecord(args));
});

test("protected proof workflow revalidates request/readback and refuses duplicate proof upload", async (t) => {
  const f = await fixture(t),
    root = path.join(f.root, "child"),
    dir = path.join(root, "request");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "request.json"), f.issued.bytes);
  const list = `/repos/${REPO}/actions/artifacts?per_page=100&page=1`;
  f.data.set(list, { artifacts: [f.requestArtifact] });
  const record = await writeProtectedProof({
    root,
    env: f.envProof,
    event: f.event,
    read: f.read,
  });
  assert.deepEqual(record.proof, f.proof);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(root, "record/proof.json"))),
    record,
  );
  for (const change of [
    { GITHUB_ACTOR: "other" },
    { GITHUB_RUN_ATTEMPT: "2" },
    { GITHUB_REF: "refs/pull/1/merge" },
    { GITHUB_WORKFLOW_REF: `${REPO}/wrong.yml@refs/heads/main` },
    { M1_PUBLIC_PROOF: "{}" },
  ])
    await assert.rejects(
      proofWorkflowGuard({ ...f.envProof, ...change }, f.event, f.read),
    );
  f.data.set(list, { artifacts: [f.requestArtifact, f.proofArtifact] });
  await assert.rejects(
    writeProtectedProof({
      root,
      env: f.envProof,
      event: f.event,
      read: f.read,
    }),
    /already published/,
  );
});

test("proof polling waits for successful provenance, rejects duplicates and expires without a guessed success", async (t) => {
  const f = await fixture(t),
    root = path.join(f.root, "poll"),
    dir = path.join(root, "checkpoints/baseline");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "request.json"), f.issued.bytes);
  const env = {
    GITHUB_RUN_ID: "42",
    GITHUB_SHA: CONTROL,
    GITHUB_ENV: path.join(root, "env"),
  };
  const result = await waitForProof({
    root,
    phase: "baseline",
    read: f.read,
    env,
    now: () => f.now,
  });
  assert.equal(result.id, 11);
  const list = `/repos/${REPO}/actions/artifacts?per_page=100&page=1`;
  f.data.set(list, {
    artifacts: [f.proofArtifact, { ...f.proofArtifact, id: 12 }],
  });
  await assert.rejects(
    waitForProof({
      root,
      phase: "baseline",
      read: f.read,
      env,
      now: () => f.now,
    }),
    /Duplicate/,
  );
  f.data.set(list, { artifacts: [] });
  let clock = f.now;
  await assert.rejects(
    waitForProof({
      root,
      phase: "baseline",
      read: f.read,
      env,
      now: () => clock,
      sleep: async () => {
        clock += CHECKPOINT.waitMs;
      },
    }),
    /timed out/,
  );
});

test("actual IPC gate waits for M1 checked artifact, authenticates and durably consumes phase once", async (t) => {
  const f = await fixture(t),
    root = path.join(f.root, "gate"),
    bridge = actionBridge(root, {
      timeoutMs: 1000,
      publicTimeoutMs: 1000,
      pollMs: 1,
    });
  const gate = await createM1Gate({
    root,
    packageRoot: f.packageRoot,
    context: f.context,
    metadata: f.meta,
    requirePrimaryMarker: false,
    bridge,
    beforeWrite: async () => ({ observedAt: f.now }),
    now: () => f.now,
    authenticateProof: async ({ record, request, requestDigest, reply }) => {
      assert.equal(record.proof.requestSha256, requestDigest);
      assert.equal(reply.id, 11);
      return {
        ...f.requestArtifact,
        name: requestName(request.parentRunId, request.phase),
      };
    },
  });
  const promise = gate(f.meta.previousFiles, "baseline");
  await bridge.waitRequest("public-baseline");
  const bytes = await readFile(
    path.join(root, "checkpoints/baseline/request.json"),
  );
  const checked = await verifyOnM1({
    requestBytes: bytes,
    packageRoot: f.packageRoot,
    requestArtifact: f.requestArtifact,
    fetcher: f.fetcher,
    machine,
    now: () => f.now,
  });
  await mkdir(path.join(root, "proofs/baseline"), { recursive: true });
  await writeFile(
    path.join(root, "proofs/baseline/proof.json"),
    JSON.stringify({ ...f.record, proof: checked }),
  );
  await bridge.reply("public-baseline", {
    id: 11,
    digest: f.proofArtifact.digest.slice(7),
  });
  assert.equal((await promise).checkpoint.phase, "baseline");
  assert.equal(
    JSON.parse(await readFile(path.join(root, "public-baseline.consumed.json")))
      .artifactId,
    11,
  );
  await assert.rejects(gate(f.meta.previousFiles, "baseline"), /no replay/);
});

test("missing/unauthenticated M1 gate fails closed without a next publication action", async (t) => {
  const f = await fixture(t);
  let continued = false;
  const gate = await createM1Gate({
    root: path.join(f.root, "missing"),
    packageRoot: f.packageRoot,
    context: f.context,
    metadata: f.meta,
    requirePrimaryMarker: false,
    bridge: {
      request: async () => {
        throw new Error("checkpoint timed out");
      },
    },
    beforeWrite: async () => ({ observedAt: f.now }),
    authenticateProof: async () => {
      throw new Error("untrusted");
    },
    now: () => f.now,
  });
  await assert.rejects(
    (async () => {
      await gate(f.meta.previousFiles, "baseline");
      continued = true;
    })(),
  );
  assert.equal(continued, false);
});

test("bootstrap preserves stage/recovery/final ordering while every public phase waits for authenticated M1 evidence", async (t) => {
  const f = await fixture(t),
    root = path.join(f.root, "coordinator"),
    bridge = actionBridge(root, {
      timeoutMs: 2000,
      publicTimeoutMs: 2000,
      pollMs: 1,
    });
  let served = "stage";
  const calls = [];
  const fetcher = async (url) =>
    new Response(
      await readFile(
        path.join(f.packageRoot, served, new URL(url).pathname.slice(1)),
      ),
      {
        headers: {
          "content-type": String(url).endsWith(".html")
            ? "text/html"
            : "text/css",
        },
      },
    );
  const gate = await createM1Gate({
    root,
    packageRoot: f.packageRoot,
    context: f.context,
    metadata: f.meta,
    requirePrimaryMarker: false,
    bridge,
    beforeWrite: async () => ({ observedAt: f.now }),
    now: () => f.now,
    authenticateProof: (args) =>
      authenticateRecord({ ...args, read: f.read, now: f.now }),
  });
  const receipt = await createRecoveryReceipt({
    packageRoot: f.packageRoot,
    origin: A,
    bootstrapOrigin: OLD,
    sourceCommit: SOURCE,
    workflowCommit: CONTROL,
    workflowRunId: "42",
    fetcher: fileFetcher({
      [A]: path.join(f.packageRoot, "public"),
      [OLD]: path.join(f.packageRoot, "stage"),
    }),
  });
  const task = coordinateBootstrap(f.packageRoot, {
    assertBootstrapCurrent: async () => {
      await gate(f.meta.sourceFiles, "baseline");
      calls.push("baseline-verified");
    },
    publishAssetStage: async () => {
      calls.push("stage-write");
    },
    verifyAssetStage: async () => {
      await gate(f.meta.stageFiles, "stage");
      calls.push("stage-verified");
    },
    publishBackup: async () => {
      calls.push("backup-reused");
      return A;
    },
    verifyBackup: async () => {},
    recordRecovery: async () => {
      calls.push("recovery-durable");
      return archiveProof(receipt);
    },
    publishPrimary: async () => {
      served = "public";
      calls.push("final-write");
    },
    verifyPairedRelease: async () => {
      await gate(f.meta.files, "final");
      calls.push("final-verified");
    },
  });
  for (const [index, phase] of ["baseline", "stage", "final"].entries()) {
    await bridge.waitRequest("public-" + phase);
    if (phase === "baseline") assert.deepEqual(calls, []);
    if (phase === "stage")
      assert.deepEqual(calls, ["baseline-verified", "stage-write"]);
    if (phase === "final")
      assert.deepEqual(calls, [
        "baseline-verified",
        "stage-write",
        "stage-verified",
        "backup-reused",
        "recovery-durable",
        "final-write",
      ]);
    const bytes = await readFile(
        path.join(root, "checkpoints", phase, "request.json"),
      ),
      request = JSON.parse(bytes),
      requestId = 20 + index * 2,
      proofId = requestId + 1,
      childRun = String(100 + index);
    const req = artifact(requestId, "42", requestName("42", phase), f.now),
      checked = await verifyOnM1({
        requestBytes: bytes,
        packageRoot: f.packageRoot,
        requestArtifact: req,
        fetcher,
        machine,
        now: () => f.now,
      });
    const record = {
        schema: "jji-protected-m1-proof-1",
        proofRunId: childRun,
        requestArtifactId: requestId,
        requestArtifactDigest: req.digest,
        proof: checked,
      },
      recordBytes = Buffer.from(JSON.stringify(record) + "\n");
    f.data.set(`/repos/${REPO}/actions/artifacts/${requestId}`, req);
    f.data.set(
      `/repos/${REPO}/actions/artifacts/${proofId}`,
      artifact(
        proofId,
        childRun,
        proofName(request) + "-" + hash(recordBytes),
        f.now,
      ),
    );
    f.data.set(`/repos/${REPO}/actions/runs/${childRun}`, run(childRun, true));
    await mkdir(path.join(root, "proofs", phase), { recursive: true });
    await writeFile(
      path.join(root, "proofs", phase, "proof.json"),
      recordBytes,
    );
    await bridge.reply("public-" + phase, {
      id: proofId,
      digest: "d".repeat(64),
    });
  }
  await task;
  assert.equal(calls.at(-1), "final-verified");
});

test("a failed public-stage checkpoint preserves the known stage and prevents recovery/pointer/final writes", async (t) => {
  const f = await fixture(t),
    calls = [];
  await assert.rejects(
    coordinateBootstrap(f.packageRoot, {
      assertBootstrapCurrent: async () => {},
      publishAssetStage: async () => calls.push("stage-write"),
      verifyAssetStage: async () => {
        throw new Error("M1 stage proof missing");
      },
      publishBackup: async () => calls.push("backup-write"),
      verifyBackup: async () => {},
      recordRecovery: async () => calls.push("receipt-write"),
      publishPrimary: async () => calls.push("final-write"),
      verifyPairedRelease: async () => {},
    }),
    /M1 stage proof missing/,
  );
  assert.deepEqual(calls, ["stage-write"]);
});

test("checkpoint retention cap includes requests/proofs and stops without deleting recovery artifacts", () => {
  const item = {
    name: "paired-checkpoint-42-baseline",
    expired: false,
    size_in_bytes: 100,
  };
  assert.equal(assertCheckpointArtifactBudget([item]).retained, 1);
  assert.throws(
    () => assertCheckpointArtifactBudget(Array(24).fill(item)),
    /no pruning/,
  );
  assert.throws(() =>
    assertCheckpointArtifactBudget([{ ...item, size_in_bytes: 1e8 }]),
  );
  assert.equal(
    assertCheckpointArtifactBudget([
      { name: "paired-release-receipt", expired: false, size_in_bytes: 100 },
    ]).retained,
    0,
  );
});

test("workflow keeps checkpoint transport live outside pages lock and never grants proof workflow publishing credentials", async () => {
  const parent = await readFile(
      new URL("../../.github/workflows/paired-release.yml", import.meta.url),
      "utf8",
    ),
    child = await readFile(
      new URL(
        "../../.github/workflows/paired-public-proof.yml",
        import.meta.url,
      ),
      "utf8",
    );
  assert.match(child, /group: m1-public-proof/);
  assert.doesNotMatch(
    child,
    /pages: write|id-token: write|secrets\.|pull_request:|push:/,
  );
  assert.match(child, /environment: failover-sync/);
  assert.match(child, /github.actor == 'JustinJIndustries'/);
  for (const phase of ["baseline", "stage", "final"]) {
    assert.match(parent, new RegExp(`PUBLIC_PHASE: ${phase}`));
    assert.match(parent, new RegExp(`jji-paired/checkpoints/${phase}/`));
    assert.match(parent, new RegExp(`jji-paired/proofs/${phase}`));
  }
  const cli = await readFile(
    new URL("../../infrastructure/failover/paired-ci.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(cli, /createPublicArtifactVerifier/);
  assert.match(cli, /verifyPrimary\(baseline, "baseline"\)/);
});
