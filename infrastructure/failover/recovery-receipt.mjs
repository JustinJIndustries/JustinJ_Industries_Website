// Small, externally pinned recovery receipts. The receipt digest must come from
// an approved release ledger/provider artifact, never from the receipt itself.
import { readFile, writeFile, mkdir, stat, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { verifyPackage } from "./prepare-release.mjs";
const REPO = "JustinJIndustries/JustinJ_Industries_Website";
const PREFIX = "__jji_releases/";
const HEX = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
export const RECEIPT_LIMIT = 1024 * 1024;
const TREE_LIMIT = 200 * 1024 * 1024;
const FILE_LIMIT = 25 * 1024 * 1024;
export const receiptDigest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
function origin(value) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    !/^[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev$/.test(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw new Error("Unapproved immutable recovery origin");
  return u;
}
function safeName(name) {
  return (
    typeof name === "string" &&
    /^[\w.@/-]+$/.test(name) &&
    !name.startsWith("/") &&
    path.posix.normalize(name) === name &&
    !name
      .split("/")
      .some(
        (s) =>
          !s ||
          [
            ".",
            "..",
            ".git",
            ".aws",
            ".codex",
            "node_modules",
            "docs",
            "tools",
            "scripts",
            "infrastructure",
            "tests",
            "partials",
          ].includes(s),
      )
  );
}
function keys(value, allowed) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k))
  )
    throw new Error("Unexpected recovery metadata field");
}
function list(entries, sizes = false) {
  if (Array.isArray(entries))
    for (const e of entries)
      keys(e, sizes ? ["path", "sha256", "bytes"] : ["path", "sha256"]);
  if (
    !Array.isArray(entries) ||
    !entries.length ||
    entries.length > 2000 ||
    new Set(entries.map((e) => e.path)).size !== entries.length ||
    entries.some(
      (e) =>
        !safeName(e.path) ||
        !HEX.test(e.sha256) ||
        (sizes &&
          (!Number.isSafeInteger(e.bytes) ||
            e.bytes < 0 ||
            e.bytes > FILE_LIMIT)),
    )
  )
    throw new Error("Invalid recovery inventory");
  if (sizes && entries.reduce((n, e) => n + e.bytes, 0) > TREE_LIMIT)
    throw new Error("Recovery tree budget exceeded");
}
const stripSizes = (entries) =>
  entries.map(({ path, sha256 }) => ({ path, sha256 }));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function validateReceipt(r) {
  keys(r, [
    "schema",
    "repository",
    "sourceCommit",
    "workflowCommit",
    "workflowRunId",
    "createdAt",
    "origin",
    "ancestor",
    "metadata",
    "publicFiles",
    "stageFiles",
  ]);
  keys(r.metadata, [
    "schema",
    "release",
    "releases",
    "totalBytes",
    "sourceFiles",
    "files",
    "stageFiles",
    "previousFiles",
    "previousRelease",
    "bootstrap",
  ]);
  keys(r.ancestor, [
    "kind",
    "origin",
    "sourceCommit",
    "sourceFiles",
    "release",
    "receiptSha256",
  ]);
  if (
    r?.schema !== 1 ||
    r.repository !== REPO ||
    !COMMIT.test(r.sourceCommit) ||
    !COMMIT.test(r.workflowCommit) ||
    !/^\d+$/.test(r.workflowRunId) ||
    !Number.isFinite(Date.parse(r.createdAt))
  )
    throw new Error("Invalid receipt provenance");
  keys(
    r.ancestor,
    r.ancestor.kind === "bootstrap"
      ? ["kind", "origin", "sourceCommit", "sourceFiles"]
      : [
          "kind",
          "origin",
          "sourceCommit",
          "sourceFiles",
          "release",
          "receiptSha256",
        ],
  );
  origin(r.origin);
  origin(r.ancestor?.origin);
  if (r.origin === r.ancestor.origin)
    throw new Error("Recovery origins must be distinct immutable deployments");
  const m = r.metadata;
  if (
    m?.schema !== 1 ||
    !Array.isArray(m.releases) ||
    !m.releases.length ||
    m.releases.length > 16 ||
    new Set(m.releases).size !== m.releases.length ||
    m.releases[0] !== m.release ||
    m.releases.some((id) => !HEX.test(id))
  )
    throw new Error("Invalid recovery release identities");
  for (const entries of [
    m.sourceFiles,
    m.files,
    m.stageFiles,
    m.previousFiles,
    r.ancestor.sourceFiles,
  ])
    list(entries);
  list(r.publicFiles, true);
  list(r.stageFiles, true);
  if (
    receiptDigest("jji-release-schema-1\n" + JSON.stringify(m.sourceFiles)) !==
      m.release ||
    !same(stripSizes(r.publicFiles), m.files) ||
    !same(stripSizes(r.stageFiles), m.stageFiles) ||
    r.publicFiles.reduce((n, e) => n + e.bytes, 0) !== m.totalBytes ||
    !COMMIT.test(r.ancestor.sourceCommit)
  )
    throw new Error("Recovery manifest/size mismatch");
  if (m.bootstrap === true) {
    if (
      m.releases.length !== 1 ||
      !same(m.previousFiles, m.sourceFiles) ||
      r.ancestor.kind !== "bootstrap" ||
      !same(r.ancestor.sourceFiles, m.sourceFiles)
    )
      throw new Error("Invalid bootstrap recovery ancestry");
  } else if (
    m.releases.length < 2 ||
    m.previousRelease !== m.releases[1] ||
    r.ancestor.kind !== "release" ||
    r.ancestor.release !== m.previousRelease ||
    !HEX.test(r.ancestor.receiptSha256) ||
    receiptDigest(
      "jji-release-schema-1\n" + JSON.stringify(r.ancestor.sourceFiles),
    ) !== m.previousRelease
  )
    throw new Error("Invalid predecessor recovery ancestry");
  const expected = new Map(m.previousFiles.map((e) => [e.path, e.sha256]));
  for (const e of m.files.filter((e) =>
    e.path.startsWith(PREFIX + m.release + "/"),
  ))
    expected.set(e.path, e.sha256);
  if (
    !same(
      [...expected].sort(),
      m.stageFiles.map((e) => [e.path, e.sha256]).sort(),
    )
  )
    throw new Error("Recovery stage changed predecessor bytes");
  const staged = new Map(m.stageFiles.map((e) => [e.path, e.sha256]));
  if (
    m.files.some(
      (e) => e.path.startsWith(PREFIX) && staged.get(e.path) !== e.sha256,
    )
  )
    throw new Error("Recovery stage lost immutable assets");
  return r;
}
export function encodeReceipt(receipt) {
  validateReceipt(receipt);
  const bytes = Buffer.from(JSON.stringify(receipt) + "\n");
  if (bytes.length > RECEIPT_LIMIT)
    throw new Error("Receipt exceeds small-artifact limit");
  return bytes;
}
export function decodeReceipt(bytes, expectedDigest) {
  if (
    !HEX.test(expectedDigest ?? "") ||
    bytes.length > RECEIPT_LIMIT ||
    receiptDigest(bytes) !== expectedDigest
  )
    throw new Error("Receipt requires an external matching digest");
  return validateReceipt(JSON.parse(bytes.toString()));
}
async function sized(root, entries) {
  const output = [];
  for (const e of entries)
    output.push({ ...e, bytes: (await stat(path.join(root, e.path))).size });
  return output;
}

