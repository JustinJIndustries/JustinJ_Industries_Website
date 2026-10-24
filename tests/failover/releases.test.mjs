import { receiptFixtures } from "./receipt-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  prepareRelease,
  verifyPackage,
  rewrite,
} from "../../infrastructure/failover/prepare-release.mjs";
import { coordinateRelease } from "../../infrastructure/failover/coordinate-release.mjs";
import { cloudflarePackage } from "../../infrastructure/failover/cloudflare-package.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-release-test-"));
  const source = path.join(root, "source");
  await mkdir(path.join(source, "assets"), { recursive: true });
  await writeFile(
    path.join(source, "index.html"),
    '<h1>Approved A</h1><link href="/style.css?v=old"><script src="/app.js"></script><img srcset="/assets/a.png 1x, /assets/b.png 2x"><a href="https://external.example/manual.pdf">Manual</a><a href="/about/">About</a>',
  );
  await writeFile(
    path.join(source, "style.css"),
    '@import url("/assets/extra.css"); .x{background:url(assets/a.png)}',
  );
  await writeFile(
    path.join(source, "app.js"),
    "const src=`/assets/${name}.png`;",
  );
  await writeFile(path.join(source, "assets/extra.css"), "p{color:red}");
  await writeFile(path.join(source, "assets/a.png"), "image-a");
  await writeFile(path.join(source, "assets/b.png"), "image-b");
  await writeFile(path.join(source, "robots.txt"), "User-agent: *\nAllow: /\n");
  const a = path.join(root, "a");
  const first = await prepareRelease({ source, output: a, bootstrap: true });
  await writeFile(
    path.join(source, "index.html"),
    (await readFile(path.join(source, "index.html"), "utf8")).replace(
      "Approved A",
      "Approved B",
    ),
  );
  await writeFile(path.join(source, "style.css"), "p{color:blue}");
  const b = path.join(root, "b");
  const second = await prepareRelease({ source, output: b, previous: a });
  const f = { root, source, a, b, first, second };
  return { ...f, ...(await receiptFixtures(f)) };
}

