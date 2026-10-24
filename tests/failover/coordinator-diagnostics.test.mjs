import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  symlink,
  rm,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  startDiagnostics,
  diagnosticCode,
  readDiagnosticOutcome,
} from "../../infrastructure/failover/coordinator-diagnostics.mjs";
import { actionBridge } from "../../infrastructure/failover/action-bridge.mjs";
const exec = promisify(execFile);
const script = new URL(
  "../../infrastructure/failover/paired-ci.mjs",
  import.meta.url,
).pathname;
async function fixture(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "jji-diagnostics-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  return {
    temp,
    root: path.join(temp, "jji-paired"),
    env: { PATH: process.env.PATH, RUNNER_TEMP: temp },
  };
}
test("real CLI persists early input failure before any network or dependency setup; waiter fails promptly", async (t) => {
  const f = await fixture(t);
  const event = path.join(f.temp, "event.json");
  await writeFile(event, "{}");
  await assert.rejects(
    exec(process.execPath, [script, "promote", f.root], {
      env: {
        ...f.env,
        GITHUB_EVENT_PATH: event,
        CLOUDFLARE_PAGES_TOKEN: "SECRET_MUST_NOT_APPEAR",
      },
    }),
    (e) => {
      assert.doesNotMatch(e.stderr, /SECRET_MUST_NOT_APPEAR|Error:|at main/);
      return e.code === 1;
    },
  );
  const d = await readDiagnosticOutcome(f.root);
  assert.equal(d.code, "inputs_rejected");
  assert.equal(d.stage, "inputs");
  const started = Date.now();
  await assert.rejects(
    actionBridge(f.root, { pollMs: 5 }).waitRequest("public-baseline"),
    /Publisher stopped/,
  );
  assert.ok(Date.now() - started < 1000);
});
test("unknown free-form provider errors never enter outcome, progress or summary; exact known failures are coded", async (t) => {
  const f = await fixture(t),
    d = await startDiagnostics(f.root, "prepare", f.env);
  await d.stage("identity");
  await d.failed(
    new Error(
      "https://private.example/?token=SECRET_PRIVATE provider-body SECRET",
    ),
  );
  const text = await readFile(path.join(f.root, "outcome.json"), "utf8");
  assert.doesNotMatch(text, /private.example|SECRET|provider-body/);
  assert.equal(
    (await readDiagnosticOutcome(f.root)).code,
    "unclassified_failure",
  );
  assert.equal(
    diagnosticCode(
      new Error(
        "Immutable recovery read failed (status, integrity, security or timeout); stop without retry",
      ),
    ),
    "recovery_read_failed",
  );
  const summary = path.join(f.temp, "summary");
  await exec(process.execPath, [script, "summary", f.root], {
    env: { ...f.env, GITHUB_STEP_SUMMARY: summary },
  });
  assert.match(
    await readFile(summary, "utf8"),
    /unclassified_failure; stage: identity/,
  );
  assert.doesNotMatch(await readFile(summary, "utf8"), /SECRET|https:/);
});
test("outcome is first-write-only and invalid progress cannot introduce free-form values", async (t) => {
  const f = await fixture(t),
    d = await startDiagnostics(f.root, "promote", f.env);
  await d.stage("recovery");
  await assert.rejects(d.stage("SECRET_STAGE"), /Invalid/);
  await d.failed(new Error("Recovery total wait exceeded"));
  await assert.rejects(d.failed(new Error("NEW_SECRET")), { code: "EEXIST" });
  const result = await readDiagnosticOutcome(f.root);
  assert.equal(result.stage, "recovery");
  assert.equal(result.code, "recovery_timeout");
  assert.doesNotMatch(
    await readFile(path.join(f.root, "coordinator.jsonl"), "utf8"),
    /SECRET/,
  );
});
test("startup refuses other paths, existing roots and symlinks without creating or replacing external data", async (t) => {
  const f = await fixture(t),
    outside = path.join(f.temp, "outside");
  await mkdir(outside);
  await assert.rejects(startDiagnostics(outside, "promote", f.env), /Invalid/);
  await symlink(outside, f.root);
  await assert.rejects(startDiagnostics(f.root, "promote", f.env), {
    code: "EEXIST",
  });
  await assert.rejects(readFile(path.join(outside, "outcome.json")), {
    code: "ENOENT",
  });
  await assert.rejects(startDiagnostics(f.root, "guard", f.env), /Invalid/);
});
test("summary rejects symlink, oversized and malicious diagnostic vocabulary rather than emitting it", async (t) => {
  const f = await fixture(t);
  await mkdir(f.root);
  const file = path.join(f.root, "outcome.json"),
    other = path.join(f.temp, "private");
  await writeFile(other, "SECRET");
  await symlink(other, file);
  assert.equal(await readDiagnosticOutcome(f.root), null);
  await rm(file);
  await writeFile(
    file,
    JSON.stringify({
      status: "failed",
      diagnostic: {
        schema: 1,
        command: "promote",
        pid: 1,
        stage: "SECRET",
        code: "SECRET",
      },
    }),
  );
  await assert.rejects(readDiagnosticOutcome(f.root), /Invalid sanitized/);
  await writeFile(file, "x".repeat(8193));
  await assert.rejects(readDiagnosticOutcome(f.root), /exceeds cap/);
});
test("actual CLI identity-read failure with injected local transport is persisted and redacted", async (t) => {
  const f = await fixture(t),
    event = path.join(f.temp, "event.json"),
    loader = path.join(f.temp, "loader.mjs");
  const source = "a".repeat(40),
    control = "b".repeat(40),
    release = "c".repeat(64),
    repo = "JustinJIndustries/JustinJ_Industries_Website";
  await writeFile(
    event,
    JSON.stringify({
      repository: { full_name: repo, private: false },
      ref: "refs/heads/main",
      inputs: {
        phase: "promote",
        mode: "bootstrap",
        source_commit: source,
        approved_public_release: release,
        approved_workflow_sha: control,
      },
    }),
  );
  await writeFile(
    loader,
    'globalThis.fetch = async () => { throw new Error("SECRET_IN_NETWORK_ERROR https://private.example/?token=SECRET"); };',
  );
  const env = {
    ...process.env,
    ...f.env,
    GITHUB_EVENT_PATH: event,
    GITHUB_ACTOR: "JustinJIndustries",
    GITHUB_RUN_ATTEMPT: "1",
    PAIRED_WRITES_APPROVED: "yes",
    SOURCE_COMMIT: source,
    APPROVED_RELEASE: release,
    PAIRED_PHASE: "promote",
    PAIRED_MODE: "bootstrap",
    CLOUDFLARE_ACCOUNT_ID: "986b5334eba2d05d253ee98ca9842dfe",
    POLICY_APPROVAL: JSON.stringify({
      allowInventoryAdmission: true,
      allowOwnerMacArchive: true,
      retentionApproved: true,
      noWorkerRouteConfirmed: true,
    }),
    GITHUB_REPOSITORY: repo,
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_WORKFLOW_REF:
      repo + "/.github/workflows/paired-release.yml@refs/heads/main",
    RUNNER_ENVIRONMENT: "github-hosted",
    RUNNER_OS: "Linux",
    GITHUB_SHA: control,
    APPROVED_WORKFLOW_SHA: control,
    GITHUB_RUN_ID: "123",
    GH_READ_TOKEN: "FAKE_TEST_ONLY",
  };
  await assert.rejects(
    exec(process.execPath, ["--import", loader, script, "promote", f.root], {
      env,
    }),
    (e) => {
      assert.doesNotMatch(e.stderr, /SECRET|private.example/);
      return e.code === 1;
    },
  );
  const d = await readDiagnosticOutcome(f.root);
  assert.equal(d.stage, "identity");
  assert.equal(d.code, "identity_read_failed");
});

