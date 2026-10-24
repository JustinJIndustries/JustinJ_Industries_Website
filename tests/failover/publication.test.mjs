import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  prepareRelease,
  verifyPackage,
} from "../../infrastructure/failover/prepare-release.mjs";
import { cloudflarePackage } from "../../infrastructure/failover/cloudflare-package.mjs";
import { createRecoveryRecorder } from "../../infrastructure/failover/recovery-store.mjs";
import { runPublicationSession } from "../../infrastructure/failover/publication-session.mjs";
import { WriteJournal } from "../../infrastructure/failover/deployment-adapters.mjs";
import { assertStorageBudget } from "../../infrastructure/failover/release-policy.mjs";
import {
  inspectLogicalInventory,
  RETENTION,
} from "../../infrastructure/failover/storage-admission.mjs";
import {
  receiptFixtures,
  fileFetcher,
  A,
  B,
  OLD,
  ROLLBACK,
} from "./receipt-fixture.mjs";

const REPO = "JustinJIndustries/JustinJ_Industries_Website";
const context = {
  repository: REPO,
  ref: "refs/heads/main",
  event: "workflow_dispatch",
  sha: "c".repeat(40),
  approvedSha: "c".repeat(40),
  environmentApproved: true,
  environment: "failover-sync",
  runId: "42",
  workflowPath: ".github/workflows/paired-release.yml",
  concurrencyGroup: "pages",
  otherPublishersPaused: true,
};
function snapshot() {
  return {
    accountUsedBytes: 0,
    receiptBytes: RETENTION.receiptBytes,
    recoveryArtifactBytes: RETENTION.recoveryArtifactBytes,
    largestPagesArtifactBytes: 1024 * 1024,
    freeStorageBytes: 500 * 1024 * 1024,
    observedAt: Date.now(),
    spendingBlocked: true,
    actionsSpendingBlocked: true,
    packagesSpendingBlocked: true,
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
}
function inventory(now) {
  return {
    owner: "JustinJIndustries",
    observedAt: now,
    ownerVerified: true,
    repositoriesComplete: true,
    currentRunId: "42",
    repositories: [{ fullName: REPO, artifactsComplete: true, artifacts: [] }],
    packages: { complete: true, bytes: 0, source: "owner-ui-empty" },
  };
}

test("complete inventory may redact unrelated repository names without dropping bytes or permitting duplicate identities", () => {
  const now = Date.now(),
    input = inventory(now);
  input.repositories.push({
    owner: "JustinJIndustries",
    opaqueIdentity: "a".repeat(64),
    metadataRedacted: true,
    artifactsComplete: true,
    artifacts: [{ id: 999, name: "redacted", bytes: 1234 }],
  });
  const result = inspectLogicalInventory(input, now);
  assert.equal(result.accountUsedBytes, 1234);
  assert.equal(result.retainedReceiptCount, 0);
  assert.equal(input.repositories[1].fullName, undefined);
  assert.throws(() =>
    inspectLogicalInventory(
      {
        ...input,
        repositories: [...input.repositories, input.repositories[1]],
      },
      now,
    ),
  );
  assert.throws(() =>
    inspectLogicalInventory(
      {
        ...input,
        repositories: [{ ...input.repositories[1], owner: "other" }],
      },
      now,
    ),
  );
  assert.throws(() =>
    inspectLogicalInventory(
      {
        ...input,
        repositories: [
          {
            ...input.repositories[1],
            artifacts: [{ id: 999, name: "redacted" }],
          },
        ],
      },
      now,
    ),
  );
});
async function fixture(t) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "jji-inactive-publication-"),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  await mkdir(source);
  await writeFile(
    path.join(source, "index.html"),
    '<h1>A</h1><link href="/style.css">',
  );
  await writeFile(path.join(source, "style.css"), "body{color:red}");
  const a = path.join(root, "a"),
    first = await prepareRelease({ source, output: a, bootstrap: true });
  await writeFile(
    path.join(source, "index.html"),
    '<h1>B</h1><link href="/style.css">',
  );
  await writeFile(path.join(source, "style.css"), "body{color:blue}");
  const b = path.join(root, "b"),
    second = await prepareRelease({ source, output: b, previous: a });
  const f = { root, source, a, b, first, second };
  return { ...f, ...(await receiptFixtures(f)) };
}
function wiring(
  f,
  {
    mode = "release",
    archiveFailure,
    uploadFailure,
    readbackFailure,
    budgetFailure,
    writesApproved = true,
  } = {},
) {
  const packageRoot =
    mode === "bootstrap" ? f.a : mode === "rollback" ? f.rollbackRoot : f.b;
  const meta =
    mode === "bootstrap"
      ? f.first
      : mode === "rollback"
        ? f.receiptRollback.receipt.metadata
        : f.second;
  const origin = mode === "bootstrap" ? A : mode === "rollback" ? ROLLBACK : B;
  const calls = [],
    archives = new Map();
  let artifact,
    uploads = 0,
    pointer = "old";
  const recovery = {
    provenance: {
      sourceCommit: (mode === "release" ? "b" : "a").repeat(40),
      workflowCommit: "c".repeat(40),
      workflowRunId: "42",
    },
    previous:
      mode === "bootstrap"
        ? undefined
        : mode === "rollback"
          ? f.receiptB
          : f.receiptA,
    bootstrapOrigin: OLD,
    fetcher: fileFetcher({
      [A]: path.join(f.a, "public"),
      [B]: path.join(f.b, "public"),
      [OLD]: path.join(f.a, "stage"),
      [ROLLBACK]: path.join(f.rollbackRoot, "public"),
    }),
    // Simulates the owner independently archiving the exact proposed bytes.
    // Production readers must inspect already held material/approved ledger.
    readOwnerApproval: async (sha, bytes) => {
      calls.push("archive");
      const archive = path.join(f.root, "owner-" + sha),
        material = path.join(archive, "package");
      await mkdir(archive);
      await cp(packageRoot, material, { recursive: true });
      await writeFile(path.join(archive, "receipt.json"), bytes);
      await writeFile(path.join(archive, "receipt.sha256"), sha + "\n");
      if (archiveFailure === "missing-public")
        await rm(path.join(material, "public/index.html"));
      if (archiveFailure === "missing-stage")
        await rm(path.join(material, "stage"), { recursive: true });
      if (archiveFailure === "raw-only") {
        await rm(material, { recursive: true });
        await cp(f.source, material, { recursive: true });
      }
      if (archiveFailure === "digest")
        await writeFile(path.join(archive, "receipt.sha256"), "f".repeat(64));
      archives.set(sha, {
        packageRoot: archiveFailure === "working-copy" ? packageRoot : material,
        receiptFile: path.join(archive, "receipt.json"),
        digestFile: path.join(archive, "receipt.sha256"),
        independentStorageVerified: archiveFailure !== "independence",
      });
      return {
        schema: 1,
        storageIdentity: "owner-offline-archive",
        materialVerified: true,
        independentOwnerApproval: archiveFailure !== "approval",
        release: meta.release,
        sourceCommit: recovery.provenance.sourceCommit,
        receiptSha256: sha,
      };
    },
    readArchive: async (_identity, sha) => archives.get(sha),
    transport: {
      upload: async (input) => {
        uploads++;
        calls.push("receipt");
        if (uploadFailure) throw new Error("SECRET_TOKEN?private=query");
        artifact = {
          ...input,
          files: Object.fromEntries(
            Object.entries(input.files).map(([k, b]) => [k, Buffer.from(b)]),
          ),
          expired: false,
        };
        return { id: "123" };
      },
      readBack: async () => {
        if (readbackFailure === "throw")
          throw new Error("SECRET_PROVIDER_RESPONSE");
        const a = { ...artifact, files: { ...artifact.files } };
        if (readbackFailure === "receipt")
          a.files["receipt.json"] = Buffer.from("corrupt");
        if (readbackFailure === "archive")
          a.files["archive-proof.json"] = Buffer.from("{}");
        if (readbackFailure === "provenance") a.workflowCommit = "d".repeat(40);
        if (readbackFailure === "extra")
          a.files["private-note.txt"] = Buffer.from("not allowed");
        return a;
      },
    },
    journal: new WriteJournal(path.join(f.root, "journal-" + mode + ".json")),
    context,
    refreshStorage: async () =>
      budgetFailure ? { ...snapshot(), freeStorageBytes: 1 } : snapshot(),
  };
  const provider = {
    currentWorkerDeployment: async () => ({ id: pointer }),
    deployGithub: async ({ key }) => {
      calls.push(
        key.startsWith("stage")
          ? "stage"
          : key.startsWith("rollback")
            ? "rollback-primary"
            : "final",
      );
      return { id: "mock" };
    },
    waitGithub: async () => {},
    uploadBackup: async () => {
      calls.push("backup");
      return { origin };
    },
    uploadWorkerVersion: async ({ code }) => {
      assert.equal(code, "reviewed Worker code");
      calls.push("version");
      return { version: "new" };
    },
    promoteWorker: async () => {
      calls.push("pointer");
      pointer = "new";
      return { id: pointer };
    },
  };
  if (mode === "bootstrap") {
    provider.currentWorkerDeployment = async () =>
      assert.fail("bootstrap must not read Worker");
    provider.uploadWorkerVersion = async () =>
      assert.fail("bootstrap must not write Worker");
    provider.promoteWorker = async () =>
      assert.fail("bootstrap must not promote Worker");
  }
  return {
    packageRoot,
    recovery,
    calls,
    get uploads() {
      return uploads;
    },
    run: async () => {
      const dir = path.join(f.root, "cloudflare-" + mode);
      await cloudflarePackage(packageRoot, dir, []);
      return runPublicationSession({
        mode,
        packageRoot,
        originalRoot: f.b,
        writesApproved,
        recovery,
        bindings: {
          provider,
          cloudflareDirectory: dir,
          routes: [],
          githubArtifactFor: async () => ({}),
          code: "reviewed Worker code",
          expectedWorkerDeployment: "old",
          verifyPrimary: async (entries) => assert.ok(entries.length),
          verifyBackup: async (_origin, entries) => assert.ok(entries.length),
          inspectCurrent: async () =>
            mode === "bootstrap"
              ? {
                  exclusivePublisher: true,
                  workerActive: false,
                  primaryFiles: f.first.sourceFiles,
                }
              : {
                  exclusivePublisher: true,
                  release:
                    mode === "rollback" ? f.second.release : f.first.release,
                  pointerCurrent:
                    mode === "rollback" ? f.second.release : f.first.release,
                  primaryFiles:
                    mode === "rollback" ? f.second.files : f.first.files,
                },
        },
      });
    },
  };
}