test("immutable preparation rewrites CSS, srcset and dynamic asset templates, leaving navigation/external links", async () => {
  const f = await fixture();
  try {
    const html = await readFile(path.join(f.a, "public/index.html"), "utf8");
    assert.ok(
      html.includes(`/__jji_releases/${f.first.release}/style.css?v=old`),
    );
    assert.ok(
      html.includes(`/__jji_releases/${f.first.release}/assets/b.png 2x`),
    );
    assert.ok(html.includes('href="https://external.example/manual.pdf"'));
    assert.ok(html.includes('href="/about/"'));
    const css = await readFile(
      path.join(f.a, `public/__jji_releases/${f.first.release}/style.css`),
      "utf8",
    );
    assert.ok(css.includes(`/__jji_releases/${f.first.release}/assets/a.png`));
    assert.ok(
      css.includes(`/__jji_releases/${f.first.release}/assets/extra.css`),
    );
    assert.ok(
      (await readFile(path.join(f.a, "public/app.js"), "utf8")).includes(
        `/__jji_releases/${f.first.release}/assets/`,
      ),
    );
    assert.equal(
      await readFile(path.join(f.a, "public/robots.txt"), "utf8"),
      "User-agent: *\nAllow: /\n",
    );
    await assert.rejects(
      prepareRelease({ source: f.source, output: f.a }),
      /write-once/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("asset staging preserves old HTML and old asset bytes while adding new immutable assets", async () => {
  const f = await fixture();
  try {
    assert.notEqual(f.first.release, f.second.release);
    assert.equal(
      await readFile(path.join(f.b, "stage/index.html"), "utf8"),
      await readFile(path.join(f.a, "public/index.html"), "utf8"),
    );
    const old = `__jji_releases/${f.first.release}/style.css`;
    const next = `__jji_releases/${f.second.release}/style.css`;
    assert.equal(
      await readFile(path.join(f.b, "stage", old), "utf8"),
      await readFile(path.join(f.a, "public", old), "utf8"),
    );
    assert.equal(
      await readFile(path.join(f.b, "stage", next), "utf8"),
      "p{color:blue}",
    );
    assert.equal(
      await readFile(path.join(f.b, "public", old), "utf8"),
      await readFile(path.join(f.a, "public", old), "utf8"),
    );
    await verifyPackage(f.b);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("previous artifact tampering and free-budget overflow stop preparation", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      prepareRelease({
        source: f.source,
        output: path.join(f.root, "tiny"),
        maxBytes: 1,
      }),
      /budget/,
    );
    await writeFile(path.join(f.a, "public/style.css"), "tampered");
    await assert.rejects(
      prepareRelease({
        source: f.source,
        output: path.join(f.root, "tampered"),
        previous: f.a,
      }),
      /digest mismatch/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("paired publication is ordered asset stage -> backup -> pointer -> primary and stops after a failed phase", async () => {
  const f = await fixture();
  try {
    const stages = [
      "publishAssetStage",
      "verifyAssetStage",
      "publishBackup",
      "verifyBackup",
      "recordRecovery",
      "promoteFallback",
      "publishPrimary",
      "verifyPairedRelease",
    ];
    const calls = [];
    const adapters = {
      assertCurrent: async () => {},
      ...Object.fromEntries(
        stages.map((name) => [
          name,
          async () => {
            calls.push(name);
            if (name === "recordRecovery") return f.proofB;
            return "https://ac3af448.jji-backup-20261023.pages.dev/";
          },
        ]),
      ),
    };
    await coordinateRelease(f.b, adapters);
    assert.deepEqual(calls, stages);
    for (const failure of stages) {
      calls.length = 0;
      const failed = {
        ...adapters,
        [failure]: async () => {
          calls.push(failure);
          throw new Error("phase failed");
        },
      };
      await assert.rejects(coordinateRelease(f.b, failed), /phase failed/);
      assert.deepEqual(calls, stages.slice(0, stages.indexOf(failure) + 1));
    }
    await assert.rejects(coordinateRelease(f.a, adapters), /bootstrap/);
    await assert.rejects(
      coordinateRelease(f.b, {
        ...adapters,
        publishBackup: async () => "https://evil.example/",
      }),
      /allowlisted/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("all intermediate phases have both asset versions before new HTML can be served", async () => {
  const f = await fixture();
  try {
    let primary = path.join(f.a, "public"),
      backup = primary;
    const checks = [];
    const check = async () => {
      for (const host of [primary, backup]) {
        const html = await readFile(path.join(host, "index.html"), "utf8");
        const assetUrl = html.match(
          /href="(\/__jji_releases\/[^"?]+)(?:\?[^\"]*)?"/,
        )[1];
        // Both routes contain the referenced bytes, even if the next asset request
        // goes to the other origin. No special fallback-on-404 rule is needed.
        const one = await readFile(path.join(primary, assetUrl));
        const two = await readFile(path.join(backup, assetUrl));
        assert.deepEqual(one, two);
      }
      checks.push(true);
    };
    await coordinateRelease(f.b, {
      assertCurrent: async () => {},
      publishAssetStage: async (dir) => {
        primary = dir;
      },
      verifyAssetStage: check,
      publishBackup: async (dir) => {
        backup = dir;
        return "https://ac3af448.jji-backup-20261023.pages.dev/";
      },
      verifyBackup: check,
      recordRecovery: async () => f.proofB,
      promoteFallback: check,
      publishPrimary: async (dir) => {
        primary = dir;
      },
      verifyPairedRelease: check,
    });
    assert.equal(checks.length, 4);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("rewriter preserves query/fragment and ignores data URLs", () => {
  const s = rewrite(
    '<img src="assets/a.png?v=1#crop"><img src="data:image/png;base64,ABCD">',
    "index.html",
    new Set(["assets/a.png"]),
    "a".repeat(64),
  );
  assert.ok(s.includes("/assets/a.png?v=1#crop"));
  assert.ok(s.includes('src="data:image/png;base64,ABCD"'));
});

test("Cloudflare adapter adds only host metadata and preserves every common public byte", async () => {
  const f = await fixture();
  try {
    const target = path.join(f.root, "cloudflare");
    await cloudflarePackage(f.a, target, [
      { source: "/index.html", target: "/" },
    ]);
    for (const entry of f.first.files)
      assert.deepEqual(
        await readFile(path.join(target, entry.path)),
        await readFile(path.join(f.a, "public", entry.path)),
      );
    assert.equal(
      await readFile(path.join(target, "_redirects"), "utf8"),
      "/index.html / 301\n",
    );
    assert.match(
      await readFile(path.join(target, "_headers"), "utf8"),
      /X-Robots-Tag: noindex/,
    );
    await assert.rejects(
      cloudflarePackage(f.a, path.join(f.root, "bad"), [
        { source: "/../../secrets.html", target: "/" },
      ]),
      /Unsafe/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("stage tampering or a stale predecessor cannot reach a publication adapter", async () => {
  const f = await fixture();
  try {
    let writes = 0;
    const adapters = {
      recordRecovery: async () => f.proofB,
      assertCurrent: async () => {
        throw new Error("stale predecessor");
      },
      publishAssetStage: async () => {
        writes++;
      },
    };
    await assert.rejects(coordinateRelease(f.b, adapters), /stale/);
    assert.equal(writes, 0);
    await writeFile(path.join(f.b, "stage/index.html"), "tampered");
    await assert.rejects(
      coordinateRelease(f.b, adapters),
      /Stage package digest/,
    );
    assert.equal(writes, 0);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("remote-current preflight checks pointer, complete predecessor hashes and exclusive publisher", async () => {
  const { assertCurrentSnapshot } =
    await import("../../infrastructure/failover/coordinate-release.mjs");
  const f = await fixture();
  try {
    const observed = {
      release: f.first.release,
      pointerCurrent: f.first.release,
      exclusivePublisher: true,
      primaryFiles: f.first.files,
    };
    assert.doesNotThrow(() => assertCurrentSnapshot(f.second, observed));
    for (const changes of [
      { release: "c".repeat(64) },
      { pointerCurrent: "c".repeat(64) },
      { exclusivePublisher: false },
      { primaryFiles: [] },
    ])
      assert.throws(
        () => assertCurrentSnapshot(f.second, { ...observed, ...changes }),
        /Stale/,
      );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("compact checkpoints hydrate without recursive ancestors and reject tampered public bytes", async () => {
  const { compactCheckpoint, hydrateCheckpoint } =
    await import("../../infrastructure/failover/release-policy.mjs");
  const f = await fixture();
  try {
    const ac = path.join(f.root, "ac"),
      bc = path.join(f.root, "bc");
    await compactCheckpoint(f.a, ac);
    await compactCheckpoint(f.b, bc);
    await hydrateCheckpoint(bc, ac, path.join(f.root, "hydrated"));
    await writeFile(path.join(f.source, "index.html"), "<h1>Approved C</h1>");
    const c = path.join(f.root, "c");
    await prepareRelease({ source: f.source, output: c, previous: bc });
    const cc = path.join(f.root, "cc");
    await compactCheckpoint(c, cc);
    await hydrateCheckpoint(cc, bc, path.join(f.root, "hydrated-c"));
    await writeFile(path.join(bc, "public/index.html"), "tampered");
    await assert.rejects(
      hydrateCheckpoint(cc, bc, path.join(f.root, "bad-hydrate")),
      /digest mismatch/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("rollback retains new assets on both hosts even after new HTML exposure", async () => {
  const { coordinateRollback } =
    await import("../../infrastructure/failover/coordinate-release.mjs");
  const f = await fixture();
  try {
    let primary = path.join(f.b, "public"),
      backup = primary;
    const pointer = "https://bbbbbbbb.jji-backup-20261023.pages.dev/";
    const calls = [];
    const check = async () => {
      for (const dir of [primary, backup])
        for (const id of [f.first.release, f.second.release])
          assert.ok(
            (await readFile(path.join(dir, "__jji_releases", id, "style.css")))
              .length,
          );
    };
    await coordinateRollback(f.b, {
      assertRollbackCurrent: async () => {
        calls.push("preflight");
      },
      publishRollbackPrimary: async (dir) => {
        primary = dir;
        calls.push("primary");
      },
      verifyRollbackPrimary: check,
      publishRollbackBackup: async (dir) => {
        backup = dir;
        calls.push("backup");
        return pointer;
      },
      verifyRollbackBackup: check,
      recordRollbackRecovery: async () => f.proofRollback,
      promoteRollbackFallback: async (config) => {
        assert.equal(config.current, f.first.release);
        assert.ok(config.retained.includes(f.second.release));
        calls.push("pointer");
      },
      verifyRollbackPair: check,
    });
    assert.deepEqual(calls, ["preflight", "backup", "primary", "pointer"]);
    assert.equal(
      await readFile(path.join(primary, "index.html"), "utf8"),
      await readFile(path.join(f.a, "public/index.html"), "utf8"),
    );
    let later = false;
    await assert.rejects(
      coordinateRollback(f.b, {
        recordRollbackRecovery: async () => f.proofRollback,
        assertRollbackCurrent: async () => {
          throw new Error("uncertain current state");
        },
        publishRollbackPrimary: async () => {
          later = true;
        },
      }),
      /uncertain/,
    );
    assert.equal(later, false);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("bound provider wiring preflights exact Cloudflare upload and publishes sequentially", async () => {
  const { bindReleaseAdapters } =
    await import("../../infrastructure/failover/bind-release-adapters.mjs");
  const { verifyCloudflareDirectory } =
    await import("../../infrastructure/failover/cloudflare-package.mjs");
  const f = await fixture();
  try {
    const directory = path.join(f.root, "cloudflare");
    const routes = [{ source: "/index.html", target: "/" }];
    await cloudflarePackage(f.b, directory, routes);
    const calls = [];
    let pointer = "old";
    const provider = {
      currentWorkerDeployment: async () => ({ id: pointer }),
      deployGithub: async ({ key }) => {
        calls.push(key.startsWith("stage-") ? "stage" : "final");
        return { id: "mock" };
      },
      waitGithub: async () => {},
      uploadBackup: async () => {
        calls.push("backup");
        return { origin: "https://ac3af448.jji-backup-20261023.pages.dev/" };
      },
      uploadWorkerVersion: async () => {
        calls.push("version");
        return { version: "new" };
      },
      promoteWorker: async () => {
        calls.push("pointer");
        pointer = "new";
        return { id: pointer };
      },
    };
    const adapters = bindReleaseAdapters({
      provider,
      release: f.second,
      code: "illustrative code",
      packageRoot: f.b,
      routes,
      cloudflareDirectory: directory,
      expectedWorkerDeployment: "old",
      receiptRecorder: async () => f.proofB,
      writesApproved: true,
      githubArtifactFor: async () => ({}),
      inspectCurrent: async () => ({
        release: f.first.release,
        pointerCurrent: f.first.release,
        exclusivePublisher: true,
        primaryFiles: f.first.files,
      }),
      verifyPrimary: async (entries) => assert.ok(entries.length),
      verifyBackup: async (_origin, entries) => assert.ok(entries.length),
    });
    await coordinateRelease(f.b, adapters);
    assert.deepEqual(calls, ["stage", "backup", "version", "pointer", "final"]);
    calls.length = 0;
    await writeFile(path.join(f.source, "index.html"), "<h1>Approved C</h1>");
    const c = path.join(f.root, "c-bound-mismatch");
    await prepareRelease({ source: f.source, output: c, previous: f.b });
    await assert.rejects(coordinateRelease(c, adapters), /bound candidate/);
    await assert.rejects(
      adapters.publishAssetStage(path.join(c, "stage")),
      /bound candidate/,
    );
    assert.deepEqual(calls, []);
    await writeFile(
      path.join(directory, "PRIVATE-NOTE.txt"),
      "must never upload",
    );
    await assert.rejects(
      verifyCloudflareDirectory(f.b, directory, routes),
      /inventory/,
    );
    calls.length = 0;
    await assert.rejects(coordinateRelease(f.b, adapters), /inventory/);
    assert.deepEqual(calls, []);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("artifact storage planning uses measured files and fails closed at account headroom", async () => {
  const { artifactPlan } =
    await import("../../infrastructure/failover/artifact-plan.mjs");
  const f = await fixture();
  try {
    const snapshot = {
      accountUsedBytes: 10 * 1024 * 1024,
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
    };
    assert.ok(
      (await artifactPlan(f.b, f.a, snapshot)).peakBytes >
        snapshot.accountUsedBytes,
    );
    await assert.rejects(
      artifactPlan(f.b, f.a, { ...snapshot, freeStorageBytes: 100 }),
      /headroom/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("bootstrap stage preserves original HTML and roots, adds immutable bytes and requires verification", async () => {
  const f = await fixture();
  try {
    const output = path.join(f.root, "bootstrap");
    const meta = await prepareRelease({
      source: f.source,
      output,
      bootstrap: true,
    });
    assert.equal(meta.bootstrap, true);
    assert.equal(meta.releases.length, 1);
    assert.equal(
      await readFile(path.join(output, "stage/index.html"), "utf8"),
      await readFile(path.join(f.source, "index.html"), "utf8"),
    );
    await readFile(
      path.join(output, "stage/__jji_releases", meta.release, "style.css"),
    );
    await verifyPackage(output);
    const { artifactPlan } =
      await import("../../infrastructure/failover/artifact-plan.mjs");
    await artifactPlan(output, undefined, {
      accountUsedBytes: 0,
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
    await writeFile(path.join(output, "stage/index.html"), "tampered");
    await assert.rejects(verifyPackage(output), /digest/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
