// Manual read-only runner replay. No provider-write adapter, OIDC or secret
// environment is requested. Checkpoint creation is a deliberate terminal stop.
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import {
  startDiagnostics,
  readCoordinatorProgress,
  readDiagnosticOutcome,
} from "./coordinator-diagnostics.mjs";
import { assertCandidate, refreshBudget } from "./paired-ci.mjs";
import {
  assertRemoteMetadata,
  assertProtectedEnvironment,
} from "./trusted-inspectors.mjs";
import { decodeReceipt, recoverPackage } from "./recovery-receipt.mjs";
import { verifyOwnerMacProof } from "./owner-archive.mjs";
import { cloudflarePackage } from "./cloudflare-package.mjs";
import { artifactPlan } from "./artifact-plan.mjs";
import {
  createM1Gate,
  hash,
  assertCheckpointArtifactBudget,
} from "./public-checkpoint.mjs";
import { assertPublishedSourceRun } from "./public-parity.mjs";
import { listArtifacts } from "./checkpoint-github.mjs";

export const DIAGNOSTIC = Object.freeze({
  repo: "JustinJIndustries/JustinJ_Industries_Website",
  source: "d6574ede41a8620f838b6eafd3e7ba76ea7ebf68",
  candidateControl: "06d86074d46f4b1f0339b97d32c784fb5b1ab8b2",
  candidateRun: "40121633653",
  candidateArtifact: "12570834463",
  receipt: "eb41bf430b09be670bb7523a0ff12a105814dbcdc66869b1f66b1b545de7f76b",
  artifactDigest:
    "sha256:d0fbe40c5f36c33d4ecba4c3b3f170ce8c02fcbbce44f449f36f328223767358",
  workflow: ".github/workflows/coordinator-diagnostic.yml",
});
const json = async (f) => JSON.parse(await readFile(f, "utf8"));
const save = (f, x) =>
  writeFile(f, JSON.stringify(x) + "\n", { flag: "wx", mode: 0o600 });