test("inventory admission is disabled by default and unknown/incomplete usage cannot become zero", () => {
  const s = snapshot();
  s.admissionMode = "logical-inventory";
  s.inventoryAdmissionApproved = true;
  s.logicalInventory = inventory(s.observedAt);
  assert.throws(() => assertStorageBudget(s), /disabled/);
  assert.doesNotThrow(() =>
    assertStorageBudget(s, Date.now(), {
      allowInventoryAdmission: true,
      currentRunId: "42",
    }),
  );
  for (const mutation of [
    (i) => (i.repositoriesComplete = false),
    (i) => (i.repositories[0].artifactsComplete = false),
    (i) => (i.packages.bytes = null),
    (i) => (i.packages.complete = false),
    (i) => i.repositories.push(i.repositories[0]),
    (i) =>
      i.repositories[0].artifacts.push({
        id: 1,
        name: "github-pages",
        bytes: null,
      }),
  ]) {
    const i = structuredClone(s.logicalInventory);
    mutation(i);
    assert.throws(() => inspectLogicalInventory(i, s.observedAt));
  }
  for (const changes of [
    { inventoryAdmissionApproved: false },
    { actionsSpendingBlocked: false },
    { packagesSpendingBlocked: false },
    { accountUsedBytes: 1 },
    { observedAt: s.observedAt - 16 * 60_000 },
  ])
    assert.throws(() =>
      assertStorageBudget({ ...s, ...changes }, Date.now(), {
        allowInventoryAdmission: true,
        currentRunId: "42",
      }),
    );
});

