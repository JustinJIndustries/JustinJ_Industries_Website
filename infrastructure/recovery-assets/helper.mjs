// One-purpose recovery publisher. Downloads are treated as bytes, never executed.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
export const C = Object.freeze({
  repo: "JustinJIndustries/JustinJ_Industries_Website",
  actor: "JustinJIndustries",
  origin: "https://ff985302.jji-backup-20261023.pages.dev",
  unionBytes: 189885164,
  unionFiles: 522,
  overlayBytes: 3674963,
  overlayFiles: 117,
  reserve: 227862197,
  margin: 23068672,
  ceiling: 500000000,
  baseHash: "a0bb758ac74abce886a92e22684bfd13e6fc39a057b42953ca2b987e7f1d088d",
  overlayHash:
    "adb508da2f5aeaa5966df138a9dc7ec124970a134fa557a53c55b42e0c554733",
  unionHash: "73bb780680caf50b781da278b4c79f4959cf7001e9056f6c8041edd3993de304",
});
export const hash = (b) => createHash("sha256").update(b).digest("hex");
const fail = (m) => {
  throw Error(m);
};
const integer = (x) => Number.isSafeInteger(x) && x >= 0;
export function safe(p) {
  if (
    typeof p !== "string" ||
    p.length > 512 ||
    !p ||
    p.includes("\\") ||
    p.includes("%") ||
    p.split("/").some((x) => !x || x === "." || x === "..") ||
    p.startsWith("/") ||
    /[\x00-\x1f\x7f]/.test(p)
  )
    fail("Unsafe path");
  return p;
}
export function manifest(a) {
  if (!Array.isArray(a) || !a.length) fail("Manifest required");
  const seen = new Set();
  for (const e of a) {
    safe(e.path);
    if (
      seen.has(e.path) ||
      !integer(e.bytes) ||
      !/^[a-f0-9]{64}$/.test(e.sha256)
    )
      fail("Invalid/duplicate manifest");
    seen.add(e.path);
  }
  return a;
}
export async function inputs(root = here) {
  const load = async (n, expected) => {
    const file = path.join(root, "inputs", n + "-manifest.json");
    const st = await fs.lstat(file);
    if (!st.isFile() || st.isSymbolicLink())
      fail("Manifest symlink/type rejected");
    const b = await fs.readFile(file);
    if (hash(b) !== expected) fail("Pinned manifest digest mismatch");
    return manifest(JSON.parse(b));
  };
  const base = await load("baseline", C.baseHash),
    overlay = await load("overlay", C.overlayHash),
    union = await load("union", C.unionHash);
  if (
    base.length !== 405 ||
    overlay.length !== 117 ||
    union.length !== 522 ||
    overlay.reduce((n, e) => n + e.bytes, 0) !== C.overlayBytes ||
    union.reduce((n, e) => n + e.bytes, 0) !== C.unionBytes
  )
    fail("Pinned totals mismatch");
  const old = new Map(base.map((x) => [x.path, x]));
  for (const e of overlay)
    if (
      old.has(e.path) ||
      !/^__jji_releases\/(?:3f80185c86e66258b986039316607640109caf5f46c9ba419e78249a35f86b5f|fe321dd483f3b28b4b66dec22ad10191f883b3bdab0c990455aa7bd2aea59a34)\//.test(
        e.path,
      )
    )
      fail("Overlay scope conflict");
  if (
    JSON.stringify(
      [...base, ...overlay].sort((a, b) =>
        a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
      ),
    ) !== JSON.stringify(union)
  )
    fail("Union mismatch");
  return { base, overlay, union };
}
export async function walk(root, prefix = "") {
  const st = await fs.lstat(root);
  if (!st.isDirectory() || st.isSymbolicLink()) fail("Unsafe root");
  const files = [];
  for (const x of await fs.readdir(root, { withFileTypes: true })) {
    const rel = prefix + x.name;
    safe(rel);
    if (x.isSymbolicLink()) fail("Symlink rejected");
    if (x.isDirectory())
      files.push(...(await walk(path.join(root, x.name), rel + "/")));
    else if (x.isFile()) files.push(rel);
    else fail("Unsupported file");
  }
  return files.sort();
}
export async function verify(root, list) {
  const names = await walk(root);
  if (JSON.stringify(names) !== JSON.stringify(list.map((x) => x.path).sort()))
    fail("Unexpected/missing tree files");
  for (const e of list) {
    const b = await fs.readFile(path.join(root, e.path));
    if (b.length !== e.bytes || hash(b) !== e.sha256)
      fail("File integrity: " + e.path);
  }
  return true;
}
export function context(env) {
  if (
    env.GITHUB_REPOSITORY !== C.repo ||
    env.GITHUB_ACTOR !== C.actor ||
    env.GITHUB_TRIGGERING_ACTOR !== C.actor ||
    env.GITHUB_RUN_ATTEMPT !== "1" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || "") ||
    env.APPROVED_WORKFLOW_COMMIT !== env.GITHUB_SHA ||
    env.APPROVED_UNION_SHA256 !== C.unionHash ||
    env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    env.RUNNER_OS !== "Linux"
  )
    fail("Unapproved dispatch context");
}
export function admission(s, live, sha, now = Date.now()) {
  if (
    !s ||
    s.schema !== 1 ||
    !integer(s.observedAt) ||
    now - s.observedAt > 900000 ||
    s.observedAt > now ||
    s.workflowCommit !== sha ||
    s.unionManifestSha256 !== C.unionHash ||
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
    fail("Fresh owner-reviewed $0 admission required");
  let used = s.packageBytes;
  const ids = new Set();
  let target;
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
        fail("Artifact inventory invalid");
      seen.add(a.id);
      used += a.bytes;
    }
    if (r.identity === C.repo) target = r.artifacts;
  }
  if (!target || !Number.isSafeInteger(used)) fail("Target inventory missing");
  const normalize = (a) =>
    JSON.stringify(
      a.map((x) => ({ id: x.id, bytes: x.bytes })).sort((a, b) => a.id - b.id),
    );
  if (normalize(target) !== normalize(live))
    fail("Live repository inventory differs");
  const peak = used + C.reserve + C.margin;
  let ceiling;
  if (s.mode === "authoritative") {
    if (
      s.authoritativeCapacityVerified !== true ||
      !integer(s.capacityCeilingBytes)
    )
      fail("Authoritative capacity unavailable");
    ceiling = Math.min(C.ceiling, s.capacityCeilingBytes);
  } else if (
    s.mode === "logical-inventory" &&
    s.logicalPolicyApproved === true
  ) {
    ceiling = C.ceiling;
  } else fail("Storage policy approval missing");
  if (peak > ceiling) fail("Storage reservation exceeds admission ceiling");
  return {
    usedBytes: used,
    peakBytes: peak,
    uploadReserve: C.reserve,
    margin: C.margin,
    mode: s.mode,
    providerAcceptanceUnproved: true,
  };
}
export async function liveArtifacts(token) {
  if (!token) fail("Existing built-in token required");
  const info = await fetch(`https://api.github.com/repos/${C.repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!info.ok) fail("Repository eligibility unavailable");
  const repo = await info.json();
  if (repo.private !== false || repo.full_name !== C.repo)
    fail("Public repository required");
  const legacy = await fetch(
    `https://api.github.com/repos/${C.repo}/actions/workflows/jekyll-gh-pages.yml`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!legacy.ok || (await legacy.json()).state !== "disabled_manually")
    fail("Legacy automatic publisher must remain manually disabled");
  let page = 1,
    all = [];
  while (page <= 20) {
    const res = await fetch(
      `https://api.github.com/repos/${C.repo}/actions/artifacts?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!res.ok) fail("Read-only artifact inventory unavailable");
    const b = await res.json();
    if (!Array.isArray(b.artifacts) || !integer(b.total_count))
      fail("Invalid API inventory");
    all.push(...b.artifacts.map((x) => ({ id: x.id, bytes: x.size_in_bytes })));
    if (all.length === b.total_count) return all;
    if (!b.artifacts.length || all.length > b.total_count)
      fail("Inventory pagination incomplete");
    page++;
  }
  fail("Inventory page bound");
}
export async function receipt(file) {
  const st = await fs.lstat(file);
  if (!st.isFile() || st.isSymbolicLink())
    fail("Receipt symlink/type rejected");
  // Post-extraction exact-tree check. The pinned official action owns ZIP extraction;
  // this is not a pre-extraction outer-ZIP digest or ZIP-member safety check.
  if (path.basename(file) !== "receipt.json") fail("Receipt basename rejected");
  await verify(path.dirname(file), [
    {
      path: "archive-proof.json",
      bytes: 526,
      sha256:
        "5c6b73b2cf850988f29715deed2e1dce72f3881f69ec211def342663fe55af65",
    },
    {
      path: "journal.json",
      bytes: 215,
      sha256:
        "74ac3cb6be728d2604c25baa6ba0cddf1746172f498de7ed4de7ea351b8e212c",
    },
    {
      path: "receipt.json",
      bytes: 374568,
      sha256:
        "97a48f29a9d6f64557202de45be851d9810c0bc4ce0071b40cfab56d6f537757",
    },
  ]);
  const b = await fs.readFile(file);
  if (
    hash(b) !==
    "97a48f29a9d6f64557202de45be851d9810c0bc4ce0071b40cfab56d6f537757"
  )
    fail("Receipt digest mismatch");
  const r = JSON.parse(b);
  if (
    r.repository !== C.repo ||
    r.sourceCommit !== "f06b614d253d3c810c4067c3e80d2ed1eec718e5" ||
    r.workflowCommit !== "cd6d40a4eecf6409d7d27b4a8258e15099b243e5" ||
    r.workflowRunId !== "40197300329" ||
    r.origin !== C.origin + "/"
  )
    fail("Receipt identity mismatch");
  if (JSON.stringify(r.publicFiles) !== JSON.stringify((await inputs()).base))
    fail("Receipt baseline mismatch");
  return true;
}
export async function prepare(output, { root = here, readBaseline } = {}) {
  const { base, overlay, union } = await inputs(root);
  await verify(path.join(root, "overlay"), overlay);
  try {
    await fs.lstat(output);
    fail("Output already exists");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  await fs.mkdir(output, { recursive: false });
  const deadlineAt = Date.now() + 8 * 60 * 1000;
  for (const e of [...base, ...overlay]) {
    if (Date.now() >= deadlineAt) fail("Baseline assembly deadline exceeded");
    let b;
    if (base.includes(e)) {
      b = readBaseline ? await readBaseline(e) : await download(e, { deadlineAt });
    } else b = await fs.readFile(path.join(root, "overlay", e.path));
    if (b.length !== e.bytes || hash(b) !== e.sha256)
      fail("Input body mismatch: " + e.path);
    const dest = path.join(output, e.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, b, { flag: "wx", mode: 0o644 });
  }
  await verify(output, union);
  return {
    files: union.length,
    bytes: C.unionBytes,
    manifestSha256: C.unionHash,
  };
}
export async function download(e, {
  fetcher = fetch,
  timeoutMs = 25000,
  retryDelayMs = 1000,
  deadlineAt = Date.now() + 51000,
  logger = (record) => console.log(JSON.stringify(record)),
} = {}) {
  safe(e.path);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 25000 ||
      !Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 1000 ||
      !Number.isSafeInteger(deadlineAt)) fail("Invalid download bounds");
  const started = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = Math.min(timeoutMs, deadlineAt - Date.now());
    if (remaining < 1) fail("Baseline deadline exceeded: " + e.path);
    const signal = AbortSignal.timeout(remaining);
    let phase = "headers", hop = 0, count = 0, res;
    logger({ event: "baseline-start", path: e.path, attempt });
    try {
      let url = C.origin + "/" + e.path;
      for (; hop < 4; hop++) {
        res = await fetcher(url, {
          headers: { "Accept-Encoding": "identity" },
          redirect: "manual",
          signal,
        });
        if (![301, 302, 303, 307, 308].includes(res.status)) break;
        await res.body?.cancel();
        const next = new URL(res.headers.get("location"), url);
        if (next.origin !== C.origin || next.protocol !== "https:" ||
            next.username || next.password) fail("Unapproved backup redirect");
        url = next.href;
      }
      if (res.status !== 200) fail("Pinned backup response not200");
      const n = res.headers.get("content-length");
      if (n && Number(n) !== e.bytes) fail("Unexpected content length");
      phase = "body";
      const chunks = [];
      for await (const chunk of res.body) {
        count += chunk.length;
        if (count > e.bytes) fail("Download exceeds pinned size");
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      phase = "integrity";
      if (body.length !== e.bytes || hash(body) !== e.sha256)
        fail("Input body mismatch");
      logger({ event: "baseline-complete", path: e.path, attempt,
        bytes: count, elapsedMs: Date.now() - started });
      return body;
    } catch (error) {
      await res?.body?.cancel().catch(() => {});
      const rawCode = error.cause?.code || error.code;
      const code = typeof rawCode === "string" ? rawCode : error.name;
      const transient = error.name === "TimeoutError" ||
        ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT",
          "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET"].includes(code);
      const retry = transient && attempt === 1 &&
        Date.now() + retryDelayMs < deadlineAt;
      logger({ event: "baseline-error", path: e.path, attempt, phase, hop,
        bytes: count, elapsedMs: Date.now() - started, code, retry });
      if (!retry) throw new Error(
        `Baseline download failed: path=${e.path} attempt=${attempt} phase=${phase} code=${code}`,
        { cause: error });
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  context(process.env);
  if (mode === "receipt") {
    await receipt(process.argv[3]);
    console.log("Pinned receipt verified");
  } else if (mode === "prepare") {
    console.log(JSON.stringify(await prepare(process.argv[3])));
  } else if (mode === "admit") {
    const s = JSON.parse(process.env.STORAGE_SNAPSHOT || "null");
    const live = await liveArtifacts(process.env.GH_READ_TOKEN);
    const a = admission(s, live, process.env.GITHUB_SHA);
    console.log(JSON.stringify(a));
  } else if (mode === "verify") {
    await verify(process.argv[3], (await inputs()).union);
    console.log("Pinned union verified");
  } else fail("Unknown mode");
}