export function assertDiagnosticContext(env, event) {
  if (
    env.GITHUB_REPOSITORY !== DIAGNOSTIC.repo ||
    env.GITHUB_ACTOR !== "JustinJIndustries" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_WORKFLOW_REF !==
      `${DIAGNOSTIC.repo}/${DIAGNOSTIC.workflow}@refs/heads/main` ||
    env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    env.RUNNER_OS !== "Linux" ||
    env.GITHUB_RUN_ATTEMPT !== "1" ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "") ||
    env.GITHUB_SHA !== env.APPROVED_DIAGNOSTIC_SHA ||
    !/^[1-9]\d*$/.test(env.GITHUB_RUN_ID ?? "") ||
    event.repository?.full_name !== DIAGNOSTIC.repo ||
    event.repository.private !== false ||
    event.ref !== "refs/heads/main" ||
    event.inputs?.approved_control_sha !== env.GITHUB_SHA ||
    event.pull_request ||
    env.CLOUDFLARE_PAGES_TOKEN ||
    env.CLOUDFLARE_WORKER_TOKEN ||
    env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  )
    throw new Error("Read-only diagnostic context rejected");
}
function operation(endpoint, env) {
  const p = `/repos/${DIAGNOSTIC.repo}`;
  const exact = new Map([
    [p, "repository"],
    [p + "/commits/main", "main"],
    [p + `/actions/runs/${env.GITHUB_RUN_ID}`, "diagnostic_run"],
    [p + `/actions/runs/${DIAGNOSTIC.candidateRun}`, "candidate_run"],
    [
      p + `/actions/artifacts/${DIAGNOSTIC.candidateArtifact}`,
      "candidate_artifact",
    ],
    [p + "/environments/failover-sync", "protected_environment"],
    [
      p + "/environments/failover-sync/deployment-branch-policies",
      "branch_policy",
    ],
    [p + "/actions/workflows/jekyll-gh-pages.yml", "legacy_publisher"],
    [p + "/actions/workflows/paired-release.yml", "paired_publisher"],
    [
      p +
        "/actions/workflows/jekyll-gh-pages.yml/runs?status=success&branch=main&per_page=1",
      "published_source",
    ],
  ]);
  if (exact.has(endpoint)) return exact.get(endpoint);
  if (
    new RegExp(
      "^" + p + "/actions/artifacts\\?per_page=100&page=[1-9][0-9]{0,2}$",
    ).test(endpoint)
  )
    return "artifact_inventory";
  if (
    new RegExp(
      "^" +
        p +
        "/actions/workflows/jekyll-gh-pages.yml/runs\\?status=(in_progress|queued|waiting|requested|pending)&per_page=1$",
    ).test(endpoint)
  )
    return "legacy_unfinished_runs";
  throw new Error("Read-only diagnostic endpoint rejected");
}
export function diagnosticReader(env, root, fetcher = globalThis.fetch) {
  if (!env.GH_READ_TOKEN || /[\r\n]/.test(env.GH_READ_TOKEN))
    throw new Error("Existing diagnostic read token absent");
  return async (endpoint) => {
    const op = operation(endpoint, env),
      start = Date.now();
    let response;
    try {
      response = await fetcher("https://api.github.com" + endpoint, {
        headers: {
          authorization: `Bearer ${env.GH_READ_TOKEN}`,
          accept: "application/vnd.github+json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      await writeFile(
        path.join(root, "reads.jsonl"),
        JSON.stringify({ operation: op, networkFailure: true }) + "\n",
        { flag: "a", mode: 0o600 },
      );
      throw new Error("Diagnostic GitHub network read failed");
    }
    await writeFile(
      path.join(root, "reads.jsonl"),
      JSON.stringify({
        operation: op,
        status: response.status,
        elapsedMs: Date.now() - start,
      }) + "\n",
      { flag: "a", mode: 0o600 },
    );
    if (!response.ok) throw new Error("Diagnostic GitHub GET refused");
    return response.json();
  };
}
class CheckpointBoundary extends Error {}
async function run(root, env, diagnostics) {
  await diagnostics.stage("inputs");
  assertDiagnosticContext(env, await json(env.GITHUB_EVENT_PATH));
  const read = diagnosticReader(env, root),
    prefix = `/repos/${DIAGNOSTIC.repo}`;
  await diagnostics.stage("identity");
  assertRemoteMetadata(
    await read(prefix),
    execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }),
  );
  if ((await read(prefix + "/commits/main")).sha !== env.GITHUB_SHA)
    throw new Error("Diagnostic main changed");
  const current = await read(prefix + `/actions/runs/${env.GITHUB_RUN_ID}`);
  if (
    current.head_sha !== env.GITHUB_SHA ||
    current.path !== DIAGNOSTIC.workflow ||
    current.head_branch !== "main" ||
    current.event !== "workflow_dispatch" ||
    current.run_attempt !== 1 ||
    current.actor?.login !== "JustinJIndustries"
  )
    throw new Error("Diagnostic run provenance rejected");
  assertProtectedEnvironment(
    await read(prefix + "/environments/failover-sync"),
    await read(
      prefix + "/environments/failover-sync/deployment-branch-policies",
    ),
  );
  await diagnostics.stage("publisher");
  if (
    (await read(prefix + "/actions/workflows/jekyll-gh-pages.yml")).state !==
      "active" ||
    (await read(prefix + "/actions/workflows/paired-release.yml")).state !==
      "disabled_manually"
  )
    throw new Error("Diagnostic safe publisher state changed");
  for (const status of [
    "in_progress",
    "queued",
    "waiting",
    "requested",
    "pending",
  ])
    if (
      (
        await read(
          prefix +
            `/actions/workflows/jekyll-gh-pages.yml/runs?status=${status}&per_page=1`,
        )
      ).workflow_runs?.length !== 0
    )
      throw new Error("Diagnostic concurrent legacy run");
  const context = {
    repository: DIAGNOSTIC.repo,
    runId: env.GITHUB_RUN_ID,
    sha: env.GITHUB_SHA,
    sourceCommit: DIAGNOSTIC.source,
  };
  await diagnostics.stage("storage");
  const refresh = () => refreshBudget(env, read, context);
  await refresh();
  await diagnostics.stage("candidate");
  const incoming = path.join(env.RUNNER_TEMP, "incoming-candidate");
  if (
    JSON.stringify((await readdir(incoming)).sort()) !==
    JSON.stringify(["candidate.json", "receipt.json"])
  )
    throw new Error("Diagnostic candidate members rejected");
  const bytes = await readFile(path.join(incoming, "receipt.json"));
  if (hash(bytes) !== DIAGNOSTIC.receipt)
    throw new Error("Owner-pinned candidate digest mismatch");
  const receipt = decodeReceipt(bytes, DIAGNOSTIC.receipt),
    candidate = await json(path.join(incoming, "candidate.json"));
  const artifact = await read(
    prefix + `/actions/artifacts/${DIAGNOSTIC.candidateArtifact}`,
  );
  if (artifact.digest !== DIAGNOSTIC.artifactDigest)
    throw new Error("Diagnostic candidate artifact digest rejected");
  // Historical provenance is checked against its original control, never reused
  // as approval to publish under this diagnostic's new control revision.
  assertCandidate(
    candidate,
    receipt,
    {
      SOURCE_COMMIT: DIAGNOSTIC.source,
      APPROVED_RELEASE: receipt.metadata.release,
      GITHUB_SHA: DIAGNOSTIC.candidateControl,
      CANDIDATE_RECEIPT_SHA256: DIAGNOSTIC.receipt,
      CANDIDATE_RUN_ID: DIAGNOSTIC.candidateRun,
      PAIRED_MODE: "bootstrap",
    },
    await read(prefix + `/actions/runs/${DIAGNOSTIC.candidateRun}`),
    artifact,
  );
  verifyOwnerMacProof(
    JSON.parse(env.OWNER_ARCHIVE_PROOF),
    receipt,
    DIAGNOSTIC.receipt,
    { approved: true },
  );
  const packageRoot = path.join(root, "package");
  let recoveryReads = 0;
  await diagnostics.stage("recovery");
  await recoverPackage({
    receiptBytes: bytes,
    expectedDigest: DIAGNOSTIC.receipt,
    output: packageRoot,
    fetcher: async (url, init) => {
      const u = new URL(url);
      if (
        ![receipt.origin, receipt.ancestor.origin].includes(u.origin + "/") ||
        u.search ||
        u.hash ||
        ![undefined, "GET", "HEAD"].includes(init?.method)
      )
        throw new Error("Diagnostic recovery destination rejected");
      const response = await fetch(url, init);
      recoveryReads++;
      if (response.status >= 400)
        await save(path.join(root, "recovery-failure.json"), {
          status: response.status,
          challenge:
            response.headers.get("cf-mitigated")?.toLowerCase() === "challenge",
        });
      return response;
    },
  });
  await diagnostics.stage("package");
  const routes = await json(
    new URL("./legacy-redirects.json", import.meta.url),
  );
  await cloudflarePackage(packageRoot, path.join(root, "cloudflare"), routes);
  await artifactPlan(packageRoot, undefined, await refresh(), {
    allowInventoryAdmission: true,
    currentRunId: context.runId,
  });
  const sourceRuns = await read(
    prefix +
      "/actions/workflows/jekyll-gh-pages.yml/runs?status=success&branch=main&per_page=1",
  );
  assertPublishedSourceRun(sourceRuns.workflow_runs?.[0], DIAGNOSTIC.source);
  await diagnostics.stage("baseline");
  const verify = await createM1Gate({
    root,
    packageRoot,
    context,
    metadata: receipt.metadata,
    requirePrimaryMarker: false,
    bridge: {
      request: async (phase) => {
        if (phase !== "public-baseline")
          throw new Error("Diagnostic checkpoint phase rejected");
        throw new CheckpointBoundary();
      },
    },
    beforeWrite: async () => {
      const s = await refresh();
      assertCheckpointArtifactBudget(await listArtifacts(read));
      return s;
    },
    authenticateProof: async () => {
      throw new Error("Diagnostic must never authenticate a proof");
    },
  });
  let reached = false;
  try {
    await verify(receipt.metadata.sourceFiles, "baseline");
  } catch (e) {
    if (e instanceof CheckpointBoundary) reached = true;
    else throw e;
  }
  if (!reached) throw new Error("Diagnostic terminal boundary not reached");
  await save(path.join(root, "diagnostic-result.json"), {
    status: "success",
    boundary: "baseline_request_only",
    sourceCommit: DIAGNOSTIC.source,
    candidateControl: DIAGNOSTIC.candidateControl,
    diagnosticControl: env.GITHUB_SHA,
    receiptSha256: DIAGNOSTIC.receipt,
    recoveryReads,
    publicFiles: receipt.publicFiles.length,
    stageFiles: receipt.stageFiles.length,
    providerWriteAttempted: false,
  });
}
async function observe(root, env) {
  const end = Date.now() + 7 * 60000;
  while (Date.now() < end) {
    const exit = await json(
      path.join(env.RUNNER_TEMP, "diagnostic-exit.json"),
    ).catch(() => null);
    if (exit) {
      if (
        !Number.isInteger(exit.exitCode) ||
        exit.exitCode < 0 ||
        exit.exitCode > 255
      )
        throw new Error("Diagnostic exit record rejected");
      const progress = await readCoordinatorProgress(root),
        failure = await readDiagnosticOutcome(root),
        result = await json(path.join(root, "diagnostic-result.json")).catch(
          () => null,
        );
      const reads = (
        await readFile(path.join(root, "reads.jsonl"), "utf8").catch(() => "")
      )
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse);
      // Every transport record is locally produced from a fixed operation name;
      // only serialize these explicit fields, never arbitrary provider output.
      const recoveryRecord = await json(
        path.join(root, "recovery-failure.json"),
      ).catch(() => null);
      let recoveryFailure = null;
      if (recoveryRecord) {
        if (
          !Number.isInteger(recoveryRecord.status) ||
          recoveryRecord.status < 400 ||
          recoveryRecord.status > 599 ||
          typeof recoveryRecord.challenge !== "boolean"
        )
          throw new Error("Diagnostic recovery status rejected");
        recoveryFailure = {
          status: recoveryRecord.status,
          challenge: recoveryRecord.challenge,
        };
      }
      let safeResult = null;
      if (result) {
        if (
          result.status !== "success" ||
          result.boundary !== "baseline_request_only" ||
          result.sourceCommit !== DIAGNOSTIC.source ||
          result.candidateControl !== DIAGNOSTIC.candidateControl ||
          result.diagnosticControl !== env.GITHUB_SHA ||
          result.receiptSha256 !== DIAGNOSTIC.receipt ||
          result.providerWriteAttempted !== false ||
          [result.recoveryReads, result.publicFiles, result.stageFiles].some(
            (n) => !Number.isSafeInteger(n) || n < 1 || n > 4000,
          )
        )
          throw new Error("Diagnostic result rejected");
        safeResult = Object.fromEntries(
          [
            "status",
            "boundary",
            "sourceCommit",
            "candidateControl",
            "diagnosticControl",
            "receiptSha256",
            "recoveryReads",
            "publicFiles",
            "stageFiles",
            "providerWriteAttempted",
          ].map((k) => [k, result[k]]),
        );
      }
      const lastRead = reads.at(-1);
      if (
        lastRead &&
        (![
          "repository",
          "main",
          "diagnostic_run",
          "candidate_run",
          "candidate_artifact",
          "protected_environment",
          "branch_policy",
          "legacy_publisher",
          "paired_publisher",
          "published_source",
          "artifact_inventory",
          "legacy_unfinished_runs",
        ].includes(lastRead.operation) ||
          !(
            lastRead.networkFailure === true ||
            (Number.isInteger(lastRead.status) &&
              lastRead.status >= 100 &&
              lastRead.status <= 599)
          ))
      )
        throw new Error("Diagnostic read status rejected");
      const report = {
        exitCode: exit.exitCode,
        progress,
        failure,
        result: safeResult,
        readCount: reads.length,
        recoveryFailure,
        lastRead: lastRead
          ? {
              operation: lastRead.operation,
              status: lastRead.status,
              networkFailure: lastRead.networkFailure,
            }
          : null,
      };
      console.log(JSON.stringify(report));
      if (env.GITHUB_STEP_SUMMARY)
        await writeFile(
          env.GITHUB_STEP_SUMMARY,
          "\nRead-only coordinator diagnostic (no publication):\n\n```json\n" +
            JSON.stringify(report, null, 2) +
            "\n```\n",
          { flag: "a" },
        );
      if (exit.exitCode !== 0 || result?.status !== "success")
        throw new Error(
          "Diagnostic failed; inspect fixed evidence before retry",
        );
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Diagnostic bounded observation expired; no retry");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [command, root] = process.argv.slice(2);
  let diagnostics;
  try {
    if (command === "observe") await observe(root, process.env);
    else if (command === "run") {
      diagnostics = await startDiagnostics(root, "promote", process.env);
      await run(root, process.env, diagnostics);
    } else throw new Error("Unknown diagnostic command");
  } catch (e) {
    if (diagnostics) await diagnostics.failed(e).catch(() => {});
    console.error(
      "Read-only coordinator diagnostic stopped; raw error suppressed.",
    );
    process.exitCode = 1;
  }
}
