import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { actionBridge } from "../../infrastructure/failover/action-bridge.mjs";
import {
  archiveOnOwnerMac,
  verifyOwnerMacProof,
} from "../../infrastructure/failover/owner-archive.mjs";
import {
  assertPairedInputs,
  assertCandidate,
  runPreparedPublisher,
  requestOidc,
} from "../../infrastructure/failover/paired-ci.mjs";
import { prepareRelease } from "../../infrastructure/failover/prepare-release.mjs";
import { createRecoveryReceipt } from "../../infrastructure/failover/recovery-receipt.mjs";
import { cloudflarePackage } from "../../infrastructure/failover/cloudflare-package.mjs";
import { fileFetcher, A, OLD, B } from "./receipt-fixture.mjs";
import {
  WriteJournal,
  createProviderAdapters,
} from "../../infrastructure/failover/deployment-adapters.mjs";
import { verifyOriginManifest } from "../../infrastructure/failover/trusted-inspectors.mjs";
import { createHandler } from "../../infrastructure/failover/worker.mjs";

const sha = "c".repeat(40);
const exec = promisify(execFile);

test("actual workflow CLI sets runner paths after allocation and rejects injected artifact identities", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-cli-inputs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "env"),
    script = new URL(
      "../../infrastructure/failover/paired-ci.mjs",
      import.meta.url,
    ).pathname;
  const env = {
    PATH: process.env.PATH,
    RUNNER_TEMP: root,
    GITHUB_WORKSPACE: path.join(root, "code"),
    GITHUB_ENV: file,
  };
  await exec(process.execPath, [script, "paths", root], { env });
  assert.match(await readFile(file, "utf8"), /PAIRED_ROOT=.*jji-paired/);
  const before = await readFile(file, "utf8");
  await assert.rejects(
    exec(process.execPath, [script, "inputs", root], {
      env: {
        ...env,
        PREPARED_CANDIDATE: JSON.stringify({
          run_id: "1\nINJECTED=yes",
          artifact_id: "2",
          receipt_sha256: "a".repeat(64),
        }),
      },
    }),
  );
  assert.equal(await readFile(file, "utf8"), before);
});
async function fixture(t, mode = "bootstrap") {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-paired-ci-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  await mkdir(source);
  await writeFile(
    path.join(source, "index.html"),
    '<h1>A</h1><link href="/style.css">',
  );
  await writeFile(path.join(source, "style.css"), "body{color:red}");
  const first = path.join(root, "first");
  const firstMeta = await prepareRelease({
    source,
    output: first,
    bootstrap: true,
  });
  let packageRoot = first,
    meta = firstMeta,
    origin = A,
    previous;
  if (mode === "release") {
    previous = await createRecoveryReceipt({
      packageRoot: first,
      origin: A,
      bootstrapOrigin: OLD,
      sourceCommit: "a".repeat(40),
      workflowCommit: sha,
      workflowRunId: "1",
      fetcher: fileFetcher({
        [A]: path.join(first, "public"),
        [OLD]: path.join(first, "stage"),
      }),
    });
    await writeFile(
      path.join(source, "index.html"),
      '<h1>B</h1><link href="/style.css">',
    );
    await writeFile(path.join(source, "style.css"), "body{color:blue}");
    packageRoot = path.join(root, "second");
    meta = await prepareRelease({
      source,
      output: packageRoot,
      previous: first,
    });
    origin = B;
  }
  const fetcher = fileFetcher({
    [origin]: path.join(packageRoot, "public"),
    [A]: path.join(first, "public"),
    [OLD]: path.join(first, "stage"),
  });
  const issued = await createRecoveryReceipt({
    packageRoot,
    origin,
    bootstrapOrigin: OLD,
    sourceCommit: "b".repeat(40),
    workflowCommit: sha,
    workflowRunId: "42",
    previousReceiptBytes: previous?.bytes,
    previousReceiptDigest: previous?.sha256,
    fetcher,
  });
  const proof = await archiveOnOwnerMac({
    receiptBytes: issued.bytes,
    expectedDigest: issued.sha256,
    destination: path.join(root, "owner-held"),
    fetcher,
  });
  const cf = path.join(root, "cloudflare");
  await cloudflarePackage(packageRoot, cf, []);
  return { root, packageRoot, meta, issued, proof, cf };
}

