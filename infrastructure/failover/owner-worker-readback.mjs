import { execFileSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  APPROVED_WORKER_SETTINGS_SHA256,
  validateWorkerConfig,
  validateWorkerProof,
  validateWorkerRequest,
} from "./manual-worker-checkpoint.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const here = path.dirname(fileURLToPath(import.meta.url));
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
const same = (a, b) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function assertLocalControlClean(cwd) {
  const paths = [":(top)infrastructure/failover", ":(top).github/workflows"];
  execFileSync("git", ["diff", "--quiet", "HEAD", "--", ...paths], { cwd });
  if (
    execFileSync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "--", ...paths],
      { cwd, encoding: "utf8" },
    ).trim()
  )
    throw Error("Untracked local control files; no owner proof");
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
  }).trim();
}
export async function captureWorkerState({
  request,
  runNative,
  now = Date.now,
} = {}) {
  validateWorkerRequest(request, { now: now() });
  if (!runNative) {
    if (
      os.platform() !== "darwin" ||
      os.arch() !== "arm64" ||
      os.hostname() !== "M1-Max-MacBook-Pro"
    )
      throw Error("Authorized M1 required");
    const folder = await mkdtemp(path.join(os.tmpdir(), "jji-worker-read-"));
    const binary = path.join(folder, "native-worker-read");
    execFileSync(
      "/usr/bin/xcrun",
      ["swiftc", path.join(here, "native-worker-read.swift"), "-o", binary],
      { stdio: "pipe", timeout: 60000 },
    );
    runNative = (command) =>
      execFileSync(binary, [command, request.nonce], {
        maxBuffer: 1024 * 1024,
        timeout: 45000,
      });
  }
  const before = JSON.parse(await runNative("deployments"));
  const select = (d) => {
    const list = d.result?.deployments;
    if (d.success !== true || !Array.isArray(list) || !list.length)
      throw Error("Missing actual Worker deployment");
    const x = list[0];
    if (
      !Array.isArray(x.versions) ||
      x.versions.length !== 1 ||
      x.versions[0].percentage !== 100
    )
      throw Error("Split Worker deployment");
    return {
      deployment: x.id,
      version: x.versions[0].version_id,
      percentage: 100,
    };
  };
  const a = select(before);
  const baseline = JSON.parse(
    await runNative("version:" + request.sourceVersion),
  );
  const current = JSON.parse(await runNative("version:" + a.version));
  const settings = JSON.parse(await runNative("settings"));
  const after = JSON.parse(await runNative("deployments"));
  const b = select(after);
  if (!same(a, b))
    throw Error("Worker changed during immutable version readback");
  if (
    baseline.success !== true ||
    current.success !== true ||
    settings.success !== true ||
    baseline.result?.id !== request.sourceVersion ||
    current.result?.id !== a.version
  )
    throw Error("Immutable Worker metadata access/identity mismatch");
  const approved = baseline.result.resources,
    active = current.result.resources;
  if (
    approved?.script?.etag !== request.sourceEtag ||
    active?.script?.etag !== request.sourceEtag ||
    !same(active.script_runtime, approved.script_runtime) ||
    !same(active.script?.handlers, approved.script?.handlers) ||
    !same(active.script?.named_handlers, approved.script?.named_handlers)
  )
    throw Error("Deployed Worker script/runtime identity changed");
  const cfg = settings.result;
  if (
    !Array.isArray(cfg?.bindings) ||
    cfg.bindings.length !== 1 ||
    cfg.bindings[0].name !== "RELEASE_CONFIG" ||
    cfg.bindings[0].type !== "plain_text" ||
    (cfg.compatibility_flags?.length ?? 0) !== 0 ||
    cfg.observability?.logs?.enabled !== false ||
    cfg.observability?.traces?.enabled !== false ||
    cfg.observability?.issues?.enabled !== false ||
    !same(cfg.bindings, active.bindings)
  )
    throw Error(
      "Unreviewed Worker settings or immutable-version bindings differ",
    );
  const settingsSha256 = hash(
    JSON.stringify(
      canonical(
        Object.fromEntries(
          Object.entries(cfg).filter(
            ([k]) => !["annotations", "bindings"].includes(k),
          ),
        ),
      ),
    ),
  );
  if (settingsSha256 !== APPROVED_WORKER_SETTINGS_SHA256)
    throw Error("Non-versioned Worker settings changed; no scope expansion");
  const config = validateWorkerConfig(JSON.parse(cfg.bindings[0].text));
  // The provider ETag is hashed deployed script content. The local SHA below is
  // separately the reviewed raw source provenance, not a hash of compiled code.
  if (
    hash(await readFile(path.join(here, "worker.mjs"))) !== request.sourceSha256
  )
    throw Error("Reviewed raw Worker source changed");
  return {
    account: request.account,
    script: request.script,
    ...b,
    sourceSha256: request.sourceSha256,
    sourceVersion: request.sourceVersion,
    sourceEtag: request.sourceEtag,
    settingsSha256,
    config,
    observedAt: now(),
    evidenceSha256: hash(
      JSON.stringify({ before, baseline, current, settings, after }),
    ),
  };
}
export function makeWorkerProof({
  requestBytes,
  requestArtifact,
  before,
  after,
  startedAt,
  completedAt = Date.now(),
}) {
  const r = validateWorkerRequest(JSON.parse(requestBytes), {
    now: completedAt,
  });
  const proof = {
    schema: "jji-manual-worker-proof-1",
    requestSha256: hash(requestBytes),
    requestArtifactId: requestArtifact.id,
    requestArtifactDigest: requestArtifact.digest,
    ...Object.fromEntries(
      [
        "repository",
        "parentRunId",
        "parentAttempt",
        "workflowCommit",
        "sourceCommit",
        "release",
        "phase",
        "nonce",
      ].map((k) => [k, r[k]]),
    ),
    machine: {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
    startedAt,
    completedAt,
    before,
    after,
  };
  return validateWorkerProof(proof, r, hash(requestBytes), {
    now: completedAt,
    requestArtifact,
  });
}
