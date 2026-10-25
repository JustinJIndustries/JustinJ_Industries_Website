import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import {
  WriteJournal,
  createProviderAdapters,
  pinnedPagesRunner,
} from "../../infrastructure/failover/deployment-adapters.mjs";
import {
  assertStorageBudget,
  assertTrustedContext,
} from "../../infrastructure/failover/release-policy.mjs";
const sha = "a".repeat(40),
  release = "a".repeat(64);
const v1 = "11111111-1111-1111-1111-111111111111",
  v2 = "22222222-2222-2222-2222-222222222222";
const origin = "https://ac3af448.jji-backup-20261023.pages.dev/";
test("pinned Pages child disables logs and metrics without inheriting unrelated secrets", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-runner-env-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cli = path.join(root, "check-env.mjs");
  const source = `
    import assert from 'node:assert/strict';
    assert.equal(process.env.WRANGLER_WRITE_LOGS, 'false');
    assert.equal(process.env.WRANGLER_SEND_METRICS, 'false');
    assert.equal(process.env.CLOUDFLARE_API_TOKEN, 'FAKE_PAGES_SECRET');
    assert.equal(process.env.GITHUB_TOKEN, undefined);
    assert.ok(!process.argv.join(' ').includes('FAKE_PAGES_SECRET'));
    console.log('https://ac3af448.jji-backup-20261023.pages.dev/');
  `;
  await writeFile(cli, source);
  assert.equal(
    await pinnedPagesRunner({
      cli,
      cliSha256: createHash("sha256").update(source).digest("hex"),
      args: [],
      token: "FAKE_PAGES_SECRET",
      account: "a".repeat(32),
    }),
    origin,
  );
});
const context = {
  repository: "JustinJIndustries/JustinJ_Industries_Website",
  ref: "refs/heads/main",
  event: "workflow_dispatch",
  sha,
  approvedSha: sha,
  environmentApproved: true,
  environment: "failover-sync",
  runId: "42",
  workflowPath: ".github/workflows/paired-release.yml",
  concurrencyGroup: "pages",
  otherPublishersPaused: true,
};
const storage = () => ({
  accountUsedBytes: 100,
  receiptBytes: 100,

  largestPagesArtifactBytes: 100,
  freeStorageBytes: 500 * 1024 * 1024,
  observedAt: Date.now(),
  spendingBlocked: true,
  publicStandardRunner: true,
  workersFree: true,
  pagesFree: true,
  retentionDays: 1,
  retentionApproved: true,
  recoveryArchived: true,
  optionalCachesDisabled: true,
  transientCopies: 2,
  checkpointArchiveBytes: 0,
  receiptRetentionDays: 7,
  receiptRetentionApproved: true,
  authoritativeCapacityVerified: true,
  recoveryArtifactBytes: 2 * 1024 * 1024,
  retainedReceiptCount: 0,
  retainedReceiptBytes: 0,
  currentRunReceiptCount: 0,
  currentRunTransientCount: 0,
  retainedTransientCount: 0,
});
async function fixture(t, responses = [], extra = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-adapter-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [],
    journal = new WriteJournal(path.join(root, "journal.json"));
  const fetcher = async (url, init) => {
    calls.push({ url, ...init });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error("Unexpected provider call");
    return new Response(JSON.stringify(next), {
      status: next.statusCode ?? 200,
    });
  };
  const client = createProviderAdapters({
    account: "a".repeat(32),
    worker: "jji-failover-test",
    workerToken: "FAKE_WORKER_SECRET",
    pagesToken: "FAKE_PAGES_SECRET",
    githubToken: "FAKE_GH_SECRET",
    context,
    storage: storage(),
    journal,
    writesApproved: true,
    fetcher,
    delay: async () => {},
    ...extra,
  });
  return { root, client, calls, journal };
}
const result = (r) => ({ success: true, result: r });
const current = () =>
  result({
    deployments: [{ id: v1, versions: [{ version_id: v1, percentage: 100 }] }],
  });

test("trusted CI guard rejects PRs, wrong SHA, fork, missing environment review and competing publishers", () => {
  assert.doesNotThrow(() => assertTrustedContext(context));
  for (const changes of [
    { event: "pull_request" },
    { event: "pull_request_target" },
    { repository: "fork/repo" },
    { approvedSha: "b".repeat(40) },
    { ref: "refs/heads/feature" },
    { environmentApproved: false },
    { environment: "github-pages" },
    { runId: null },
    { concurrencyGroup: "different" },
    { otherPublishersPaused: false },
  ])
    assert.throws(
      () => assertTrustedContext({ ...context, ...changes }),
      /Untrusted/,
    );
});