test("owner archive helper creates actual tar, restores exact public/stage bytes, refuses overwrite", async (t) => {
  const f = await fixture(t);
  const verified = verifyOwnerMacProof(
    f.proof,
    f.issued.receipt,
    f.issued.sha256,
    { approved: true },
  );
  assert.equal(
    verified.verificationMode,
    "protected-owner-attested-mac-restore",
  );
  assert.equal(verified.offDeviceMacRedundancy, false);
  assert.throws(
    () => verifyOwnerMacProof(f.proof, f.issued.receipt, f.issued.sha256),
    /approval/,
  );
  for (const changed of [
    { receiptSha256: "f".repeat(64) },
    { archiveBytes: 0 },
    { verifiedFiles: 0 },
    { verifiedAt: 0 },
    { owner: "intruder" },
    { privatePath: "/private" },
  ])
    assert.throws(() =>
      verifyOwnerMacProof(
        { ...f.proof, ...changed },
        f.issued.receipt,
        f.issued.sha256,
        { approved: true },
      ),
    );
  await assert.rejects(
    archiveOnOwnerMac({
      receiptBytes: f.issued.bytes,
      expectedDigest: f.issued.sha256,
      destination: path.join(f.root, "owner-held"),
    }),
    /EEXIST/,
  );
});

test("official-action IPC is nonce-bound, refuses replay and rejects malformed outputs", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-ipc-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const b = actionBridge(root, { timeoutMs: 1000, pollMs: 1 });
  const request = b.request("stage");
  await b.waitRequest("stage");
  await assert.rejects(
    b.reply("stage", { id: 1, digest: "SECRET" }),
    /Invalid/,
  );
  await b.reply("stage", { id: 1, digest: "a".repeat(64) });
  assert.equal((await request).id, 1);
  await assert.rejects(b.request("stage"), /replay/);
  await assert.rejects(
    b.reply("stage", { id: 1, digest: "a".repeat(64) }),
    /exists/,
  );
  await assert.rejects(b.request("secret"), /Unknown/);
});

test("IPC timeout and stopped publisher never fabricate successful action outputs", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-ipc-stop-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    actionBridge(root, { timeoutMs: 15, pollMs: 1 }).request("stage"),
    /uncertain/,
  );
  await writeFile(
    path.join(root, "outcome.json"),
    JSON.stringify({ status: "failed" }),
  );
  await assert.rejects(actionBridge(root).waitRequest("final"), /stopped/);
});

for (const mode of ["bootstrap", "release"])
  for (const failure of [
    null,
    "corrupt",
    "provenance",
    "quota",
    "uncertain-stage",
  ]) {
    test(`concrete ${mode} wiring: ${failure ?? "success"}`, async (t) => {
      const f = await fixture(t, mode),
        calls = [],
        journal = new WriteJournal(path.join(f.root, "journal.json"));
      const artifactDigest = "d".repeat(64);
      let workerId = "11111111-1111-1111-1111-111111111111",
        artifactPhase = 0;
      const provider = {
        currentWorkerDeployment: async () => ({ id: workerId }),
        deployGithub: async ({ key }) => {
          const stage = key.startsWith("stage-");
          calls.push(stage ? "stage" : "final");
          if (stage && failure === "uncertain-stage")
            throw new Error("uncertain");
          return journal.run(key, async () => ({ id: stage ? "123" : "456" }));
        },
        waitGithub: async () => {},
        uploadBackup: async () => {
          throw new Error("Must reuse prepared backup, never upload twice");
        },
        uploadWorkerVersion: async () => {
          calls.push("pointer-version");
          return { version: "v2" };
        },
        promoteWorker: async () => {
          calls.push("pointer");
          workerId = "22222222-2222-2222-2222-222222222222";
          return { id: workerId };
        },
      };
      const bridge = {
        request: async (phase) => {
          if (phase === "recovery") {
            calls.push("receipt");
            await cp(
              path.join(f.root, "record"),
              path.join(f.root, "readback"),
              { recursive: true },
            );
            if (failure === "corrupt")
              await writeFile(
                path.join(f.root, "readback/receipt.json"),
                "corrupt",
              );
          }
          artifactPhase++;
          return {
            id: phase === "recovery" ? 3 : artifactPhase,
            digest: artifactDigest,
          };
        },
      };
      const invoke = () =>
        runPreparedPublisher({
          writesApproved: true,
          packageRoot: f.packageRoot,
          candidate: { mode, cloudflareDirectory: f.cf, routes: [] },
          receiptBytes: f.issued.bytes,
          receiptSha256: f.issued.sha256,
          proof: f.proof,
          policy: { allowOwnerMacArchive: true },
          context: { sha, runId: "43" },
          provider,
          bridge,
          inspectCurrent: async () =>
            mode === "bootstrap"
              ? {
                  exclusivePublisher: true,
                  workerActive: false,
                  primaryFiles: f.meta.sourceFiles,
                }
              : {
                  exclusivePublisher: true,
                  release: f.meta.previousRelease,
                  pointerCurrent: f.meta.previousRelease,
                  primaryFiles: f.meta.previousFiles,
                },
          verifyPrimary: async () => {},
          verifyBackup: async () => {
            calls.push("verify-backup");
          },
          oidc: async () => "FAKE_IN_MEMORY_ONLY",
          readArtifact: async () => ({
            id: 3,
            digest: "sha256:" + artifactDigest,
            workflow_run: {
              id: failure === "provenance" ? 0 : 43,
              head_sha: sha,
            },
            name: "paired-release-receipt",
            expired: false,
            size_in_bytes: 100,
            created_at: "2026-10-24T00:00:00Z",
            expires_at: "2026-10-31T00:00:00Z",
          }),
          readBackRoot: f.root,
          journal,
          code: "",
          expectedWorkerDeployment: workerId,
          beforeArtifactWrite: async () => {
            if (failure === "quota") throw new Error("quota");
          },
        });
      if (failure) {
        await assert.rejects(invoke());
        assert.ok(!calls.includes("final"));
        assert.ok(!calls.includes("pointer"));
        if (failure === "quota") assert.ok(!calls.includes("stage"));
      } else {
        assert.equal((await invoke()).release, f.meta.release);
        assert.ok(calls.indexOf("stage") < calls.indexOf("receipt"));
        assert.ok(calls.indexOf("receipt") < calls.indexOf("final"));
        if (mode === "release")
          assert.ok(
            calls.indexOf("receipt") < calls.indexOf("pointer") &&
              calls.indexOf("pointer") < calls.indexOf("final"),
          );
        else assert.ok(!calls.includes("pointer"));
      }
    });
  }