test("inventory includes all repositories and retained receipt/transient counts; seven-day caps stop overlap", () => {
  const now = Date.now(),
    i = inventory(now);
  i.repositories[0].artifacts = [
    { id: 1, name: "paired-release-receipt", runId: "12", bytes: 100 },
    { id: 2, name: "paired-stage-12", runId: "12", bytes: 200 },
    { id: 3, name: "paired-final-12", runId: "12", bytes: 300 },
  ];
  i.repositories.push({
    fullName: "JustinJIndustries/Other",
    artifactsComplete: true,
    artifacts: [{ id: 1, name: "other", bytes: 400 }],
  });
  i.packages = { complete: true, bytes: 500, source: "api-complete" };
  const counts = inspectLogicalInventory(i, now);
  assert.equal(counts.accountUsedBytes, 1500);
  assert.equal(counts.retainedReceiptCount, 1);
  assert.equal(counts.retainedTransientCount, 2);
  assert.equal(counts.retainedReceiptBytes, 100);
  for (const changes of [
    { retainedTransientCount: 1 },
    { retainedTransientCount: 2 },
    { retainedReceiptCount: 7 },
    { receiptRetentionDays: 90 },
    { receiptRetentionApproved: false },
    { recoveryArtifactBytes: 1024 * 1024 },
    { freeStorageBytes: 1 },
  ])
    assert.throws(() => assertStorageBudget({ ...snapshot(), ...changes }));
  const admitted = assertStorageBudget({
    ...snapshot(),
    retainedReceiptCount: 6,
  });
  assert.equal(admitted.projectedReceiptCount, 7);
  assert.equal(admitted.projectedTransientCount, 2);
});

