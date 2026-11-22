import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIMITS, TARGET, preflight } from "./preflight.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const approvedHeaders = await readFile(
  new URL("../../_headers", import.meta.url),
);
async function fixture(
  t,
  files = [["index.html", Buffer.from("public fixture")]],
  headers = approvedHeaders,
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-manual-preflight-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = path.join(root, "public");
  await mkdir(folder);
  const entries = [];
  for (const [name, bytes] of [
    ...files,
    ...(headers ? [["_headers", headers]] : []),
  ]) {
    await mkdir(path.dirname(path.join(folder, name)), { recursive: true });
    await writeFile(path.join(folder, name), bytes);
    entries.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
  }
  const manifest = path.join(root, "manifest.json");
  async function seal(next = entries) {
    const raw = JSON.stringify(next);
    await writeFile(manifest, raw);
    return { ...TARGET, folder, manifest, expectedManifestSha256: hash(raw) };
  }
  return { root, folder, manifest, entries, seal, options: await seal() };
}

test("1000 selected files including both controls pass; 1001 fail", async (t) => {
  const files = Array.from({ length: 998 }, (_, i) => [
    `asset-${i}.txt`,
    Buffer.from("x"),
  ]);
  files.push(["_redirects", Buffer.from("/old / 301\n")]);
  const f = await fixture(t, files);
  const result = await preflight(f.options);
  assert.equal(result.files, 1000);
  assert.deepEqual(result.limits, { selectedFiles: 1000, fileBytes: 26214400 });
  await writeFile(path.join(f.folder, "extra.txt"), "x");
  const options = await f.seal([
    ...f.entries,
    { path: "extra.txt", bytes: 1, sha256: hash("x") },
  ]);
  await assert.rejects(preflight(options), /1000 selected files/);
});

test("25 MiB is inclusive and one byte above fails", async (t) => {
  const bytes = Buffer.alloc(LIMITS.fileBytes, 0x61);
  const f = await fixture(t, [["asset.bin", bytes]]);
  assert.equal((await preflight(f.options)).largestFileBytes, 26214400);
  const oversized = Buffer.concat([bytes, Buffer.from("x")]);
  await writeFile(path.join(f.folder, "asset.bin"), oversized);
  await assert.rejects(preflight(f.options), /Per-file limit/);
  const options = await f.seal([
    { path: "asset.bin", bytes: oversized.length, sha256: hash(oversized) },
  ]);
  await assert.rejects(
    preflight(options),
    /Per-file limit exceeded in manifest/,
  );
});

test("actual hashed folder above 256 MiB passes without an aggregate override", async (t) => {
  const bytes = Buffer.alloc(LIMITS.fileBytes, 0x62);
  const f = await fixture(
    t,
    Array.from({ length: 11 }, (_, i) => [`asset-${i}.bin`, bytes]),
  );
  const result = await preflight(f.options);
  assert.equal(result.totalBytes, 288358400 + approvedHeaders.length);
  assert.ok(result.totalBytes > 256 * 1024 * 1024);
  assert.equal(result.providerAdmission, false);
  assert.equal(result.billingAdmission, false);
  assert.equal(result.publication, false);
  assert.equal("ceilingBytes" in result, false);
});

test("provider, project and role must match the manual forward route", async (t) => {
  const f = await fixture(t);
  for (const field of ["provider", "project", "role"]) {
    await assert.rejects(
      preflight({ ...f.options, [field]: "other" }),
      /Wrong manual route/,
    );
  }
});

test("forward packages require the approved header even if a bad manifest is resealed", async (t) => {
  const missing = await fixture(t, undefined, null);
  await assert.rejects(
    preflight(missing.options),
    /Missing or unapproved primary Pages _headers/,
  );
  const changed = await fixture(
    t,
    undefined,
    Buffer.concat([approvedHeaders, Buffer.from("\n")]),
  );
  await assert.rejects(
    preflight(changed.options),
    /Missing or unapproved primary Pages _headers/,
  );
  const removed = await fixture(t);
  await rm(path.join(removed.folder, "_headers"));
  await assert.rejects(preflight(removed.options), /Missing file from exact manifest/);
});

