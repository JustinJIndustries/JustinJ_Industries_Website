import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  access,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  prepareRelease,
  verifyPackage,
} from "../../infrastructure/failover/prepare-release.mjs";
import {
  createRecoveryReceipt,
  recoverPackage,
  prepareRollbackRecovery,
  decodeReceipt,
  encodeReceipt,
  receiptDigest,
  RECEIPT_LIMIT,
} from "../../infrastructure/failover/recovery-receipt.mjs";
import {
  coordinateRelease,
  coordinateBootstrap,
  assertCurrentSnapshot,
} from "../../infrastructure/failover/coordinate-release.mjs";
import {
  receiptFixtures,
  fileFetcher,
  proof,
  A,
  B,
  OLD,
  ROLLBACK,
} from "./receipt-fixture.mjs";
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-lean-recovery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  await mkdir(path.join(source, "assets"), { recursive: true });
  await writeFile(
    path.join(source, "index.html"),
    '<h1>A</h1><link href="/style.css"><img src="/assets/image.png">',
  );
  await writeFile(path.join(source, "style.css"), "p{color:red}");
  await writeFile(
    path.join(source, "assets/image.png"),
    Buffer.alloc(1024 * 1024, 1),
  );
  await writeFile(path.join(source, "assets/image@3x.webp"), "retina preview");
  const a = path.join(root, "a"),
    first = await prepareRelease({ source, output: a, bootstrap: true });
  await writeFile(
    path.join(source, "index.html"),
    '<h1>B</h1><link href="/style.css"><img src="/assets/image.png">',
  );
  await writeFile(path.join(source, "style.css"), "p{color:blue}");
  const b = path.join(root, "b"),
    second = await prepareRelease({ source, output: b, previous: a });
  const f = { root, source, a, b, first, second };
  return { ...f, ...(await receiptFixtures(f)) };
}
const routes = (f) => ({
  [A]: path.join(f.a, "public"),
  [B]: path.join(f.b, "public"),
  [OLD]: path.join(f.a, "stage"),
  [ROLLBACK]: path.join(f.rollbackRoot, "public"),
});
const recover = (f, output, extra = {}) =>
  recoverPackage({
    receiptBytes: f.receiptB.bytes,
    expectedDigest: f.receiptB.sha256,
    output,
    fetcher: fileFetcher(routes(f)),
    ...extra,
  });
const noMeta = (output) =>
  assert.rejects(access(path.join(output, "release.json")));

test("small pinned receipt reconstructs final and rollback trees without a full GitHub checkpoint", async (t) => {
  const f = await fixture(t),
    calls = [],
    output = path.join(f.root, "recovered");
  assert.ok(f.receiptB.bytes.length < RECEIPT_LIMIT);
  assert.ok(f.receiptB.bytes.length < f.second.totalBytes / 10);
  await recover(f, output, { fetcher: fileFetcher(routes(f), calls) });
  assert.deepEqual(await verifyPackage(output), f.second);
  assert.match(
    await readFile(path.join(output, "public/index.html"), "utf8"),
    />B</,
  );
  assert.match(
    await readFile(path.join(output, "stage/index.html"), "utf8"),
    />A</,
  );
  assert.ok(
    calls.every(
      (c) =>
        c.redirect === "manual" &&
        c.credentials === "omit" &&
        !c.headers.authorization &&
        !c.headers.cookie,
    ),
  );
  assert.ok(calls.some((c) => c.url.startsWith(A)));
  assert.ok(calls.some((c) => c.url.startsWith(B)));
  await assert.rejects(recover(f, output), /EEXIST/);
});