test("publication session and recorder default to disabled without provider/archive calls", async (t) => {
  const f = await fixture(t),
    w = wiring(f, { writesApproved: false });
  await assert.rejects(w.run(), /disabled/);
  assert.deepEqual(w.calls, []);
  const record = createRecoveryRecorder({ ...w.recovery, packageRoot: f.b });
  await assert.rejects(record(f.second, B), /disabled/);
  assert.deepEqual(w.calls, []);
});

for (const mode of ["bootstrap", "release", "rollback"])
  test(`complete inactive ${mode} wiring archives exact material before promotion`, async (t) => {
    const f = await fixture(t),
      w = wiring(f, { mode });
    await w.run();
    assert.deepEqual(
      w.calls,
      mode === "bootstrap"
        ? ["stage", "backup", "archive", "receipt", "final"]
        : mode === "release"
          ? [
              "stage",
              "backup",
              "archive",
              "receipt",
              "version",
              "pointer",
              "final",
            ]
          : [
              "backup",
              "archive",
              "receipt",
              "rollback-primary",
              "version",
              "pointer",
            ],
    );
    assert.equal(w.uploads, 1);
  });

for (const failure of [
  "missing-public",
  "missing-stage",
  "raw-only",
  "digest",
  "working-copy",
  "independence",
  "approval",
])
  test(`incomplete archive (${failure}) stops before receipt upload, pointer or final primary`, async (t) => {
    const f = await fixture(t),
      w = wiring(f, { archiveFailure: failure });
    await assert.rejects(w.run());
    assert.equal(w.uploads, 0);
    assert.deepEqual(w.calls, ["stage", "backup", "archive"]);
  });

test("rollback archive failure leaves primary and pointer unchanged", async (t) => {
  const f = await fixture(t),
    w = wiring(f, { mode: "rollback", archiveFailure: "missing-stage" });
  await assert.rejects(w.run());
  assert.deepEqual(w.calls, ["backup", "archive"]);
});

for (const failure of ["throw", "receipt", "archive", "provenance", "extra"])
  test(`receipt readback ${failure} stops promotion and sanitizes provider failure`, async (t) => {
    const f = await fixture(t),
      w = wiring(f, { readbackFailure: failure });
    await assert.rejects(
      w.run(),
      (e) => /unconfirmed/.test(e.message) && !e.message.includes("SECRET"),
    );
    assert.deepEqual(w.calls, ["stage", "backup", "archive", "receipt"]);
  });

test("quota refusal immediately before receipt persistence stops later phases", async (t) => {
  const f = await fixture(t),
    w = wiring(f, { budgetFailure: true });
  await assert.rejects(w.run(), /unconfirmed/);
  assert.equal(w.uploads, 0);
  assert.deepEqual(w.calls, ["stage", "backup", "archive"]);
});

