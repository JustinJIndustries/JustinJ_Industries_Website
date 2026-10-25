import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import {
  APPROVED_WORKER_SOURCE,
  APPROVED_WORKER_SETTINGS_SHA256,
  inspectDashboardReleaseCurrent,
  validateWorkerRequest,
  validateWorkerProof,
  createWorkerDashboardGate,
  manualWorkerProvider,
} from "../../infrastructure/failover/manual-worker-checkpoint.mjs";
import {
  captureWorkerState,
  assertLocalControlClean,
} from "../../infrastructure/failover/owner-worker-readback.mjs";
import {
  validateRequest,
  validateProof,
  requestName,
  proofName,
  assertCheckpointReleaseBudget,
} from "../../infrastructure/failover/public-checkpoint.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex"),
  same = (v) => structuredClone(v);
const old = "11111111-1111-4111-8111-111111111111",
  version = "22222222-2222-4222-8222-222222222222",
  newId = "33333333-3333-4333-8333-333333333333",
  newVersion = "44444444-4444-4444-8444-444444444444";
const source = readFileSync(
  new URL("../../infrastructure/failover/worker.mjs", import.meta.url),
  "utf8",
);
const config = {
  origin: "https://aaaaaaaa.jji-backup-20261023.pages.dev/",
  current: "a".repeat(64),
  retained: [],
};
const next = {
  origin: "https://bbbbbbbb.jji-backup-20261023.pages.dev/",
  current: "b".repeat(64),
  retained: [config.current],
};
function fixture(phase = "workerbaseline") {
  const now = Date.now(),
    r = {
      schema: "jji-manual-worker-request-1",
      repository: "JustinJIndustries/JustinJ_Industries_Website",
      parentRunId: "42",
      parentAttempt: 1,
      workflowCommit: "c".repeat(40),
      sourceCommit: "d".repeat(40),
      release: "b".repeat(64),
      phase,
      nonce: "55555555-5555-4555-8555-555555555555",
      issuedAt: now,
      expiresAt: now + 480000,
      admissionObservedAt: now,
      account: "986b5334eba2d05d253ee98ca9842dfe",
      script: "jji-failover",
      sourceSha256: hash(source),
      sourceVersion: APPROVED_WORKER_SOURCE.version,
      sourceEtag: APPROVED_WORKER_SOURCE.etag,
      expectedDeployment: old,
      expectedVersion: version,
      beforeConfig: config,
      config: phase === "workerpromote" ? next : config,
    };
  const artifact = { id: 1, digest: "sha256:" + "e".repeat(64) };
  const state = {
    account: r.account,
    script: r.script,
    deployment: old,
    version,
    percentage: 100,
    sourceSha256: r.sourceSha256,
    sourceVersion: r.sourceVersion,
    sourceEtag: r.sourceEtag,
    settingsSha256: APPROVED_WORKER_SETTINGS_SHA256,
    config,
    observedAt: now + 10,
    evidenceSha256: "f".repeat(64),
  };
  const after =
    phase === "workerpromote"
      ? {
          ...state,
          deployment: newId,
          version: newVersion,
          config: next,
          observedAt: now + 20,
        }
      : { ...state, observedAt: now + 20 };
  const p = {
    schema: "jji-manual-worker-proof-1",
    requestSha256: hash(JSON.stringify(r) + "\n"),
    requestArtifactId: 1,
    requestArtifactDigest: artifact.digest,
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
      ].map((k) => [k, r[k]]),
    ),
    machine: {
      platform: "darwin",
      arch: "arm64",
      hostname: "M1-Max-MacBook-Pro",
    },
    startedAt: now,
    before: state,
    after,
    completedAt: now + 30,
  };
  return { r, p, artifact, now: now + 40 };
}
test("dashboard requests/proofs use existing protected protocol with exact names and bounded bytes", () => {
  for (const phase of ["workerbaseline", "workerpromote", "workerfinal"]) {
    const f = fixture(phase);
    assert.equal(validateRequest(f.r, { now: f.now }), f.r);
    assert.equal(
      validateProof(f.p, f.r, f.p.requestSha256, {
        now: f.now,
        requestArtifact: f.artifact,
      }),
      f.p,
    );
    assert.match(requestName("42", phase), new RegExp(phase + "$"));
    assert.match(proofName(f.r), new RegExp(phase));
    assert.ok(JSON.stringify(f.r).length < 256 * 1024);
    assert.ok(JSON.stringify(f.p).length < 16384);
  }
});
test("rejects missing/partial version, wrong source, account, origin, binding or split traffic", () => {
  const f = fixture();
  for (const change of [
    (p) => delete p.after.version,
    (p) => (p.after.version = "22222222"),
    (p) => (p.after.sourceSha256 = "0".repeat(64)),
    (p) => (p.after.account = "0".repeat(32)),
    (p) =>
      (p.after.config = { ...config, origin: "https://attacker.example/" }),
    (p) => (p.after.percentage = 50),
    (p) => (p.after.extra = "unreviewed"),
  ]) {
    const p = same(f.p);
    change(p);
    assert.throws(() =>
      validateWorkerProof(p, f.r, f.p.requestSha256, {
        now: f.now,
        requestArtifact: f.artifact,
      }),
    );
  }
});
test("rejects stale, future, reused-source/run/nonce and request artifact mismatches", () => {
  const f = fixture();
  for (const change of [
    (p) => (p.completedAt = f.now - 180001),
    (p) => (p.completedAt = f.now + 30001),
    (p) => (p.startedAt = f.r.issuedAt - 30001),
    (p) => (p.sourceCommit = "0".repeat(40)),
    (p) => (p.parentRunId = "43"),
    (p) => (p.nonce = old),
    (p) => (p.requestArtifactId = 2),
    (p) => (p.requestSha256 = "0".repeat(64)),
  ]) {
    const p = same(f.p);
    change(p);
    assert.throws(() =>
      validateWorkerProof(p, f.r, f.p.requestSha256, {
        now: f.now,
        requestArtifact: f.artifact,
      }),
    );
  }
  assert.throws(() => validateWorkerRequest(f.r, { now: f.r.expiresAt + 1 }));
});
test("promotion needs exact prior pointer and a genuinely changed deployed version/config", () => {
  const f = fixture("workerpromote");
  for (const change of [
    (p) => (p.before.deployment = newId),
    (p) => (p.before.config = next),
    (p) => (p.after.deployment = old),
    (p) => (p.after.version = version),
    (p) => (p.after.config = config),
  ]) {
    const p = same(f.p);
    change(p);
    assert.throws(() =>
      validateWorkerProof(p, f.r, f.p.requestSha256, {
        now: f.now,
        requestArtifact: f.artifact,
      }),
    );
  }
  const read = fixture("workerfinal");
  read.p.after.version = newVersion;
  assert.throws(() =>
    validateWorkerProof(read.p, read.r, read.p.requestSha256, {
      now: read.now,
      requestArtifact: read.artifact,
    }),
  );
});
test("provider uses three protected handoffs, preserves exact order and refuses unreviewed code", async () => {
  const f = fixture();
  let now = f.now;
  const calls = [];
  const states = {
    workerbaseline: f.p.before,
    workerpromote: {
      ...f.p.after,
      deployment: newId,
      version: newVersion,
      config: next,
    },
    workerfinal: {
      ...f.p.after,
      deployment: newId,
      version: newVersion,
      config: next,
    },
  };
  const p = manualWorkerProvider({
    gate: async (phase, e) => {
      calls.push({ phase, e });
      return same(states[phase]);
    },
    baselineConfig: config,
    expectedDeployment: old,
    now: () => now,
  });
  assert.deepEqual(await p.currentWorkerDeployment(), { id: old, version });
  assert.deepEqual(await p.currentWorkerConfiguration(), config);
  await assert.rejects(
    p.uploadWorkerVersion({ code: "different", config: next }),
  );
  assert.equal(
    (await p.uploadWorkerVersion({ code: source, config: next })).version,
    newVersion,
  );
  await assert.rejects(
    p.promoteWorker({ version: newVersion, expectedDeployment: newId }),
  );
  assert.equal(
    (await p.promoteWorker({ version: newVersion, expectedDeployment: old }))
      .id,
    newId,
  );
  assert.equal((await p.currentWorkerDeployment()).id, newId);
  assert.deepEqual(
    calls.map((c) => c.phase),
    ["workerbaseline", "workerpromote", "workerfinal"],
  );
  assert.deepEqual(calls[1].e.beforeConfig, config);
  assert.deepEqual(calls[1].e.config, next);
  now += 180001;
  await assert.rejects(p.currentWorkerDeployment(), /expired/);
  await assert.rejects(p.uploadWorkerVersion({ code: source, config: next }));
});
test("failed dashboard readback cannot authorize promotion or invent deployment IDs", async () => {
  const p = manualWorkerProvider({
    gate: async () => {
      throw Error("readback failed");
    },
    baselineConfig: config,
    expectedDeployment: old,
  });
  await assert.rejects(p.currentWorkerDeployment(), /failed/);
  await assert.rejects(p.currentWorkerConfiguration());
  await assert.rejects(
    p.promoteWorker({ version: newVersion, expectedDeployment: old }),
  );
  assert.throws(() =>
    manualWorkerProvider({
      gate: () => {},
      baselineConfig: config,
      expectedDeployment: "1f8cfb35",
    }),
  );
});
function nativeFixture(f) {
  const bindings = [
    {
      name: "RELEASE_CONFIG",
      type: "plain_text",
      text: JSON.stringify(config),
    },
  ];
  const settings = {
    success: true,
    result: {
      ...JSON.parse(
        readFileSync(
          new URL("./fixtures/approved-worker-settings.json", import.meta.url),
          "utf8",
        ),
      ),
      bindings,
    },
  };
  return {
    settings,
    runNative: async (command) =>
      Buffer.from(
        JSON.stringify(
          command === "settings"
            ? settings
            : command.startsWith("version:")
              ? {
                  success: true,
                  result: {
                    id: command.slice(8),
                    resources: {
                      bindings,
                      script: {
                        etag: APPROVED_WORKER_SOURCE.etag,
                        handlers: ["fetch"],
                        named_handlers: [],
                      },
                      script_runtime: {
                        compatibility_date: "2026-10-24",
                        usage_model: "standard",
                      },
                    },
                  },
                }
              : {
                  success: true,
                  result: {
                    deployments: [
                      {
                        id: old,
                        versions: [{ version_id: version, percentage: 100 }],
                      },
                    ],
                  },
                },
        ),
      ),
  };
}
test("actual capture adapter compares independent pre/post deployment reads and full source/settings", async () => {
  const f = fixture();
  const n = nativeFixture(f);
  const s = await captureWorkerState({
    request: f.r,
    runNative: n.runNative,
    now: () => f.now,
  });
  assert.equal(s.deployment, old);
  assert.equal(s.version, version);
  assert.equal(s.sourceSha256, hash(source));
  assert.deepEqual(s.config, config);
  assert.match(s.evidenceSha256, /^[a-f0-9]{64}$/);
});
test("capture rejects access denial, changing deployments, code corruption and unreviewed settings", async () => {
  const f = fixture();
  for (const mode of [
    "denied",
    "changed",
    "etag",
    "logging",
    "secret",
    "split",
  ]) {
    let count = 0;
    const n = nativeFixture(f);
    const runNative = async (cmd) => {
      if (cmd === "code") return Buffer.from(mode === "code" ? "bad" : source);
      const value = JSON.parse(await n.runNative(cmd));
      if (mode === "etag" && cmd.startsWith("version:"))
        value.result.resources.script.etag = "0".repeat(64);
      if (mode === "denied") value.success = false;
      if (cmd === "settings") {
        if (mode === "logging") value.result.observability.logs.enabled = true;
        if (mode === "secret")
          value.result.bindings.push({
            name: "unapproved",
            type: "secret_text",
          });
      }
      if (cmd === "deployments") {
        count++;
        if (mode === "changed" && count === 2)
          value.result.deployments[0].id = newId;
        if (mode === "split")
          value.result.deployments[0].versions[0].percentage = 50;
      }
      return Buffer.from(JSON.stringify(value));
    };
    await assert.rejects(
      captureWorkerState({ request: f.r, runNative, now: () => f.now }),
      mode,
    );
  }
});
test("gate authenticates exact proof, consumes nonce once and rejects corrupted readback", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-worker-gate-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const f = fixture();
  const gate = await createWorkerDashboardGate({
    root,
    context: {
      runId: "42",
      sha: f.r.workflowCommit,
      sourceCommit: f.r.sourceCommit,
    },
    metadata: { release: f.r.release },
    sourceSha256: f.r.sourceSha256,
    now: () => f.r.issuedAt,
    beforeWrite: async () => ({ observedAt: f.r.admissionObservedAt }),
    bridge: {
      request: async () => {
        const r = JSON.parse(
          await readFile(
            path.join(root, "checkpoints/workerbaseline/request.json"),
          ),
        );
        const p = {
          ...f.p,
          nonce: r.nonce,
          requestSha256: hash(JSON.stringify(r) + "\n"),
          startedAt: r.issuedAt,
          completedAt: r.issuedAt,
          before: { ...f.p.before, observedAt: r.issuedAt },
          after: { ...f.p.after, observedAt: r.issuedAt },
        };
        await mkdir(path.join(root, "proofs/workerbaseline"), {
          recursive: true,
        });
        await writeFile(
          path.join(root, "proofs/workerbaseline/proof.json"),
          JSON.stringify({ proof: p, proofRunId: "43" }),
        );
        return { id: 2, digest: "e".repeat(64) };
      },
    },
    authenticateProof: async () => f.artifact,
  });
  const state = await gate("workerbaseline", {
    expectedDeployment: old,
    expectedVersion: version,
    beforeConfig: config,
    config,
  });
  assert.equal(state.deployment, old);
  assert.ok(await readFile(path.join(root, "workerbaseline.consumed.json")));
  await assert.rejects(gate("workerbaseline", {}), /already attempted/);
});
test("manual transport retains protected proof and does not request any Worker token", async () => {
  const w = await readFile(
    new URL("../../.github/workflows/paired-release.yml", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(w, /secrets\.CLOUDFLARE_WORKER_TOKEN/);
  for (const p of ["workerbaseline", "workerpromote", "workerfinal"])
    assert.match(w, new RegExp("PUBLIC_PHASE: " + p));
  const coordinator = await readFile(
    new URL(
      "../../infrastructure/failover/coordinate-release.mjs",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(
    coordinator.indexOf("recordRecovery(release") <
      coordinator.indexOf("promoteFallback({"),
  );
  assert.ok(
    coordinator.indexOf("promoteFallback({") <
      coordinator.indexOf("publishPrimary(packageRoot"),
  );
  const swift = await readFile(
    new URL(
      "../../infrastructure/failover/native-worker-read.swift",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(
    swift,
    /NSPasteboard|document\.cookie|fetch\(|URLSession|http:\/\/|Save and Deploy/,
  );
});

test("long CI/archive waits request new phase readbacks instead of trusting expired observations", async () => {
  const f = fixture();
  let now = f.now;
  const seen = [];
  const p = manualWorkerProvider({
    gate: async (phase) => {
      seen.push(phase);
      return {
        ...f.p.before,
        observedAt: now,
        ...(phase === "workerbaseline"
          ? {}
          : { deployment: newId, version: newVersion, config: next }),
      };
    },
    baselineConfig: config,
    expectedDeployment: old,
    now: () => now,
  });
  await p.currentWorkerDeployment();
  now += 240000;
  await p.uploadWorkerVersion({ code: source, config: next });
  await p.promoteWorker({ version: newVersion, expectedDeployment: old });
  now += 240000;
  assert.equal((await p.currentWorkerDeployment()).id, newId);
  assert.deepEqual(seen, ["workerbaseline", "workerpromote", "workerfinal"]);
  const stale = fixture();
  stale.p.completedAt = stale.now - 180001;
  assert.throws(() =>
    validateWorkerProof(stale.p, stale.r, stale.p.requestSha256, {
      now: stale.now,
      requestArtifact: stale.artifact,
    }),
  );
});

test("failed final readback is latched: repeated reads never return cached success", async () => {
  const f = fixture();
  let finalCalls = 0;
  const p = manualWorkerProvider({
    gate: async (phase) => {
      if (phase === "workerfinal") {
        finalCalls++;
        throw Error("bad final proof");
      }
      return {
        ...f.p.before,
        ...(phase === "workerpromote"
          ? { deployment: newId, version: newVersion, config: next }
          : {}),
      };
    },
    baselineConfig: config,
    expectedDeployment: old,
    now: () => f.now,
  });
  await p.currentWorkerDeployment();
  await p.uploadWorkerVersion({ code: source, config: next });
  await p.promoteWorker({ version: newVersion, expectedDeployment: old });
  await assert.rejects(p.currentWorkerDeployment(), /bad final proof/);
  await assert.rejects(
    p.currentWorkerDeployment(),
    /Prior dashboard checkpoint failed/,
  );
  await assert.rejects(
    p.currentWorkerConfiguration(),
    /Prior dashboard checkpoint failed/,
  );
  assert.equal(finalCalls, 1);
});

test("dirty tracked and untracked control/native/workflow files are rejected from nested helper cwd", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-control-clean-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const nested = path.join(root, "infrastructure/failover");
  await mkdir(nested, { recursive: true });
  await mkdir(path.join(root, ".github/workflows"), { recursive: true });
  await writeFile(path.join(nested, "control.mjs"), "approved");
  await writeFile(path.join(root, ".github/workflows/publish.yml"), "approved");
  const git = (args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git(["init", "-q"]);
  git(["add", "."]);
  git([
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "fixture",
  ]);
  assert.match(assertLocalControlClean(nested), /^[a-f0-9]{40}$/);
  await writeFile(path.join(nested, "control.mjs"), "changed");
  assert.throws(() => assertLocalControlClean(nested));
  await writeFile(path.join(nested, "control.mjs"), "approved");
  await writeFile(path.join(nested, "native.swift"), "untracked");
  assert.throws(() => assertLocalControlClean(nested), /Untracked/);
  await rm(path.join(nested, "native.swift"));
  await writeFile(path.join(root, ".github/workflows/publish.yml"), "changed");
  assert.throws(() => assertLocalControlClean(nested));
});

test("current immutable version, opaque script identity, bindings and runtime must all match approved lineage", async () => {
  const f = fixture();
  for (const kind of ["immutable-id", "runtime", "bindings", "baseline-etag"]) {
    const n = nativeFixture(f);
    const runNative = async (command) => {
      const v = JSON.parse(await n.runNative(command));
      if (command === "version:" + version) {
        if (kind === "immutable-id") v.result.id = newVersion;
        if (kind === "runtime")
          v.result.resources.script_runtime.compatibility_date = "2020-01-01";
        if (kind === "bindings") v.result.resources.bindings = [];
      }
      if (
        command === "version:" + f.r.sourceVersion &&
        kind === "baseline-etag"
      )
        v.result.resources.script.etag = "0".repeat(64);
      return Buffer.from(JSON.stringify(v));
    };
    await assert.rejects(
      captureWorkerState({ request: f.r, runNative, now: () => f.now }),
      kind,
    );
  }
});

test("public-baseline wait happens before the fresh Worker baseline snapshot and stage admission", async () => {
  const f = fixture();
  let now = f.now;
  const order = [];
  const p = manualWorkerProvider({
    gate: async (phase) => {
      order.push(phase);
      return { ...f.p.before, observedAt: now };
    },
    baselineConfig: config,
    expectedDeployment: old,
    now: () => now,
  });
  const observed = await inspectDashboardReleaseCurrent({
    verifyPrimary: async () => {
      order.push("public-baseline");
      now += 240000;
    },
    baseline: [],
    metadata: { previousFiles: [], previousRelease: config.current },
    provider: p,
    expectedDeployment: old,
  });
  assert.equal(observed.pointerCurrent, config.current);
  assert.equal((await p.currentWorkerDeployment()).id, old);
  assert.deepEqual(order, ["public-baseline", "workerbaseline"]);
});

test("complete prepare-plus-promotion capacity is reserved before a write, with no pruning or cap increase", () => {
  const items = (n) =>
    Array.from({ length: n }, (_, i) => ({
      expired: false,
      name: "paired-checkpoint-" + i,
      size_in_bytes: 1000,
    }));
  assert.throws(
    () =>
      assertCheckpointReleaseBudget(items(11), {
        phase: "prepare",
        mode: "release",
      }),
    /Entire paired release/,
  );
  assert.equal(
    assertCheckpointReleaseBudget(items(10), {
      phase: "prepare",
      mode: "release",
    }).required,
    14,
  );
  assert.throws(() =>
    assertCheckpointReleaseBudget(items(13), {
      phase: "promote",
      mode: "release",
    }),
  );
  assert.equal(
    assertCheckpointReleaseBudget(items(12), {
      phase: "promote",
      mode: "release",
    }).cap,
    24,
  );
});