test("storage is fail-closed on stale, missing billing protection, duplicate peak capacity or unknown plan", () => {
  assert.equal(assertStorageBudget(storage()).retentionDays, 1);
  for (const changes of [
    { observedAt: Date.now() - 16 * 60_000 },
    { spendingBlocked: false },
    { workersFree: false },
    { pagesFree: false },
    { freeStorageBytes: 50 },
    { retentionDays: 2 },
    { retentionApproved: false },
    { recoveryArchived: false },
    { optionalCachesDisabled: false },
    { transientCopies: 1 },
    { accountUsedBytes: null },
    { receiptBytes: NaN },
  ])
    assert.throws(() => assertStorageBudget({ ...storage(), ...changes }));
});

test("writes disabled by default, no provider calls", async (t) => {
  const f = await fixture(t, [], { writesApproved: false });
  await assert.rejects(
    f.client.uploadBackup({ directory: "/tmp/package", key: "backup" }),
    /disabled/,
  );
  assert.equal(f.calls.length, 0);
});

test("journal survives restart, redacts provider errors, blocks uncertain replay and reconciles read-only", async (t) => {
  const f = await fixture(t);
  let writes = 0;
  await assert.rejects(
    f.journal.run("backup", async () => {
      writes++;
      throw new Error("token=SECRET?private=query");
    }),
    /Uncertain/,
  );
  const second = new WriteJournal(path.join(f.root, "journal.json"));
  await assert.rejects(
    second.run("backup", async () => {
      writes++;
    }),
    /reconcile/,
  );
  assert.equal(writes, 1);
  assert.doesNotMatch(
    await readFile(path.join(f.root, "journal.json"), "utf8"),
    /SECRET|private|query/,
  );
  await second.reconcile("backup", async () => ({ origin }));
  assert.deepEqual(
    await second.run("backup", () => assert.fail("must not replay")),
    { origin },
  );
  await assert.rejects(
    second.run("backup", () => assert.fail("must not replay changed intent"), {
      artifact: "changed",
    }),
    /different intent/,
  );
  await assert.rejects(
    second.run("unsafe", async () => ({ token: "secret" })),
    /Uncertain/,
  );
});

test("Worker upload is version-only and accepts only dedicated settings; promotion checks current deployment", async (t) => {
  const f = await fixture(t, [
    result({ bindings: [], observability: { enabled: false } }),
    result({ id: v2 }),
    current(),
    result({ id: v2 }),
  ]);
  assert.deepEqual(
    await f.client.uploadWorkerVersion({
      code: "export default {};",
      config: { origin, current: release, retained: [] },
      key: "worker-upload",
    }),
    { version: v2 },
  );
  assert.ok(f.calls[1].body instanceof FormData);
  assert.match(f.calls[1].url, /\/versions$/);
  assert.equal(f.calls[1].redirect, "error");
  assert.deepEqual(
    await f.client.promoteWorker({
      version: v2,
      expectedDeployment: v1,
      key: "worker-promote",
    }),
    { id: v2, version: v2 },
  );
  assert.deepEqual(JSON.parse(f.calls[3].body), {
    strategy: "percentage",
    versions: [{ version_id: v2, percentage: 100 }],
  });
  assert.ok(f.calls.every((c) => !/routes|zones|tokens|secrets/.test(c.url)));
});

test("stale Worker pointer and unreviewed bindings stop before writes", async (t) => {
  const f = await fixture(t, [
    current(),
    result({
      bindings: [{ name: "SECRET", type: "secret_text" }],
      observability: { enabled: false },
    }),
  ]);
  await assert.rejects(
    f.client.promoteWorker({
      version: v2,
      expectedDeployment: v2,
      key: "stale",
    }),
    /Stale/,
  );
  await assert.rejects(
    f.client.uploadWorkerVersion({
      code: "",
      config: { origin, current: release, retained: [] },
      key: "unreviewed",
    }),
    /unreviewed/,
  );
  assert.ok(f.calls.every((c) => c.method === "GET"));
});