test("manual publication guards require explicit policies and reject wrong actor, attempt, account or source", () => {
  const env = {
    GITHUB_ACTOR: "JustinJIndustries",
    GITHUB_RUN_ATTEMPT: "1",
    PAIRED_WRITES_APPROVED: "yes",
    SOURCE_COMMIT: sha,
    APPROVED_RELEASE: "a".repeat(64),
    PAIRED_PHASE: "prepare",
    PAIRED_MODE: "bootstrap",
    CLOUDFLARE_ACCOUNT_ID: "986b5334eba2d05d253ee98ca9842dfe",
    POLICY_APPROVAL: JSON.stringify({
      allowInventoryAdmission: true,
      allowOwnerMacArchive: true,
      retentionApproved: true,
      noWorkerRouteConfirmed: true,
    }),
  };
  const event = {
    inputs: {
      phase: "prepare",
      mode: "bootstrap",
      source_commit: sha,
      approved_public_release: env.APPROVED_RELEASE,
    },
  };
  assert.doesNotThrow(() => assertPairedInputs(env, event));
  for (const changed of [
    { GITHUB_ACTOR: "intruder" },
    { GITHUB_RUN_ATTEMPT: "2" },
    { PAIRED_WRITES_APPROVED: "no" },
    { SOURCE_COMMIT: "main" },
    { POLICY_APPROVAL: "{}" },
    { CLOUDFLARE_ACCOUNT_ID: "other" },
  ])
    assert.throws(() => assertPairedInputs({ ...env, ...changed }, event));
});