test("external receipt digest, ancestry, path and unknown-field checks reject before fetching", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const fetcher = async () => {
    calls++;
    throw new Error("unexpected");
  };
  await assert.rejects(
    recover(f, path.join(f.root, "wrong-digest"), {
      expectedDigest: "f".repeat(64),
      fetcher,
    }),
    /matching digest/,
  );
  const mutations = [
    (r) => (r.publicFiles[0].path = "../escape"),
    (r) => (r.origin = "https://evil.invalid/"),
    (r) => (r.origin = "https://jji-backup-20261023.pages.dev/"),
    (r) => (r.origin = "http://ac3af448.jji-backup-20261023.pages.dev/"),
    (r) => (r.ancestor.origin = r.origin),
    (r) => (r.metadata.previousRelease = "f".repeat(64)),
    (r) => (r.token = "must-not-persist"),
    (r) => (r.metadata.secret = "must-not-persist"),
    (r) => (r.publicFiles[0].bytes = 26 * 1024 * 1024),
  ];
  for (let i = 0; i < mutations.length; i++) {
    const r = JSON.parse(f.receiptB.bytes);
    mutations[i](r);
    const b = Buffer.from(JSON.stringify(r));
    await assert.rejects(
      recoverPackage({
        receiptBytes: b,
        expectedDigest: receiptDigest(b),
        output: path.join(f.root, "invalid-" + i),
        fetcher,
      }),
    );
  }
  assert.equal(calls, 0);
  await assert.rejects(
    recoverPackage({
      receiptBytes: Buffer.alloc(RECEIPT_LIMIT + 1),
      expectedDigest: "a".repeat(64),
      output: path.join(f.root, "too-big"),
      fetcher,
    }),
  );
});

test("corrupt, oversized, missing or security-challenged remote bytes leave no publishable package", async (t) => {
  const f = await fixture(t);
  const mocks = [
    () => new Response("corrupt"),
    () => new Response(Buffer.alloc(2 * 1024 * 1024 + 1)),
    () => new Response("missing", { status: 404 }),
    () =>
      new Response("challenge", {
        status: 403,
        headers: { "cf-mitigated": "challenge" },
      }),
    () => new Response("denied", { status: 429 }),
  ];
  for (let i = 0; i < mocks.length; i++) {
    const output = path.join(f.root, "failed-" + i);
    await assert.rejects(
      recover(f, output, { fetcher: async () => mocks[i]() }),
      /stop without retry/,
    );
    await noMeta(output);
  }
});

test("recovery refuses foreign redirects and loops but accepts same-origin relative canonical redirects", async (t) => {
  const f = await fixture(t),
    normal = fileFetcher(routes(f));
  for (const [name, location] of [
    ["foreign", "https://foreign.invalid/"],
    ["http", "http://ac3af448.jji-backup-20261023.pages.dev/"],
    ["loop", "/assets/image.png"],
  ]) {
    let calls = 0;
    const output = path.join(f.root, name);
    await assert.rejects(
      recover(f, output, {
        fetcher: async () => {
          calls++;
          return new Response(null, { status: 301, headers: { location } });
        },
      }),
      /stop without retry/,
    );
    assert.ok(calls <= 2);
    await noMeta(output);
  }
  const output = path.join(f.root, "relative");
  const fetcher = async (u, o) => {
    const url = new URL(u);
    if (url.pathname === "/index.html")
      return new Response(null, { status: 301, headers: { location: "./" } });
    if (url.pathname === "/") return normal(new URL("index.html", url), o);
    return normal(u, o);
  };
  await recover(f, output, { fetcher });
  await verifyPackage(output);
});

test("header and body waits are bounded for non-cooperative fetches", async (t) => {
  const f = await fixture(t);
  for (const [name, fetcher] of [
    ["headers", () => new Promise(() => {})],
    [
      "body",
      async () =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array([1]));
            },
          }),
        ),
    ],
  ]) {
    const start = Date.now(),
      output = path.join(f.root, name);
    await assert.rejects(
      recover(f, output, { fetcher, perFileMs: 15, totalMs: 50 }),
      /timeout/,
    );
    assert.ok(Date.now() - start < 300);
    await noMeta(output);
  }
});