test("progress summary is explicitly non-authoritative and reveals only validated fixed fields", async (t) => {
  const f = await fixture(t),
    d = await startDiagnostics(f.root, "promote", f.env);
  await d.stage("recovery");
  const summary = path.join(f.temp, "summary");
  await exec(process.execPath, [script, "summary", f.root], {
    env: { ...f.env, GITHUB_STEP_SUMMARY: summary },
  });
  const text = await readFile(summary, "utf8");
  assert.match(text, /Last coordinator checkpoint: recovery/);
  assert.match(text, /not proof of publication or process liveness/);
  await writeFile(
    path.join(f.root, "coordinator.jsonl"),
    JSON.stringify({
      schema: 1,
      command: "promote",
      pid: 1,
      stage: "SECRET_URL",
    }) + "\n",
  );
  await assert.rejects(
    exec(process.execPath, [script, "summary", f.root], {
      env: { ...f.env, GITHUB_STEP_SUMMARY: summary },
    }),
    (e) => !e.stderr.includes("SECRET_URL"),
  );
  assert.equal(await readFile(summary, "utf8"), text);
});

test("progress append refuses a replaced symlink rather than writing into its target", async (t) => {
  const f = await fixture(t),
    d = await startDiagnostics(f.root, "promote", f.env);
  const target = path.join(f.temp, "preserved");
  await writeFile(target, "original");
  await rm(path.join(f.root, "coordinator.jsonl"));
  await symlink(target, path.join(f.root, "coordinator.jsonl"));
  await assert.rejects(d.stage("recovery"));
  assert.equal(await readFile(target, "utf8"), "original");
});
