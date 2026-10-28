import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  C,
  role,
  context,
  admission,
  inputs,
  assemble,
  requireCurrentMain,
} from "./helper.mjs";
import { verify, hash } from "../recovery-assets/helper.mjs";
const sha = "a".repeat(40),
  now = 1800000000000;
const env = {
  RELEASE_ROLE: "primary",
  GITHUB_REPOSITORY: C.repo,
  GITHUB_ACTOR: C.actor,
  GITHUB_TRIGGERING_ACTOR: C.actor,
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: sha,
  APPROVED_WORKFLOW_COMMIT: sha,
  APPROVED_MANIFEST_SHA256: C.roles.primary.manifestSha256,
  RUNNER_ENVIRONMENT: "github-hosted",
  RUNNER_OS: "Linux",
};
// Positive admission fixtures model verified post-removal inventory only.
// The actual current full inventory is separately required to refuse primary.
const inventory = [
  { id: 12601233072, bytes: 375691 },
  { id: 12573319352, bytes: 261358 },
];
const currentInventory = [{ id: 12753979710, bytes: 184822551 }, ...inventory];
const snapshot = () => ({
  schema: 1,
  observedAt: now,
  workflowCommit: sha,
  manifestSha256: C.roles.primary.manifestSha256,
  ownerReviewed: true,
  actionsSpendingBlocked: true,
  packagesSpendingBlocked: true,
  publicStandardRunner: true,
  otherPublishersPaused: true,
  otherUploadsSerialized: true,
  accountInventoryComplete: true,
  packagesComplete: true,
  packageBytes: 0,
  repositories: [{ identity: C.repo, complete: true, artifacts: inventory }],
  mode: "logical-inventory",
  logicalPolicyApproved: true,
});
test("remote main must remain the approved dispatch commit", async () => {
  const response = (value) => async () => ({
    ok: true,
    json: async () => ({ object: { sha: value } }),
  });
  await requireCurrentMain("fixture-not-a-credential", sha, response(sha));
  await assert.rejects(() => requireCurrentMain("", sha, response(sha)));
  await assert.rejects(() =>
    requireCurrentMain(
      "fixture-not-a-credential",
      sha,
      response("b".repeat(40)),
    ),
  );
  await assert.rejects(() =>
    requireCurrentMain("fixture-not-a-credential", sha, async () => ({
      ok: false,
    })),
  );
});
test("exact owner and original attempt accepted for both roles", () => {
  assert.equal(context(env), "primary");
  assert.equal(
    context({
      ...env,
      RELEASE_ROLE: "rollback",
      APPROVED_MANIFEST_SHA256: C.roles.rollback.manifestSha256,
    }),
    "rollback",
  );
});
for (const [key, value] of Object.entries({
  GITHUB_TRIGGERING_ACTOR: "other",
  GITHUB_ACTOR: "other",
  GITHUB_RUN_ATTEMPT: "2",
  GITHUB_REF: "refs/heads/other",
  GITHUB_EVENT_NAME: "push",
  APPROVED_WORKFLOW_COMMIT: "b".repeat(40),
  APPROVED_MANIFEST_SHA256: "0".repeat(64),
  RUNNER_ENVIRONMENT: "self-hosted",
  RELEASE_ROLE: "../primary",
}))
  test("context refuses " + key, () =>
    assert.throws(() => context({ ...env, [key]: value })),
  );