test("receipt issuance verifies current and ancestor data and cannot accept a wrong predecessor", async (t) => {
  const f = await fixture(t);
  const args = {
    packageRoot: f.b,
    origin: B,
    sourceCommit: "b".repeat(40),
    workflowCommit: "c".repeat(40),
    workflowRunId: "9",
    previousReceiptBytes: f.receiptA.bytes,
    previousReceiptDigest: f.receiptA.sha256,
  };
  await assert.rejects(
    createRecoveryReceipt({
      ...args,
      fetcher: async () => new Response("corrupt"),
    }),
    /stop without retry/,
  );
  await assert.rejects(
    createRecoveryReceipt({
      ...args,
      previousReceiptDigest: "f".repeat(64),
      fetcher: async () => assert.fail("must not fetch"),
    }),
  );
  const r = JSON.parse(f.receiptB.bytes);
  r.metadata.sourceFiles[0].sha256 = "f".repeat(64);
  assert.throws(() => encodeReceipt(r), /mismatch/);
});

test("rollback receipt preserves newer assets and the next release carries the complete union", async (t) => {
  const f = await fixture(t),
    recovered = path.join(f.root, "rollback-recovered");
  await recoverPackage({
    receiptBytes: f.receiptRollback.bytes,
    expectedDigest: f.receiptRollback.sha256,
    output: recovered,
    fetcher: fileFetcher(routes(f)),
  });
  const rollback = await verifyPackage(recovered);
  assert.equal(rollback.release, f.first.release);
  assert.ok(rollback.releases.includes(f.second.release));
  for (const id of [f.first.release, f.second.release])
    await readFile(
      path.join(recovered, "public/__jji_releases", id, "style.css"),
    );
  await writeFile(
    path.join(f.source, "index.html"),
    '<h1>C</h1><link href="/style.css">',
  );
  await writeFile(path.join(f.source, "style.css"), "p{color:green}");
  const c = path.join(f.root, "c"),
    third = await prepareRelease({
      source: f.source,
      output: c,
      previous: recovered,
    });
  assertCurrentSnapshot(third, {
    release: rollback.release,
    pointerCurrent: rollback.release,
    exclusivePublisher: true,
    primaryFiles: rollback.files,
  });
  for (const tree of ["public", "stage"])
    for (const id of [f.first.release, f.second.release, third.release])
      await readFile(path.join(c, tree, "__jji_releases", id, "style.css"));
  const C = "https://cccccccc.jji-backup-20261023.pages.dev/";
  const receipt = await createRecoveryReceipt({
    packageRoot: c,
    origin: C,
    sourceCommit: "d".repeat(40),
    workflowCommit: "c".repeat(40),
    workflowRunId: "4",
    previousReceiptBytes: f.receiptRollback.bytes,
    previousReceiptDigest: f.receiptRollback.sha256,
    fetcher: fileFetcher({ ...routes(f), [C]: path.join(c, "public") }),
  });
  const final = path.join(f.root, "c-recovered");
  await recoverPackage({
    receiptBytes: receipt.bytes,
    expectedDigest: receipt.sha256,
    output: final,
    fetcher: fileFetcher({ ...routes(f), [C]: path.join(c, "public") }),
  });
  assert.deepEqual(await verifyPackage(final), third);
});

test("bootstrap rollback retains immutable assets and can become a verified new baseline", async (t) => {
  const f = await fixture(t),
    output = path.join(f.root, "bootstrap-rollback");
  const m = await prepareRollbackRecovery({
    recoveredRoot: f.a,
    receiptBytes: f.receiptA.bytes,
    expectedDigest: f.receiptA.sha256,
    output,
  });
  assert.equal(m.release, f.first.release);
  assert.match(
    await readFile(path.join(output, "public/index.html"), "utf8"),
    /href="\/style.css"/,
  );
  await readFile(
    path.join(output, "public/__jji_releases", m.release, "style.css"),
  );
  await verifyPackage(output);
});