// Read-only HTTPS fetch, with bounded headers AND body even for test doubles
// that ignore AbortSignal. No cookies, credentials, caller queries or logs.
async function download(base, entry, fetcher, budget) {
  const controller = new AbortController();
  let timer;
  const pending = (async () => {
    let url = new URL(entry.path, origin(base));
    const seen = new Set();
    for (let hop = 0; hop < 6; hop++) {
      if (controller.signal.aborted || seen.has(url.href)) throw new Error();
      seen.add(url.href);
      const r = await fetcher(url, {
        redirect: "manual",
        credentials: "omit",
        signal: controller.signal,
        headers: { "cache-control": "no-cache" },
      });
      if (controller.signal.aborted) {
        void r.body?.cancel().catch(() => {});
        throw new Error();
      }
      if (r.headers.get("cf-mitigated")?.toLowerCase() === "challenge") {
        void r.body?.cancel().catch(() => {});
        throw new Error();
      }
      if ([301, 302, 303, 307, 308].includes(r.status)) {
        const location = r.headers.get("location");
        if (!location) throw new Error();
        const next = new URL(location, url);
        void r.body?.cancel().catch(() => {});
        if (
          next.origin !== origin(base).origin ||
          next.username ||
          next.password
        )
          throw new Error();
        url = next;
        continue;
      }
      if (r.status !== 200) {
        void r.body?.cancel().catch(() => {});
        throw new Error();
      }
      const reader = r.body?.getReader();
      let count = 0;
      const chunks = [];
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (controller.signal.aborted) throw new Error();
            if (done) break;
            count += value.byteLength;
            if (count > entry.bytes) throw new Error();
            chunks.push(Buffer.from(value));
          }
        } catch {
          void reader.cancel().catch(() => {});
          throw new Error();
        }
      }
      const bytes = Buffer.concat(chunks);
      if (count !== entry.bytes || receiptDigest(bytes) !== entry.sha256)
        throw new Error();
      return bytes;
    }
    throw new Error();
  })();
  try {
    return await Promise.race([
      pending,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error());
        }, budget);
      }),
    ]);
  } catch {
    throw new Error(
      "Immutable recovery read failed (status, integrity, security or timeout); stop without retry",
    );
  } finally {
    clearTimeout(timer);
  }
}
function boundedOptions({
  fetcher = globalThis.fetch,
  perFileMs = 15000,
  totalMs = 180000,
} = {}) {
  if (!(
    perFileMs > 0 &&
    perFileMs <= 30000 &&
    totalMs > 0 &&
    totalMs <= 300000
  ))
    throw new Error("Invalid recovery wait budget");
  const end = Date.now() + totalMs;
  return {
    read: async (base, e) => {
      const left = end - Date.now();
      if (left <= 0) throw new Error("Recovery total wait exceeded");
      return download(base, e, fetcher, Math.min(left, perFileMs));
    },
  };
}