test("logical admission is only an estimate", () => {
  const x = admission(snapshot(), inventory, sha, now);
  assert.equal(x.peakBytes, 480542215);
  assert.equal(x.reservedUploads, 2);
  assert.equal(x.totalUploadReserve, 456836494);
  assert.equal(x.providerAcceptanceUnproved, true);
});
test("actual current three-artifact inventory refuses primary before upload", () => {
  const s = snapshot();
  s.repositories[0].artifacts = currentInventory;
  assert.throws(
    () => admission(s, currentInventory, sha, now),
    /665364766 > 500000000/,
  );
});
test("rollback reserves one new upload with existing primary already counted", () => {
  const s = snapshot();
  s.manifestSha256 = C.roles.rollback.manifestSha256;
  s.repositories[0].artifacts = currentInventory;
  const x = admission(s, currentInventory, sha, now, "rollback");
  assert.equal(x.reservedUploads, 1);
  assert.equal(x.peakBytes, 436946519);
});
test("worst-case retained primary plus rollback stays inside the original primary reservation", () => {
  const live = [...inventory, { id: 99999999999, bytes: C.reserve }];
  const s = snapshot();
  s.manifestSha256 = C.roles.rollback.manifestSha256;
  s.repositories[0].artifacts = live;
  assert.equal(admission(s, live, sha, now, "rollback").peakBytes, 480542215);
});
test("two-upload admission accepts exact ceiling and refuses one byte above", () => {
  const s = snapshot();
  s.packageBytes = 19457785;
  assert.equal(admission(s, inventory, sha, now).peakBytes, C.ceiling);
  s.packageBytes++;
  assert.throws(
    () => admission(s, inventory, sha, now),
    /500000001 > 500000000/,
  );
});
for (const key of [
  "ownerReviewed",
  "actionsSpendingBlocked",
  "packagesSpendingBlocked",
  "otherPublishersPaused",
  "otherUploadsSerialized",
  "accountInventoryComplete",
  "packagesComplete",
  "publicStandardRunner",
  "logicalPolicyApproved",
])
  test("admission refuses missing " + key, () => {
    const s = snapshot();
    s[key] = false;
    assert.throws(() => admission(s, inventory, sha, now));
  });
test("expired and future snapshots refuse", () => {
  for (const age of [900001, -1]) {
    const s = snapshot();
    s.observedAt = now - age;
    assert.throws(() => admission(s, inventory, sha, now));
  }
});
test("changed live inventory and overlapping capacity refuse", () => {
  assert.throws(() => admission(snapshot(), [], sha, now));
  const s = snapshot();
  s.packageBytes = 100000000;
  assert.throws(() => admission(s, inventory, sha, now));
});
test("incomplete and duplicate inventory refuse", () => {
  const s = snapshot();
  s.repositories[0].complete = false;
  assert.throws(() => admission(s, inventory, sha, now));
  const t = snapshot();
  t.repositories.push(t.repositories[0]);
  assert.throws(() => admission(t, inventory, sha, now));
});
test("wrong manifest or source binding refuses", () => {
  const s = snapshot();
  s.manifestSha256 = C.roles.rollback.manifestSha256;
  assert.throws(() => admission(s, inventory, sha, now));
  const t = snapshot();
  t.workflowCommit = "b".repeat(40);
  assert.throws(() => admission(t, inventory, sha, now));
});
test("exact payload and immutable preservation in both manifests", async () => {
  const primary = await inputs("primary"),
    rollback = await inputs("rollback");
  for (const e of primary.base) {
    if (e.path.startsWith("__jji_releases/"))
      assert.deepEqual(
        primary.target.find((x) => x.path === e.path),
        e,
      );
    assert.deepEqual(
      rollback.target.find((x) => x.path === e.path),
      e,
    );
  }
  assert.equal(primary.overlay.length, 87);
});
test("tree verifier rejects missing, extra, corrupt and symlink bytes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jji-content-fixture-"));
  const file = path.join(dir, "ok");
  await fs.writeFile(file, "ok");
  const list = [{ path: "ok", bytes: 2, sha256: hash(Buffer.from("ok")) }];
  await verify(dir, list);
  await fs.writeFile(file, "no");
  await assert.rejects(() => verify(dir, list));
  await fs.writeFile(file, "ok");
  await fs.writeFile(path.join(dir, "extra"), "x");
  await assert.rejects(() => verify(dir, list));
  await fs.unlink(path.join(dir, "extra"));
  await fs.unlink(file);
  await fs.symlink("/etc/hosts", file);
  await assert.rejects(() => verify(dir, list));
  await fs.rm(dir, { recursive: true });
});
test(
  "actual primary and rollback reconstruct without network or source execution",
  { skip: !process.env.LOCAL_BASELINE_ROOT },
  async () => {
    const baseline = process.env.LOCAL_BASELINE_ROOT;
    for (const name of ["primary", "rollback"]) {
      const output = path.join(process.env.LOCAL_OUTPUT_ROOT, name);
      const r = await assemble(output, name, {
        readBaseline: (e) => fs.readFile(path.join(baseline, e.path)),
      });
      assert.equal(r.files, 523);
      await assert.rejects(() =>
        assemble(output, name, {
          readBaseline: (e) => fs.readFile(path.join(baseline, e.path)),
        }),
      );
    }
  },
);