test("durable receipt failure or mismatch stops pointer promotion and primary HTML", async (t) => {
  const f = await fixture(t);
  for (const recordRecovery of [
    async () => {
      throw new Error("receipt store unavailable");
    },
    async () => ({ ...f.proofB, durable: false }),
    async () => f.proofA,
  ]) {
    let promoted = false,
      primary = false;
    await assert.rejects(
      coordinateRelease(f.b, {
        assertCurrent: async () => {},
        publishAssetStage: async () => {},
        verifyAssetStage: async () => {},
        publishBackup: async () => B,
        verifyBackup: async () => {},
        recordRecovery,
        promoteFallback: async () => {
          promoted = true;
        },
        publishPrimary: async () => {
          primary = true;
        },
      }),
    );
    assert.equal(promoted, false);
    assert.equal(primary, false);
  }
  let writes = 0;
  await assert.rejects(
    coordinateRelease(f.b, {
      publishAssetStage: async () => {
        writes++;
      },
    }),
    /recorder/,
  );
  assert.equal(writes, 0);
});

test("bootstrap records durable recovery before primary and never promotes a Worker", async (t) => {
  const f = await fixture(t),
    calls = [];
  await coordinateBootstrap(f.a, {
    assertBootstrapCurrent: async () => calls.push("preflight"),
    publishAssetStage: async () => calls.push("stage"),
    verifyAssetStage: async () => {},
    publishBackup: async () => {
      calls.push("backup");
      return A;
    },
    verifyBackup: async () => {},
    recordRecovery: async () => {
      calls.push("receipt");
      return f.proofA;
    },
    publishPrimary: async () => calls.push("primary"),
    verifyPairedRelease: async () => calls.push("verify"),
  });
  assert.deepEqual(calls, [
    "preflight",
    "stage",
    "backup",
    "receipt",
    "primary",
    "verify",
  ]);
});

test("durability requires read-back integrity; uncertain storage never triggers an automatic retry", async (t) => {
  const f = await fixture(t);
  const { persistRecoveryReceipt } =
    await import("../../infrastructure/failover/recovery-receipt.mjs");
  let writes = 0,
    reads = 0;
  const p = await persistRecoveryReceipt({
    bytes: f.receiptB.bytes,
    expectedDigest: f.receiptB.sha256,
    store: {
      writeOnce: async () => {
        writes++;
        return "immutable receipt id";
      },
      readBack: async () => {
        reads++;
        return f.receiptB.bytes;
      },
    },
  });
  assert.equal(p.durable, true);
  assert.equal(writes, 1);
  assert.equal(reads, 1);
  writes = 0;
  await assert.rejects(
    persistRecoveryReceipt({
      bytes: f.receiptB.bytes,
      expectedDigest: f.receiptB.sha256,
      store: {
        writeOnce: async () => {
          writes++;
          throw new Error("private provider detail");
        },
        readBack: async () => assert.fail("must not read unknown object"),
      },
    }),
    (e) => /reconcile/.test(e.message) && !e.message.includes("private"),
  );
  assert.equal(writes, 1);
  await assert.rejects(
    persistRecoveryReceipt({
      bytes: f.receiptB.bytes,
      expectedDigest: f.receiptB.sha256,
      store: {
        writeOnce: async () => 1,
        readBack: async () => Buffer.from("corrupt receipt"),
      },
    }),
    /unconfirmed/,
  );
  await assert.rejects(
    persistRecoveryReceipt({
      bytes: f.receiptB.bytes,
      expectedDigest: f.receiptB.sha256,
      store: {
        writeOnce: async () =>
          assert.fail("missing reader must stop before write"),
      },
    }),
    /requires/,
  );
});

test("provider accounting/quota refusal stops the release even with logically empty storage", async (t) => {
  const f = await fixture(t);
  const calls = [];
  await assert.rejects(
    coordinateRelease(f.b, {
      recordRecovery: async () => f.proofB,
      assertCurrent: async () => calls.push("preflight"),
      publishAssetStage: async () => {
        calls.push("stage-upload");
        throw new Error("provider quota/accounting not refreshed");
      },
      publishBackup: async () => calls.push("backup"),
      promoteFallback: async () => calls.push("pointer"),
      publishPrimary: async () => calls.push("primary"),
    }),
    /quota/,
  );
  assert.deepEqual(calls, ["preflight", "stage-upload"]);
});