test("uncertain receipt upload is journaled, redacted and cannot replay after recorder restart", async (t) => {
  const f = await fixture(t),
    w = wiring(f, { uploadFailure: true });
  const record = createRecoveryRecorder({
    ...w.recovery,
    packageRoot: f.b,
    writesApproved: true,
  });
  for (let n = 0; n < 2; n++)
    await assert.rejects(
      record(f.second, B),
      (e) => /unconfirmed/.test(e.message) && !e.message.includes("SECRET"),
    );
  assert.equal(w.uploads, 1);
  assert.doesNotMatch(
    await readFile(w.recovery.journal.file, "utf8"),
    /SECRET|private=query/,
  );
  assert.deepEqual(await verifyPackage(f.b), f.second);
});

test("current-run uploads are counted once; prior-run overlap cannot be relabeled as free space", () => {
  const s = snapshot(),
    i = inventory(s.observedAt);
  i.repositories[0].artifacts = [
    { id: 1, name: "paired-stage-42", runId: "42", bytes: 1024 * 1024 },
    { id: 2, name: "paired-release-receipt", runId: "42", bytes: 1000 },
  ];
  const counts = inspectLogicalInventory(i, s.observedAt);
  const admitted = {
    ...s,
    ...counts,
    admissionMode: "logical-inventory",
    logicalInventory: i,
    inventoryAdmissionApproved: true,
  };
  const policy = { allowInventoryAdmission: true, currentRunId: "42" };
  const p = assertStorageBudget(admitted, Date.now(), policy);
  assert.equal(
    p.peakBytes,
    counts.accountUsedBytes + s.largestPagesArtifactBytes + 20 * 1024 * 1024,
  );
  assert.equal(p.projectedReceiptCount, 1);
  assert.throws(() =>
    assertStorageBudget(admitted, Date.now(), {
      ...policy,
      currentRunId: "99",
    }),
  );
  i.repositories[0].artifacts[0].runId = "41";
  assert.throws(() =>
    assertStorageBudget(
      { ...admitted, ...inspectLogicalInventory(i, s.observedAt) },
      Date.now(),
      policy,
    ),
  );
});

test("artifact transport timeout is bounded and its unknown upload cannot be repeated", async (t) => {
  const f = await fixture(t),
    w = wiring(f);
  let uploads = 0;
  w.recovery.transport.upload = async () => {
    uploads++;
    return new Promise(() => {});
  };
  const record = createRecoveryRecorder({
    ...w.recovery,
    packageRoot: f.b,
    writesApproved: true,
    transportTimeoutMs: 15,
  });
  const started = Date.now();
  await assert.rejects(record(f.second, B), /unconfirmed/);
  assert.ok(Date.now() - started < 1000);
  await assert.rejects(record(f.second, B));
  assert.equal(uploads, 1);
});

test("untrusted journal fields are never included in a recovery artifact", async (t) => {
  const f = await fixture(t),
    w = wiring(f);
  await writeFile(
    w.recovery.journal.file,
    JSON.stringify({
      malicious: {
        state: "confirmed",
        intentDigest: "a".repeat(64),
        rawProviderBody: "SECRET_QUERY",
      },
    }),
  );
  const record = createRecoveryRecorder({
    ...w.recovery,
    packageRoot: f.b,
    writesApproved: true,
  });
  await assert.rejects(record(f.second, B), /unconfirmed/);
  assert.equal(w.uploads, 0);
});

test("receipt provenance cannot substitute a different workflow run", async (t) => {
  const f = await fixture(t),
    w = wiring(f);
  const record = createRecoveryRecorder({
    ...w.recovery,
    packageRoot: f.b,
    writesApproved: true,
    provenance: { ...w.recovery.provenance, workflowRunId: "99" },
  });
  await assert.rejects(record(f.second, B), /wiring missing/);
  assert.deepEqual(w.calls, []);
});

test("provider quota refusal after a passing inventory budget stops promotion without retry", async (t) => {
  const f = await fixture(t),
    w = wiring(f);
  w.recovery.transport.upload = async () => {
    w.calls.push("provider-quota-refusal");
    throw new Error("quota not refreshed");
  };
  const record = createRecoveryRecorder({
    ...w.recovery,
    packageRoot: f.b,
    writesApproved: true,
  });
  await assert.rejects(record(f.second, B), /unconfirmed/);
  assert.deepEqual(w.calls, ["archive", "provider-quota-refusal"]);
  await assert.rejects(record(f.second, B), /unconfirmed/);
  assert.equal(w.calls.filter((x) => x === "provider-quota-refusal").length, 1);
});