test("external manifest hash, content tampering, missing and extra files fail", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    preflight({ ...f.options, expectedManifestSha256: "0".repeat(64) }),
    /SHA-256 mismatch/,
  );
  await assert.rejects(
    preflight({ ...f.options, expectedManifestSha256: "invalid" }),
    /SHA-256 required/,
  );
  await writeFile(path.join(f.folder, "index.html"), "tampered");
  await assert.rejects(preflight(f.options), /differs from exact manifest/);
  await rm(path.join(f.folder, "index.html"));
  await assert.rejects(preflight(f.options), /Missing file/);
  await writeFile(path.join(f.folder, "index.html"), "public fixture");
  await writeFile(path.join(f.folder, "extra.txt"), "extra");
  await assert.rejects(preflight(f.options), /Extra file/);
});

test("traversal, absolute paths, duplicate entries and invalid sizes fail", async (t) => {
  const f = await fixture(t);
  for (const name of [
    "../outside.txt",
    "/absolute.txt",
    "a/../index.html",
    "a\\index.html",
    "a//index.html",
    "%2e%2e/index.html",
  ]) {
    await assert.rejects(
      preflight(await f.seal([{ ...f.entries[0], path: name }])),
      /Unsafe public path/,
    );
  }
  await assert.rejects(
    preflight(await f.seal([f.entries[0], f.entries[0]])),
    /duplicate manifest/,
  );
  for (const bytes of [-1, 1.5, "14"]) {
    await assert.rejects(
      preflight(await f.seal([{ ...f.entries[0], bytes }])),
      /Invalid or duplicate/,
    );
  }
});

test("private documents and executable route paths are excluded even when hashed", async (t) => {
  const f = await fixture(t);
  for (const name of [
    "docs/report.txt",
    "records/receipt.json",
    "research/meda.pdf",
    "statement.docx",
    "AGENTS.md",
    ".env",
    "functions/index.js",
    "_worker.js",
    "_worker.js/index.js",
    "_routes.json",
    "wrangler.toml",
    "netlify.toml",
  ]) {
    await assert.rejects(
      preflight(await f.seal([{ ...f.entries[0], path: name }])),
      /Unsafe public path|path forbidden/,
    );
  }
  await f.seal();
  await mkdir(path.join(f.folder, "functions"));
  await assert.rejects(preflight(f.options), /path forbidden/);
});

test("file, directory, root and manifest symlinks fail", async (t) => {
  const f = await fixture(t);
  const outside = path.join(f.root, "outside.html");
  await writeFile(outside, "public fixture");
  await rm(path.join(f.folder, "index.html"));
  await symlink(outside, path.join(f.folder, "index.html"));
  await assert.rejects(preflight(f.options), /Symlink forbidden/);
  await rm(path.join(f.folder, "index.html"));
  await writeFile(path.join(f.folder, "index.html"), "public fixture");
  await symlink(f.root, path.join(f.folder, "linked"));
  await assert.rejects(preflight(f.options), /Symlink forbidden/);
  await rm(path.join(f.folder, "linked"));
  const rootLink = path.join(f.root, "linked-public");
  await symlink(f.folder, rootLink);
  await assert.rejects(
    preflight({ ...f.options, folder: rootLink }),
    /symlink roots/,
  );
  const manifestLink = path.join(f.root, "linked-manifest.json");
  await symlink(f.manifest, manifestLink);
  await assert.rejects(
    preflight({ ...f.options, manifest: manifestLink }),
    /Manifest.*symlink/,
  );
});

test("CLI verifies a folder and rejects an archive path without ZIP claims", async (t) => {
  const f = await fixture(t);
  const script = fileURLToPath(new URL("./preflight.mjs", import.meta.url));
  const args = [
    script,
    TARGET.provider,
    TARGET.project,
    TARGET.role,
    f.folder,
    f.manifest,
    f.options.expectedManifestSha256,
  ];
  const good = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(good.status, 0, good.stderr);
  assert.equal(JSON.parse(good.stdout).status, "local-preflight-passed");
  const archive = path.join(f.root, "package.zip");
  await writeFile(archive, "not a folder");
  args[4] = archive;
  const bad = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /real folder.*archives/);
});