test("primary provenance marker rejects matching fallback bytes instead of masking origin failure", async () => {
  const bytes = Buffer.from("content"),
    entries = [
      {
        path: "index.html",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ];
  for (const marker of [null, "fallback"])
    await assert.rejects(
      verifyOriginManifest("https://www.justinjindustries.com/", entries, {
        requirePrimaryMarker: true,
        fetcher: async () =>
          new Response(bytes, {
            headers: marker ? { "x-jji-source": marker } : {},
          }),
      }),
    );
  await verifyOriginManifest("https://www.justinjindustries.com/", entries, {
    requirePrimaryMarker: true,
    fetcher: async () =>
      new Response(bytes, { headers: { "x-jji-source": "primary" } }),
  });
  const primary = await createHandler({
    fetcher: async () =>
      new Response("ok", { headers: { "x-jji-source": "spoof" } }),
  })(new Request("https://www.justinjindustries.com/"));
  assert.equal(primary.headers.get("x-jji-source"), "primary");
});

test("paired workflow invokes actual publication handoffs, uses pinned actions and contains no automatic trigger", async () => {
  const yaml = await readFile(
    new URL("../../.github/workflows/paired-release.yml", import.meta.url),
    "utf8",
  );
  assert.match(yaml, /paired-ci\.mjs promote/);
  assert.match(yaml, /paired-ci\.mjs action-reply/);
  assert.match(yaml, /retention-days: 7/);
  assert.match(yaml, /environment: failover-sync/);
  assert.doesNotMatch(yaml, /^\s+(push|pull_request|schedule):/m);
  for (const action of yaml.matchAll(/uses: ([^\s]+)/g))
    assert.match(action[1], /@[a-f0-9]{40}$/);
});

test("prepared publisher defaults to disabled before touching any paths or providers", async () => {
  await assert.rejects(runPreparedPublisher({}), /disabled/);
});

test("OIDC request uses the official Pages default audience, fixed HTTPS runner endpoint and no redirect", async () => {
  let call;
  const endpoint =
    "https://pipelines.actions.githubusercontent.com/oidc?api-version=2.0";
  const result = await requestOidc(
    {
      ACTIONS_ID_TOKEN_REQUEST_URL: endpoint,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "FAKE_RUNNER_TOKEN",
    },
    async (url, init) => {
      call = { url: String(url), init };
      return new Response(JSON.stringify({ value: "FAKE_IN_MEMORY_OIDC" }));
    },
  );
  assert.equal(result, "FAKE_IN_MEMORY_OIDC");
  assert.equal(call.url, endpoint);
  assert.equal(call.init.redirect, "error");
  await assert.rejects(
    requestOidc(
      {
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://evil.example/",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "fake",
      },
      () => assert.fail("must not fetch"),
    ),
  );
});

test("candidate provenance rejects unsuccessful, foreign or mismatched preparation runs", async (t) => {
  const f = await fixture(t),
    repo = "JustinJIndustries/JustinJ_Industries_Website";
  const env = {
    SOURCE_COMMIT: "b".repeat(40),
    APPROVED_RELEASE: f.meta.release,
    GITHUB_SHA: sha,
    PAIRED_MODE: "bootstrap",
    CANDIDATE_RECEIPT_SHA256: f.issued.sha256,
    CANDIDATE_RUN_ID: "42",
  };
  const candidate = {
    schema: 1,
    sourceCommit: env.SOURCE_COMMIT,
    workflowCommit: sha,
    runId: "42",
    mode: "bootstrap",
    receiptSha256: f.issued.sha256,
  };
  const run = {
    id: 42,
    conclusion: "success",
    head_sha: sha,
    head_branch: "main",
    event: "workflow_dispatch",
    path: ".github/workflows/paired-release.yml",
    repository: { full_name: repo },
    actor: { login: "JustinJIndustries" },
  };
  const artifact = {
    expired: false,
    workflow_run: { id: 42, head_sha: sha },
    name: "paired-candidate-42",
    size_in_bytes: 100,
  };
  assert.doesNotThrow(() =>
    assertCandidate(candidate, f.issued.receipt, env, run, artifact),
  );
  for (const changed of [
    { conclusion: "failure" },
    { head_branch: "feature" },
    { path: "evil.yml" },
    { actor: { login: "intruder" } },
    { repository: { full_name: "other/repo" } },
  ])
    assert.throws(() =>
      assertCandidate(
        candidate,
        f.issued.receipt,
        env,
        { ...run, ...changed },
        artifact,
      ),
    );
  assert.throws(() =>
    assertCandidate(
      { ...candidate, receiptSha256: "f".repeat(64) },
      f.issued.receipt,
      env,
      run,
      artifact,
    ),
  );
  assert.throws(() =>
    assertCandidate(candidate, f.issued.receipt, env, run, {
      ...artifact,
      expired: true,
    }),
  );
});

test("complete bootstrap joins real provider adapter, coordinator and file IPC with mocked official artifact transport", async (t) => {
  const f = await fixture(t),
    calls = [],
    artifacts = new Map();
  const context = {
    repository: "JustinJIndustries/JustinJ_Industries_Website",
    ref: "refs/heads/main",
    event: "workflow_dispatch",
    sha,
    approvedSha: sha,
    environmentApproved: true,
    environment: "failover-sync",
    runId: "43",
    workflowPath: ".github/workflows/paired-release.yml",
    concurrencyGroup: "pages",
    otherPublishersPaused: true,
  };
  const storage = {
    accountUsedBytes: 0,
    receiptBytes: 1048576,
    largestPagesArtifactBytes: 1048576,
    freeStorageBytes: 524288000,
    recoveryArtifactBytes: 2097152,
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
    retainedReceiptCount: 0,
    retainedReceiptBytes: 0,
    currentRunReceiptCount: 0,
    currentRunTransientCount: 0,
    retainedTransientCount: 0,
  };
  const journal = new WriteJournal(path.join(f.root, "journal.json"));
  const primaryRoot = path.join(f.root, "primary");
  await cp(path.join(f.root, "source"), primaryRoot, { recursive: true });
  const fetcher = fileFetcher({
    "https://www.justinjindustries.com/": primaryRoot,
    [A]: path.join(f.packageRoot, "public"),
  });
  const provider = createProviderAdapters({
    account: "986b5334eba2d05d253ee98ca9842dfe",
    worker: "jji-failover-test",
    githubToken: "FAKE_GITHUB_TOKEN",
    context,
    storage,
    journal,
    writesApproved: true,
    fetcher: async (url, init) => {
      assert.ok(
        url.startsWith(
          "https://api.github.com/repos/JustinJIndustries/JustinJ_Industries_Website/",
        ),
      );
      let value;
      if (url.includes("/actions/artifacts/"))
        value = artifacts.get(Number(url.split("/").pop()));
      else if (init.method === "POST") {
        const body = JSON.parse(init.body),
          a = artifacts.get(body.artifact_id);
        assert.equal(body.oidc_token, "FAKE_OIDC");
        calls.push("deploy-" + a.phase);
        await cp(
          path.join(f.packageRoot, a.phase === "stage" ? "stage" : "public"),
          primaryRoot,
          { recursive: true },
        );
        value = { id: sha };
      } else {
        assert.ok(url.endsWith("/pages/deployments/" + sha));
        value = { status: "succeed" };
      }
      return new Response(JSON.stringify(value));
    },
  });
  const bridge = actionBridge(path.join(f.root, "ipc"), {
    timeoutMs: 2000,
    pollMs: 1,
  });
  const driver = async () => {
    let id = 1;
    for (const phase of ["stage", "recovery", "final"]) {
      await bridge.waitRequest(phase);
      calls.push("artifact-" + phase);
      if (phase === "recovery")
        await cp(path.join(f.root, "record"), path.join(f.root, "readback"), {
          recursive: true,
        });
      artifacts.set(id, {
        id,
        phase,
        digest: "sha256:" + "d".repeat(64),
        expired: false,
        workflow_run: { id: 43, head_sha: sha, head_branch: "main" },
        name:
          phase === "recovery" ? "paired-release-receipt" : "paired-" + phase,
        size_in_bytes: 100,
        created_at: "2026-10-24T00:00:00Z",
        expires_at: "2026-10-31T00:00:00Z",
      });
      await bridge.reply(phase, { id, digest: "d".repeat(64) });
      id++;
    }
  };
  const publication = runPreparedPublisher({
    writesApproved: true,
    packageRoot: f.packageRoot,
    candidate: { mode: "bootstrap", cloudflareDirectory: f.cf, routes: [] },
    receiptBytes: f.issued.bytes,
    receiptSha256: f.issued.sha256,
    proof: f.proof,
    policy: { allowOwnerMacArchive: true },
    context,
    provider,
    bridge,
    inspectCurrent: async () => ({
      exclusivePublisher: true,
      workerActive: false,
      primaryFiles: f.meta.sourceFiles,
    }),
    verifyPrimary: (entries) =>
      verifyOriginManifest("https://www.justinjindustries.com/", entries, {
        fetcher,
      }),
    verifyBackup: (origin, entries) =>
      verifyOriginManifest(origin, entries, { fetcher }),
    oidc: async () => "FAKE_OIDC",
    readArtifact: async (id) => artifacts.get(id),
    readBackRoot: f.root,
    journal,
    beforeArtifactWrite: async () => {},
  });
  await Promise.all([driver(), publication]);
  assert.deepEqual(calls, [
    "artifact-stage",
    "deploy-stage",
    "artifact-recovery",
    "artifact-final",
    "deploy-final",
  ]);
  assert.doesNotMatch(await readFile(journal.file, "utf8"), /FAKE|TOKEN|OIDC/);
});
