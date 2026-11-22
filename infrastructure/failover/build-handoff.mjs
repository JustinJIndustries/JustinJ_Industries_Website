// Build output is untrusted. Only the protected owner's release digest admits
// paths, and only regular Git blobs from the exact source commit supply bytes.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PUBLIC_TREE_LIMIT } from "./package-limits.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifestLimit = 96 * 1024; // below the hosted Linux single-env-string limit
export async function describe(root) {
  const entries = [];
  async function walk(rel) {
    for (const item of await readdir(path.join(root, rel), {
      withFileTypes: true,
    })) {
      const name = path.posix.join(rel, item.name);
      if (item.isDirectory()) await walk(name);
      else if (item.isFile())
        entries.push({
          path: name,
          sha256: digest(await readFile(path.join(root, name))),
        });
      else throw new Error("Non-regular public input");
    }
  }
  await walk("");
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const manifest = JSON.stringify(entries);
  if (Buffer.byteLength(manifest) > manifestLimit)
    throw new Error("Manifest exceeds handoff limit");
  return manifest;
}

export async function restore(
  root,
  manifest,
  source,
  release,
  cwd = process.cwd(),
) {
  if (
    typeof manifest !== "string" ||
    Buffer.byteLength(manifest) > manifestLimit ||
    !/^[0-9a-f]{40}$/.test(source) ||
    digest("jji-release-schema-1\n" + manifest) !== release
  )
    throw new Error("Source or owner-approved manifest mismatch");
  const entries = JSON.parse(manifest);
  if (!Array.isArray(entries) || !entries.length || entries.length > 2000)
    throw new Error("Invalid release inventory");
  const git = (args, maxBuffer = 8 * 1024 * 1024) =>
    execFileSync("git", args, {
      cwd,
      maxBuffer,
      stdio: ["ignore", "pipe", "pipe"],
    });
  if (
    git(["rev-parse", "--verify", source + "^{commit}"])
      .toString()
      .trim() !== source
  )
    throw new Error("Unverified source commit");
  const blobs = new Map();
  for (const row of git(["ls-tree", "-r", "-z", source])
    .toString()
    .split("\0")) {
    const match = /^100644 blob ([a-f0-9]{40})\t(.+)$/.exec(row);
    if (match) blobs.set(match[2], match[1]);
  }
  let total = 0,
    previous = "";
  await mkdir(root); // private fresh runner directory, never reuse partial state
  for (const entry of entries) {
    const name = entry.path;
    if (
      typeof name !== "string" ||
      Object.keys(entry).join() !== "path,sha256" ||
      name <= previous ||
      !/^[a-zA-Z0-9@_-][a-zA-Z0-9@._/-]*$/.test(name) ||
      name
        .split("/")
        .some(
          (p) =>
            !p ||
            p.startsWith(".") ||
            [
              "node_modules",
              "infrastructure",
              "scripts",
              "functions",
              "tests",
              "docs",
              "__jji_releases",
            ].includes(p),
        ) ||
      /(^|\/)(_worker\.js|wrangler\.[^/]+)(\/|$)/i.test(name) ||
      !/\.(html|js|css|svg|png|webp|ico|jpg|jpeg|mp4|vtt|pdf|txt|xml)$/.test(
        name,
      ) ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
      throw new Error("Unsafe public manifest entry");
    previous = name;
    const blob =
      blobs.get(name) ??
      (name.endsWith("/index.html") &&
        blobs.get(name.replace(/\/index\.html$/, ".html")));
    if (!blob) throw new Error("Public file missing from approved Git source");
    const size = Number(git(["cat-file", "-s", blob]));
    total += size;
    if (!Number.isSafeInteger(total) || total > PUBLIC_TREE_LIMIT)
      throw new Error("Public byte budget exceeded");
    const bytes = git(["cat-file", "blob", blob], size + 1024);
    if (bytes.length !== size || digest(bytes) !== entry.sha256)
      throw new Error("Public blob digest mismatch");
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [operation, directory] = process.argv.slice(2);
  if (operation === "describe")
    await appendFile(
      process.env.GITHUB_OUTPUT,
      "manifest=" + (await describe(directory)) + "\n",
    );
  else if (operation === "restore")
    await restore(
      directory,
      process.env.BUILD_MANIFEST,
      process.env.SOURCE_COMMIT,
      process.env.APPROVED_RELEASE,
    );
  else throw new Error("Unknown build handoff operation");
}
