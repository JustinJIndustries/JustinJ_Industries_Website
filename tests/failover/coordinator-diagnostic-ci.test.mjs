import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertDiagnosticContext,
  diagnosticReader,
  DIAGNOSTIC,
} from "../../infrastructure/failover/coordinator-diagnostic-ci.mjs";
const control = "d".repeat(40);
const env = {
  GITHUB_REPOSITORY: DIAGNOSTIC.repo,
  GITHUB_ACTOR: "JustinJIndustries",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_WORKFLOW_REF: `${DIAGNOSTIC.repo}/${DIAGNOSTIC.workflow}@refs/heads/main`,
  RUNNER_ENVIRONMENT: "github-hosted",
  RUNNER_OS: "Linux",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_SHA: control,
  APPROVED_DIAGNOSTIC_SHA: control,
  GITHUB_RUN_ID: "123",
};
const event = {
  repository: { full_name: DIAGNOSTIC.repo, private: false },
  ref: "refs/heads/main",
  inputs: { approved_control_sha: control },
};
test("read-only diagnostic rejects wrong identity, refs, approvals and write-bearing credentials", () => {
  assert.doesNotThrow(() => assertDiagnosticContext(env, event));
  for (const delta of [
    { GITHUB_ACTOR: "other" },
    { GITHUB_REF: "refs/pull/1/head" },
    { GITHUB_EVENT_NAME: "push" },
    { GITHUB_RUN_ATTEMPT: "2" },
    { GITHUB_SHA: "a".repeat(40) },
    { CLOUDFLARE_PAGES_TOKEN: "FAKE" },
    { CLOUDFLARE_WORKER_TOKEN: "FAKE" },
    { ACTIONS_ID_TOKEN_REQUEST_TOKEN: "FAKE" },
  ])
    assert.throws(
      () => assertDiagnosticContext({ ...env, ...delta }, event),
      /rejected/,
    );
});
test("diagnostic network inspector permits only fixed repository GETs and records no credential, body or query text", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-diagnostic-reader-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [],
    read = diagnosticReader(
      { ...env, GH_READ_TOKEN: "FAKE_SECRET" },
      root,
      async (url, init) => {
        calls.push({ url, init });
        return Response.json({ providerBody: "FAKE_SECRET" });
      },
    );
  await read(`/repos/${DIAGNOSTIC.repo}/commits/main`);
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(calls[0].init.method, undefined);
  assert.ok(calls[0].init.signal);
  for (const p of [
    "https://evil.example/",
    `/repos/${DIAGNOSTIC.repo}/pages/deployments`,
    `/repos/${DIAGNOSTIC.repo}/commits/main?token=FAKE_SECRET`,
    "/repos/other/private/actions/artifacts",
  ])
    await assert.rejects(read(p), /rejected/);
  assert.equal(calls.length, 1);
  const text = await readFile(path.join(root, "reads.jsonl"), "utf8");
  assert.doesNotMatch(text, /FAKE_SECRET|providerBody|https:|commits/);
  assert.equal(JSON.parse(text).operation, "main");
});
test("diagnostic reports status or network failure once without retries or provider text", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-diagnostic-refused-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let calls = 0;
  const read = diagnosticReader(
    { ...env, GH_READ_TOKEN: "FAKE" },
    root,
    async () => {
      calls++;
      return new Response("PRIVATE_BODY", { status: 403 });
    },
  );
  await assert.rejects(
    read(`/repos/${DIAGNOSTIC.repo}/environments/failover-sync`),
    /GET refused/,
  );
  assert.equal(calls, 1);
  const text = await readFile(path.join(root, "reads.jsonl"), "utf8");
  assert.doesNotMatch(text, /PRIVATE_BODY|FAKE/);
  assert.equal(JSON.parse(text).status, 403);
});
test("manual diagnostic workflow has only read permissions and no publisher, environment, upload or automatic trigger", async () => {
  const text = await readFile(
    new URL(
      "../../.github/workflows/coordinator-diagnostic.yml",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(text, /contents: read/);
  assert.match(text, /actions: read/);
  assert.doesNotMatch(
    text,
    /(?:pages|id-token): write|secrets\.|environment:|upload-artifact|upload-pages|deploy-pages|^\s+(?:push|pull_request|schedule):/m,
  );
  assert.match(text, /diagnostic-exit.json/);
  assert.match(text, /diagnostic-private-stderr.log/);
  assert.doesNotMatch(text, /cat .*stderr|tee .*stderr/);
  for (const m of text.matchAll(/uses: ([^\s]+)/g))
    assert.match(m[1], /@[a-f0-9]{40}$/);
});

test("observer preserves recovery refusal status and exit evidence without leaking extra record fields", async (t) => {
  const { execFile } = await import("node:child_process"),
    { promisify } = await import("node:util"),
    { writeFile } = await import("node:fs/promises");
  const { startDiagnostics } =
    await import("../../infrastructure/failover/coordinator-diagnostics.mjs");
  const temp = await mkdtemp(
    path.join(os.tmpdir(), "jji-diagnostic-observer-"),
  );
  t.after(() => rm(temp, { recursive: true, force: true }));
  const root = path.join(temp, "jji-paired"),
    d = await startDiagnostics(root, "promote", { RUNNER_TEMP: temp });
  await d.stage("recovery");
  await d.failed(
    new Error(
      "Immutable recovery read failed (status, integrity, security or timeout); stop without retry",
    ),
  );
  await writeFile(path.join(temp, "diagnostic-exit.json"), '{"exitCode":1}');
  await writeFile(
    path.join(root, "recovery-failure.json"),
    JSON.stringify({
      status: 403,
      challenge: true,
      body: "SECRET_BODY",
      url: "https://private.example/?token=SECRET",
    }),
  );
  const cli = new URL(
    "../../infrastructure/failover/coordinator-diagnostic-ci.mjs",
    import.meta.url,
  ).pathname;
  await assert.rejects(
    promisify(execFile)(process.execPath, [cli, "observe", root], {
      env: { PATH: process.env.PATH, RUNNER_TEMP: temp },
    }),
    (e) => {
      const report = JSON.parse(e.stdout);
      assert.deepEqual(report.recoveryFailure, {
        status: 403,
        challenge: true,
      });
      assert.equal(report.failure.code, "recovery_read_failed");
      assert.equal(report.exitCode, 1);
      assert.doesNotMatch(e.stdout + e.stderr, /SECRET|private.example/);
      return true;
    },
  );
});