// Issue only AFTER both immutable deployment inventories have been read/verified.
// The production artifact itself never acquires internal receipt/metadata files.
export async function createRecoveryReceipt({
  packageRoot,
  origin: currentOrigin,
  sourceCommit,
  workflowCommit,
  workflowRunId,
  previousReceiptBytes,
  previousReceiptDigest,
  bootstrapOrigin,
  ...options
}) {
  const m = await verifyPackage(packageRoot);
  if (!m.stageFiles) throw new Error("Reviewed bootstrap/stage is required");
  let ancestor;
  if (m.bootstrap === true)
    ancestor = {
      kind: "bootstrap",
      origin: bootstrapOrigin,
      sourceCommit,
      sourceFiles: m.sourceFiles,
    };
  else {
    const previous = decodeReceipt(previousReceiptBytes, previousReceiptDigest);
    if (
      previous.metadata.release !== m.previousRelease ||
      !same(previous.metadata.files, m.previousFiles)
    )
      throw new Error("Wrong predecessor receipt");
    ancestor = {
      kind: "release",
      origin: previous.origin,
      release: previous.metadata.release,
      receiptSha256: previousReceiptDigest,
      sourceCommit: previous.sourceCommit,
      sourceFiles: previous.metadata.sourceFiles,
    };
  }
  const r = {
    schema: 1,
    repository: REPO,
    sourceCommit,
    workflowCommit,
    workflowRunId,
    createdAt: new Date().toISOString(),
    origin: currentOrigin,
    ancestor,
    metadata: m,
    publicFiles: await sized(path.join(packageRoot, "public"), m.files),
    stageFiles: await sized(path.join(packageRoot, "stage"), m.stageFiles),
  };
  const bytes = encodeReceipt(r),
    io = boundedOptions(options);
  for (const e of r.publicFiles) await io.read(r.origin, e);
  const staged = new Map(r.stageFiles.map((e) => [e.path, e]));
  for (const e of m.previousFiles)
    await io.read(ancestor.origin, staged.get(e.path));
  return { bytes, sha256: receiptDigest(bytes), receipt: r };
}