test("Pages upload targets only existing preview project; token stays out of arguments and receipts", async (t) => {
  let invocation;
  const f = await fixture(t, [], {
    pagesRunner: async (input) => {
      invocation = input;
      return origin;
    },
  });
  const directory = path.join(f.root, "public");
  await mkdir(directory);
  await writeFile(path.join(directory, "index.html"), "public");
  await f.client.uploadBackup({ directory, key: "pages-upload" });
  await writeFile(path.join(directory, "index.html"), "changed");
  await assert.rejects(
    f.client.uploadBackup({ directory, key: "pages-upload" }),
    /different intent/,
  );
  assert.ok(invocation.args.includes("--project-name=jji-backup-20261023"));
  assert.ok(invocation.args.includes("--branch=failover-preview"));
  assert.doesNotMatch(JSON.stringify(invocation.args), /SECRET/);
  assert.doesNotMatch(
    await readFile(path.join(f.root, "journal.json"), "utf8"),
    /SECRET/,
  );
  assert.equal(f.calls.length, 0);
});

test("GitHub only deploys main artifact with exact digest; bounded status failure stops", async (t) => {
  const artifact = {
    id: 42,
    expired: false,
    digest: "sha256:" + release,
    workflow_run: { head_sha: sha, head_branch: "main" },
  };
  const f = await fixture(t, [
    artifact,
    { id: sha },
    { status: "deployment_in_progress" },
    { status: "succeed" },
  ]);
  await f.client.deployGithub({
    artifactId: 42,
    artifactDigest: artifact.digest,
    oidcToken: "FAKE_OIDC_SECRET",
    key: "gh-stage",
  });
  await f.client.waitGithub(sha, 2);
  assert.match(f.calls[2].url, new RegExp(`/pages/deployments/${sha}$`));
  assert.ok(!f.calls[2].url.endsWith("/status"));
  assert.equal(f.calls[1].method, "POST");
  assert.equal(JSON.parse(f.calls[1].body).artifact_id, 42);
  assert.equal(JSON.parse(f.calls[1].body).environment, "failover-sync");
  assert.doesNotMatch(
    await readFile(path.join(f.root, "journal.json"), "utf8"),
    /SECRET/,
  );
  const g = await fixture(t, [
    {
      ...artifact,
      workflow_run: { head_sha: "b".repeat(40), head_branch: "main" },
    },
  ]);
  await assert.rejects(
    g.client.deployGithub({
      artifactId: 42,
      artifactDigest: artifact.digest,
      oidcToken: "fake",
      key: "wrong-artifact",
    }),
    /Untrusted/,
  );
  assert.ok(g.calls.every((c) => c.method === "GET"));
  const h = await fixture(t, [{ status: "deployment_in_progress" }]);
  await assert.rejects(h.client.waitGithub(sha, 1), /pending/);
  const i = await fixture(t, [{ status: "deployment_failed" }]);
  await assert.rejects(i.client.waitGithub(sha, 1), /did not succeed/);
});

test("GitHub queued deployments remain bounded and require explicit success", async (t) => {
  const queued = await fixture(t, [
    { status: "deployment_queued" },
    { status: "deployment_in_progress" },
    { status: "succeed" },
  ]);
  await queued.client.waitGithub(sha, 3);
  assert.equal(queued.calls.length, 3);
  assert.ok(queued.calls.every((c) => c.method === "GET"));
  const exhausted = await fixture(t, [{ status: "deployment_queued" }]);
  await assert.rejects(exhausted.client.waitGithub(sha, 1), /still pending/);
  for (const status of [
    "deployment_failed",
    "deployment_cancelled",
    "unknown_status",
    "unexpected",
  ]) {
    const failed = await fixture(t, [{ status }]);
    await assert.rejects(failed.client.waitGithub(sha, 3), /did not succeed/);
    assert.equal(failed.calls.length, 1);
  }
});

test("provider failure is sanitized, uncertain write is never automatically repeated", async (t) => {
  const f = await fixture(t, [
    result({ bindings: [], observability: { enabled: false } }),
    new Error("FAKE_WORKER_SECRET private query"),
    result({ bindings: [], observability: { enabled: false } }),
  ]);
  const call = () =>
    f.client.uploadWorkerVersion({
      code: "",
      config: { origin, current: release, retained: [] },
      key: "uncertain-upload",
    });
  await assert.rejects(
    call(),
    (e) => /Uncertain/.test(e.message) && !/SECRET|query/.test(e.message),
  );
  await assert.rejects(call(), /reconcile/);
  assert.equal(f.calls.filter((c) => c.method === "POST").length, 1);
});
