// Read-only folder verification for the manual Pages dashboard route.
// No provider calls, aggregate byte ceiling, upload or deployment authority.
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertPrimaryPagesHeadersDigest } from "../../scripts/primary-pages-headers.mjs";

export const TARGET = Object.freeze({
  provider: "cloudflare-pages-manual",
  project: "jji-primary-20261027",
  role: "capability-pdf-forward",
});
export const LIMITS = Object.freeze({
  selectedFiles: 1000,
  fileBytes: 25 * 1024 * 1024,
});
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha256 = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const privateDirectories = new Set([
  "capture",
  "docs",
  "infrastructure",
  "node_modules",
  "partials",
  "private",
  "records",
  "research",
  "scripts",
  "tests",
  "tools",
  "functions",
]);
const privateFiles = new Set([
  "agents.md",
  "skill.md",
  "package.json",
  "package-lock.json",
  "netlify.toml",
  "_worker.js",
  "_routes.json",
]);

function publicPath(name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.includes("\\") ||
    name.includes("%") ||
    /[\x00-\x1f\x7f]/.test(name) ||
    path.posix.isAbsolute(name) ||
    path.posix.normalize(name) !== name ||
    name.split("/").some((part) => !part || part.startsWith("."))
  )
    throw new Error("Unsafe public path");
  const parts = name.toLowerCase().split("/");
  if (
    parts.some(
      (part) =>
        privateDirectories.has(part) ||
        privateFiles.has(part) ||
        /^wrangler\.(?:jsonc?|toml)$/.test(part) ||
        /\.(?:docx?|md)$/i.test(part),
    )
  )
    throw new Error(`Private or executable-route path forbidden: ${name}`);
  return name;
}

function parseManifest(raw) {
  const entries = JSON.parse(raw);
  if (
    !Array.isArray(entries) ||
    !entries.length ||
    entries.length > LIMITS.selectedFiles
  )
    throw new Error(
      "Manifest must contain 1 to 1000 selected files, including controls",
    );
  const expected = new Map();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      Object.keys(entry).sort().join(",") !== "bytes,path,sha256"
    )
      throw new Error("Invalid manifest entry fields");
    publicPath(entry.path);
    if (
      expected.has(entry.path) ||
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes < 0 ||
      !sha256(entry.sha256)
    )
      throw new Error("Invalid or duplicate manifest entry");
    if (entry.bytes > LIMITS.fileBytes)
      throw new Error("Per-file limit exceeded in manifest");
    expected.set(entry.path, entry);
  }
  return expected;
}

async function fileIdentity(file) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error("Only regular files are supported");
    if (before.size > LIMITS.fileBytes)
      throw new Error("Per-file limit exceeded");
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      bytes += chunk.length;
      if (bytes > LIMITS.fileBytes)
        throw new Error("Per-file limit exceeded while reading");
      hash.update(chunk);
    }
    const after = await handle.stat();
    if (
      bytes !== before.size ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      throw new Error("File changed during verification");
    return { bytes, sha256: hash.digest("hex") };
  } finally {
    await handle.close();
  }
}

export async function preflight({
  provider,
  project,
  role,
  folder,
  manifest,
  expectedManifestSha256,
}) {
  if (
    provider !== TARGET.provider ||
    project !== TARGET.project ||
    role !== TARGET.role
  )
    throw new Error("Wrong manual route provider, project or role");
  if (!sha256(expectedManifestSha256))
    throw new Error("External manifest SHA-256 required");
  if (
    typeof folder !== "string" ||
    !folder ||
    typeof manifest !== "string" ||
    !manifest
  )
    throw new Error("Folder and external manifest paths required");
  const folderPath = path.resolve(folder);
  const folderStat = await lstat(folderPath);
  if (folderStat.isSymbolicLink() || !folderStat.isDirectory())
    throw new Error(
      "A real folder is required; archives and symlink roots are unsupported",
    );
  const manifestStat = await lstat(manifest);
  if (manifestStat.isSymbolicLink() || !manifestStat.isFile())
    throw new Error("Manifest must be a regular file, not a symlink");
  const raw = await readFile(manifest);
  if (digest(raw) !== expectedManifestSha256)
    throw new Error("External manifest SHA-256 mismatch");
  const expected = parseManifest(raw);
  assertPrimaryPagesHeadersDigest(expected.get("_headers")?.sha256);
  const found = new Set();
  let totalBytes = 0;
  let largestFileBytes = 0;
  async function walk(relative = "") {
    for (const name of (
      await readdir(path.join(folderPath, relative))
    ).sort()) {
      const rel = publicPath(relative ? `${relative}/${name}` : name);
      const file = path.join(folderPath, rel);
      const stat = await lstat(file);
      if (stat.isSymbolicLink()) throw new Error(`Symlink forbidden: ${rel}`);
      if (stat.isDirectory()) {
        await walk(rel);
        continue;
      }
      if (!stat.isFile()) throw new Error(`Non-regular file forbidden: ${rel}`);
      found.add(rel);
      if (found.size > LIMITS.selectedFiles)
        throw new Error("Selected-file limit exceeded, including controls");
      const entry = expected.get(rel);
      if (!entry) throw new Error(`Extra file outside exact manifest: ${rel}`);
      const actual = await fileIdentity(file);
      if (actual.bytes !== entry.bytes || actual.sha256 !== entry.sha256)
        throw new Error(`File differs from exact manifest: ${rel}`);
      totalBytes += actual.bytes;
      largestFileBytes = Math.max(largestFileBytes, actual.bytes);
    }
  }
  await walk();
  if (found.size !== expected.size)
    throw new Error("Missing file from exact manifest");
  return {
    status: "local-preflight-passed",
    provider,
    project,
    role,
    manifestSha256: expectedManifestSha256,
    files: found.size,
    totalBytes,
    largestFileBytes,
    limits: LIMITS,
    aggregateLimit:
      "No aggregate byte limit specified in the cited dashboard documentation",
    providerAdmission: false,
    billingAdmission: false,
    publication: false,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 6)
      throw new Error(
        "Usage: node preflight.mjs PROVIDER PROJECT ROLE FOLDER MANIFEST EXPECTED_MANIFEST_SHA256",
      );
    const [provider, project, role, folder, manifest, expectedManifestSha256] =
      args;
    console.log(
      JSON.stringify(
        await preflight({
          provider,
          project,
          role,
          folder,
          manifest,
          expectedManifestSha256,
        }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