// Rehydrate both final and rollback stage from a SMALL externally pinned receipt.
// Partial results stay in a fresh scratch directory and cannot pass verifyPackage.
export async function recoverPackage({
  receiptBytes,
  expectedDigest,
  output,
  ...options
}) {
  const r = decodeReceipt(receiptBytes, expectedDigest),
    io = boundedOptions(options);
  await mkdir(output); // refuse existing output; never overwrite recovery data
  await mkdir(path.join(output, "public"));
  await mkdir(path.join(output, "stage"));
  const current = new Map(r.publicFiles.map((e) => [e.path, e]));
  for (const e of r.publicFiles) {
    const b = await io.read(r.origin, e);
    const f = path.join(output, "public", e.path);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, b, { flag: "wx" });
  }
  for (const e of r.stageFiles) {
    const f = path.join(output, "stage", e.path);
    await mkdir(path.dirname(f), { recursive: true });
    if (
      current.get(e.path)?.sha256 === e.sha256 &&
      current.get(e.path)?.bytes === e.bytes
    )
      await cp(path.join(output, "public", e.path), f, {
        errorOnExist: true,
        force: false,
      });
    else
      await writeFile(f, await io.read(r.ancestor.origin, e), { flag: "wx" });
  }
  await writeFile(
    path.join(output, "release.json"),
    JSON.stringify(r.metadata, null, 2) + "\n",
    { flag: "wx" },
  );
  await verifyPackage(output);
  return {
    release: r.metadata.release,
    publicFiles: r.publicFiles.length,
    stageFiles: r.stageFiles.length,
  };
}

// After rollback, old HTML must retain EVERY asset exposed by the newer release.
// Rebase metadata so a later release carries that union instead of restoring a
// raw predecessor that drops newer cached-page assets.
export async function prepareRollbackRecovery({
  recoveredRoot,
  receiptBytes,
  expectedDigest,
  output,
}) {
  const r = decodeReceipt(receiptBytes, expectedDigest),
    m = await verifyPackage(recoveredRoot);
  if (!same(m, r.metadata))
    throw new Error("Recovered package does not match rollback receipt");
  await mkdir(output);
  await cp(path.join(recoveredRoot, "stage"), path.join(output, "public"), {
    recursive: true,
  });
  let rollback;
  if (m.bootstrap === true) {
    await cp(path.join(recoveredRoot, "stage"), path.join(output, "stage"), {
      recursive: true,
    });
    rollback = {
      ...m,
      files: m.stageFiles,
      totalBytes: r.stageFiles.reduce((n, e) => n + e.bytes, 0),
    };
  } else {
    await cp(path.join(recoveredRoot, "public"), path.join(output, "stage"), {
      recursive: true,
    });
    rollback = {
      schema: 1,
      release: m.previousRelease,
      releases: [
        m.previousRelease,
        ...m.releases.filter((id) => id !== m.previousRelease),
      ],
      sourceFiles: r.ancestor.sourceFiles,
      files: m.stageFiles,
      totalBytes: r.stageFiles.reduce((n, e) => n + e.bytes, 0),
      previousRelease: m.release,
      previousFiles: m.files,
      stageFiles: m.files,
    };
  }
  await writeFile(
    path.join(output, "release.json"),
    JSON.stringify(rollback, null, 2) + "\n",
    { flag: "wx" },
  );
  await verifyPackage(output);
  return rollback;
}

// Store only the small receipt through an injected, journaled write-once adapter.
// A successful write alone is insufficient: read back the independent stored
// object and compare its external digest before releasing a promotion proof.
export async function persistRecoveryReceipt({ bytes, expectedDigest, store }) {
  decodeReceipt(bytes, expectedDigest);
  if (
    typeof store?.writeOnce !== "function" ||
    typeof store?.readBack !== "function"
  )
    throw new Error(
      "Receipt storage requires journaled write-once and read-back adapters",
    );
  try {
    const identity = await store.writeOnce(bytes, expectedDigest);
    const readBack = await store.readBack(identity);
    decodeReceipt(readBack, expectedDigest);
    return { bytes: readBack, sha256: expectedDigest, durable: true };
  } catch {
    throw new Error(
      "Recovery receipt storage/read-back unconfirmed; reconcile before retry or promotion",
    );
  }
}
