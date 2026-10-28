// Local proposal: one manual GitHub-only content publication or exact rollback.
// Reuses the reviewed read-only recovery builder; never calls Cloudflare writes.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hash,
  manifest,
  verify,
  prepare as baselinePrepare,
  liveArtifacts,
} from "../recovery-assets/helper.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
export const C = JSON.parse(
  await fs.readFile(path.join(here, "config.json"), "utf8"),
);
const fail = (m) => {
  throw Error(m);
};
const integer = (x) => Number.isSafeInteger(x) && x >= 0;
export async function requireCurrentMain(token, expected, fetcher = fetch) {
  if (!token) fail("Existing built-in read token required");
  const response = await fetcher(
    `https://api.github.com/repos/${C.repo}/git/ref/heads/main`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok || (await response.json()).object?.sha !== expected)
    fail("Remote main changed or unavailable");
}
export function role(name) {
  if (!["primary", "rollback"].includes(name)) fail("Unapproved role");
  return C.roles[name];
}
async function load(name, expected) {
  const file = path.join(here, "inputs", name + "-manifest.json");
  const st = await fs.lstat(file);
  if (!st.isFile() || st.isSymbolicLink()) fail("Unsafe manifest");
  const b = await fs.readFile(file);
  if (hash(b) !== expected) fail("Pinned manifest mismatch");
  return manifest(JSON.parse(b));
}
export async function inputs(name) {
  const target = await load(name, role(name).manifestSha256),
    overlay = await load("overlay", C.overlayHash),
    sources = await load("source", C.sourceHash);
  const baselineFile = path.join(
    here,
    "../recovery-assets/inputs/union-manifest.json",
  );
  const b = await fs.readFile(baselineFile);
  if (hash(b) !== C.baselineManifestSha256) fail("Baseline manifest changed");
  const base = manifest(JSON.parse(b));
  if (
    base.length !== 522 ||
    target.length !== role(name).files ||
    target.reduce((n, e) => n + e.bytes, 0) !== role(name).bytes ||
    role(name).bytes > C.cap
  )
    fail("Pinned totals/cap mismatch");
  const expected = new Map(base.map((e) => [e.path, e]));
  for (const e of overlay) {
    if (e.path.startsWith("__jji_releases/") || e.path.startsWith("."))
      fail("Immutable/hidden overlay forbidden");
    if (name === "primary" || !expected.has(e.path)) expected.set(e.path, e);
  }
  const sort = (a) =>
    a
      .map((e) => ({ path: e.path, bytes: e.bytes, sha256: e.sha256 }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (
    JSON.stringify(sort([...expected.values()])) !==
    JSON.stringify(sort(target))
  )
    fail("Target not exact reviewed overlay");
  await verify(path.join(here, "payload"), overlay);
  const root = path.resolve(here, "../..");
  for (const e of sources) {
    let at = root;
    for (const component of e.path.split("/")) {
      at = path.join(at, component);
      const st = await fs.lstat(at);
      if (st.isSymbolicLink()) fail("Source symlink rejected");
    }
    const bytes = await fs.readFile(at);
    if (bytes.length !== e.bytes || hash(bytes) !== e.sha256)
      fail("Reviewed source changed: " + e.path);
  }
  return { base, overlay, target };
}
export async function assemble(output, name, { readBaseline } = {}) {
  const { base, overlay, target } = await inputs(name);
  await baselinePrepare(output, { readBaseline });
  const old = new Set(base.map((e) => e.path));
  for (const e of overlay) {
    if (name === "rollback" && old.has(e.path)) continue;
    const b = await fs.readFile(path.join(here, "payload", e.path));
    const dest = path.join(output, e.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, b, {
      flag: old.has(e.path) ? "w" : "wx",
      mode: 0o644,
    });
  }
  await verify(output, target);
  return {
    role: name,
    files: target.length,
    bytes: role(name).bytes,
    manifestSha256: role(name).manifestSha256,
  };
}
export function context(env) {
  const name = env.RELEASE_ROLE;
  role(name);
  if (
    env.GITHUB_REPOSITORY !== C.repo ||
    env.GITHUB_ACTOR !== C.actor ||
    env.GITHUB_TRIGGERING_ACTOR !== C.actor ||
    env.GITHUB_RUN_ATTEMPT !== "1" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || "") ||
    env.APPROVED_WORKFLOW_COMMIT !== env.GITHUB_SHA ||
    env.APPROVED_MANIFEST_SHA256 !== role(name).manifestSha256 ||
    env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    env.RUNNER_OS !== "Linux"
  )
    fail("Unapproved dispatch context");
  return name;
}

// Admission logic below is adapted narrowly from the independently reviewed recovery helper.
// Complete account/Packages/budget evidence is owner supplied; built-in token verifies this repo.
export function admission(s, live, sha, now = Date.now(), name = "primary") {
  if (
    !s ||
    s.schema !== 1 ||
    !integer(s.observedAt) ||
    now - s.observedAt > 900000 ||
    s.observedAt > now ||
    s.workflowCommit !== sha ||
    s.manifestSha256 !== role(name).manifestSha256 ||
    s.ownerReviewed !== true ||
    s.actionsSpendingBlocked !== true ||
    s.packagesSpendingBlocked !== true ||
    s.publicStandardRunner !== true ||
    s.otherPublishersPaused !== true ||
    s.otherUploadsSerialized !== true ||
    s.accountInventoryComplete !== true ||
    s.packagesComplete !== true ||
    !integer(s.packageBytes) ||
    !Array.isArray(s.repositories) ||
    !s.repositories.length
  )
    fail("Fresh complete owner-reviewed $0 admission required");
  let used = s.packageBytes,
    target;
  const ids = new Set();
  for (const r of s.repositories) {
    if (
      typeof r.identity !== "string" ||
      ids.has(r.identity) ||
      r.complete !== true ||
      !Array.isArray(r.artifacts)
    )
      fail("Incomplete inventory");
    ids.add(r.identity);
    const seen = new Set();
    for (const a of r.artifacts) {
      if (
        !Number.isSafeInteger(a.id) ||
        a.id < 1 ||
        seen.has(a.id) ||
        !integer(a.bytes)
      )
        fail("Invalid artifact inventory");
      seen.add(a.id);
      used += a.bytes;
    }
    if (r.identity === C.repo) target = r.artifacts;
  }
  if (!target || !Number.isSafeInteger(used)) fail("Target inventory missing");
  const norm = (a) =>
    JSON.stringify(
      a.map((x) => ({ id: x.id, bytes: x.bytes })).sort((a, b) => a.id - b.id),
    );
  if (norm(target) !== norm(live)) fail("Live repository inventory changed");
  // Before primary publication, retain room for both this upload and one full
  // rollback upload. On a rollback run, its live inventory already includes any
  // retained primary artifact; reserve only the new rollback upload once.
  const reservedUploads = name === "primary" ? 2 : 1;
  const totalUploadReserve = C.reserve * reservedUploads;
  const peak = used + totalUploadReserve + C.margin;
  let ceiling;
  if (s.mode === "authoritative") {
    if (
      s.authoritativeCapacityVerified !== true ||
      !integer(s.capacityCeilingBytes)
    )
      fail("Authoritative capacity unavailable");
    ceiling = Math.min(C.ceiling, s.capacityCeilingBytes);
  } else if (s.mode === "logical-inventory" && s.logicalPolicyApproved === true)
    ceiling = C.ceiling;
  else fail("Storage policy approval missing");
  if (peak > ceiling) fail(`Reservation exceeds ceiling: ${peak} > ${ceiling}`);
  return {
    usedBytes: used,
    peakBytes: peak,
    uploadReserve: C.reserve,
    reservedUploads,
    totalUploadReserve,
    margin: C.margin,
    mode: s.mode,
    providerAcceptanceUnproved: true,
  };
}
async function main() {
  const command = process.argv[2],
    name = context(process.env);
  await inputs(name);
  if (command === "guard" || command === "admit")
    await requireCurrentMain(process.env.GH_READ_TOKEN, process.env.GITHUB_SHA);
  if (command === "guard")
    console.log("Exact role, source and owner context verified");
  else if (command === "admit")
    console.log(
      JSON.stringify(
        admission(
          JSON.parse(process.env.STORAGE_SNAPSHOT || "null"),
          await liveArtifacts(process.env.GH_READ_TOKEN),
          process.env.GITHUB_SHA,
          Date.now(),
          name,
        ),
      ),
    );
  else if (command === "assemble")
    console.log(JSON.stringify(await assemble(process.argv[3], name)));
  else if (command === "verify") {
    await verify(process.argv[3], (await inputs(name)).target);
    console.log("Exact deployment tree verified");
  } else fail("Unknown command");
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
