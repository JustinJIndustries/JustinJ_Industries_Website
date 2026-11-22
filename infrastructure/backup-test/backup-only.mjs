// A manually authorized preview test. No Worker, route, DNS, settings, primary
// publisher or GitHub Pages write API exists here. Never print provider bodies.
import {
  appendFile,
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareRelease, verifyPackage } from "./prepare-release.mjs";
import {
  cloudflarePackage,
  verifyCloudflareDirectory,
} from "./cloudflare-package.mjs";
import {
  createRecoveryReceipt,
  recoverPackage,
  decodeReceipt,
} from "./recovery-receipt.mjs";
export const SOURCE = "d6574ede41a8620f838b6eafd3e7ba76ea7ebf68";
export const RELEASE =
  "623a84da5ab3352ffe6736f335d5e3a2c0d6699c22ce976614fb386ffee9686a";
const REPO = "JustinJIndustries/JustinJ_Industries_Website";
const ACCOUNT = "986b5334eba2d05d253ee98ca9842dfe";
const PROJECT = "jji-backup-20261023",
  BRANCH = "backup-ci-test-20261024";
const RAW = "https://ac3af448.jji-backup-20261023.pages.dev/";
const HOST = /^https:\/\/[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev\/$/;
const sha = (b) => createHash("sha256").update(b).digest("hex");
const exec = promisify(execFile),
  here = path.dirname(fileURLToPath(import.meta.url));
export function assertDispatch(env, now = Date.now()) {
  requireOperationInputs(env);
  const budget = Number(env.BUDGET_VERIFIED_AT);
  if (
    env.GITHUB_REPOSITORY !== REPO ||
    env.GITHUB_REF !== "refs/heads/release-control" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_ACTOR !== "JustinJIndustries" ||
    env.GITHUB_TRIGGERING_ACTOR !== "JustinJIndustries" ||
    env.BACKUP_CONTROL_PIN !== env.GITHUB_SHA ||
    env.GITHUB_WORKFLOW_SHA !== env.GITHUB_SHA ||
    env.GITHUB_WORKFLOW_REF !==
      REPO +
        "/.github/workflows/backup-only-test.yml@refs/heads/release-control" ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "") ||
    env.APPROVED_WORKFLOW_SHA !== env.GITHUB_SHA ||
    !/^[1-9]\d*$/.test(env.GITHUB_RUN_ID ?? "") ||
    env.GITHUB_RUN_ATTEMPT !== "1" ||
    env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    env.RUNNER_OS !== "Linux" ||
    env.ZERO_SPEND_CONFIRMED !== "yes" ||
    !Number.isSafeInteger(budget) ||
    budget > now ||
    now - budget > 15 * 60_000
  )
    throw new Error(
      "Untrusted preview-test context or stale zero-spend attestation",
    );
}
export function assertContext(env, now = Date.now()) {
  assertDispatch(env, now);
  if (env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT)
    throw new Error("Unexpected backup account");
}
export function assertPreview(project, deployment) {
  if (
    project.name !== PROJECT ||
    typeof project.production_branch !== "string" ||
    !project.production_branch ||
    /\s/.test(project.production_branch) ||
    project.production_branch === BRANCH ||
    typeof project.canonical_deployment?.id !== "string" ||
    !project.canonical_deployment.id.trim()
  )
    throw new Error("Unexpected project or production branch; no upload");
  if (
    deployment &&
    (deployment.environment !== "preview" ||
      deployment.deployment_trigger?.metadata?.branch !== BRANCH ||
      deployment.deployment_trigger?.metadata?.commit_hash !== SOURCE ||
      !HOST.test(deployment.url.replace(/\/$/, "") + "/"))
  )
    throw new Error("Not the exact authorized preview/source");
}
export function completeDeployments(response) {
  const { result, result_info: page } = response;
  if (
    !Array.isArray(result) ||
    !page ||
    page.page !== 1 ||
    page.per_page !== 25 ||
    page.count !== result.length ||
    page.total_count !== result.length ||
    result.length > 25 ||
    (page.total_pages !== 1 &&
      !(result.length === 0 && page.total_pages === 0)) ||
    result.some((item) => {
      const branch = item?.deployment_trigger?.metadata?.branch;
      return typeof branch !== "string" || !branch || /\s/.test(branch);
    })
  )
    throw new Error("Incomplete deployment inventory; no automatic retry");
  return result;
}

const deploymentId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
function runMessage(runId, workflowSha) {
  return "JJI backup-only test run " + runId + " workflow " + workflowSha;
}
export function requireOperationInputs(env) {
  const {
    VERIFY_DEPLOYMENT_ID: id,
    VERIFY_ORIGINAL_RUN_ID: issuer,
    VERIFY_ORIGINAL_CONTROL_SHA: control,
    VERIFY_OPERATION_SHA256: expected,
  } = env;
  if (!id && !issuer && !control && !expected) return;
  if (
    !deploymentId.test(id ?? "") ||
    !/^[1-9][0-9]*$/.test(issuer ?? "") ||
    issuer === env.GITHUB_RUN_ID ||
    !/^[a-f0-9]{40}$/.test(control ?? "") ||
    control !== env.GITHUB_SHA ||
    !/^[a-f0-9]{64}$/.test(expected ?? "")
  )
    throw new Error("Incomplete or unenrolled backup operation approval");
}

export function verifyPreviewOperation(deployment, productionId, env) {
  requireOperationInputs(env);
  const issuerRunId = env.VERIFY_ORIGINAL_RUN_ID || env.GITHUB_RUN_ID;
  const issuerControlSha = env.VERIFY_ORIGINAL_CONTROL_SHA || env.GITHUB_SHA;
  const origin = (deployment.url ?? "").replace(/\/$/, "") + "/";
  const createdAt = deployment.created_on;
  const metadata = deployment.deployment_trigger?.metadata;
  if (
    !deploymentId.test(deployment.id ?? "") ||
    deployment.id === productionId ||
    (env.VERIFY_DEPLOYMENT_ID && deployment.id !== env.VERIFY_DEPLOYMENT_ID) ||
    !HOST.test(origin) ||
    deployment.environment !== "preview" ||
    typeof createdAt !== "string" ||
    !Number.isFinite(Date.parse(createdAt)) ||
    metadata?.branch !== BRANCH ||
    metadata.commit_hash !== SOURCE ||
    metadata.commit_message !== runMessage(issuerRunId, issuerControlSha)
  )
    throw new Error(
      "Preview provider operation does not match its authorized issuer and destination",
    );

  // Preserve these fields and their ordering for independently approved v1 operation hashes.
  const identity = {
    schema: "jji-backup-preview-operation-1",
    repository: REPO,
    project: PROJECT,
    branch: BRANCH,
    source: SOURCE,
    release: RELEASE,
    deploymentId: deployment.id,
    origin,
    createdAt,
    originalProductionDeploymentId: productionId,
    issuerRunId,
    issuerControlSha,
  };
  const digest = sha(JSON.stringify(identity));
  if (env.VERIFY_DEPLOYMENT_ID && digest !== env.VERIFY_OPERATION_SHA256)
    throw new Error(
      "Backup operation digest differs from the owner's approved checkpoint",
    );
  return { identity, digest };
}
async function routes() {
  return JSON.parse(
    await readFile(path.join(here, "legacy-redirects.json"), "utf8"),
  );
}
export async function prepare(source, root) {
  await mkdir(root); // new scratch directory only
  const meta = await prepareRelease({
    source,
    output: path.join(root, "package"),
    bootstrap: true,
  });
  if (
    meta.release !== RELEASE ||
    meta.sourceFiles.length !== 189 ||
    meta.files.length !== 297
  )
    throw new Error("Approved production artifact identity changed");
  await cloudflarePackage(
    path.join(root, "package"),
    path.join(root, "upload"),
    await routes(),
  );
  await mkdir(path.join(root, "evidence"));
  return meta;
}
async function api(endpoint, token) {
  if (
    !endpoint.startsWith(`/accounts/${ACCOUNT}/pages/projects/${PROJECT}`) ||
    /[?#\r\n]/.test(endpoint)
  )
    throw new Error("Unapproved read-only Pages endpoint");
  try {
    const listing =
      endpoint === `/accounts/${ACCOUNT}/pages/projects/${PROJECT}/deployments`;
    const url = new URL("https://api.cloudflare.com/client/v4" + endpoint);
    if (listing) url.search = "?page=1&per_page=25";
    const r = await fetch(url, {
      headers: { authorization: "Bearer " + token },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error();
    const j = await r.json();
    if (j.success !== true) throw new Error();
    return listing ? completeDeployments(j) : j.result;
  } catch {
    throw new Error("Pages metadata read failed; no scope expansion or retry");
  }
}
async function pinnedRunner(directory, token, runId, workflowSha) {
  const tool = path.join(here, "toolchain"),
    pin = JSON.parse(
      await readFile(path.join(tool, "toolchain-pin.json"), "utf8"),
    );
  const lock = JSON.parse(
    await readFile(path.join(tool, "package-lock.json"), "utf8"),
  );
  const cli = path.join(tool, "node_modules/wrangler/bin/wrangler.js");
  if (
    pin.version !== "4.166.0" ||
    sha(await readFile(cli)) !== pin.cliSha256 ||
    lock.packages["node_modules/wrangler"].integrity !== pin.integrity ||
    Object.entries(lock.packages).some(
      ([n, e]) =>
        n &&
        (!e.integrity?.startsWith("sha512-") ||
          !e.resolved?.startsWith("https://registry.npmjs.org/")),
    )
  )
    throw new Error("Pinned isolated deployment toolchain mismatch");
  try {
    const { stdout } = await exec(
      process.execPath,
      [
        cli,
        "pages",
        "deploy",
        directory,
        "--project-name=" + PROJECT,
        "--branch=" + BRANCH,
        "--commit-hash=" + SOURCE,
        "--commit-message=" + runMessage(runId, workflowSha),
        "--commit-dirty=false",
      ],
      {
        cwd: path.dirname(directory),
        timeout: 180000,
        maxBuffer: 1000000,
        env: {
          PATH: process.env.PATH,
          CLOUDFLARE_API_TOKEN: token,
          CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
          CI: "true",
          WRANGLER_SEND_METRICS: "false",
          WRANGLER_WRITE_LOGS: "false",
        },
      },
    );
    const urls = new Set(
      (
        stdout.match(
          /https:\/\/[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev\/?/g,
        ) ?? []
      ).map((u) => u.replace(/\/$/, "") + "/"),
    );
    if (urls.size !== 1) throw new Error();
    return [...urls][0];
  } catch {
    throw new Error(
      "Preview upload outcome uncertain; inspect existing deployments; never retry upload automatically",
    );
  }
}
async function checkPaths(origin) {
  const results = [];
  for (const p of [
    "/",
    "/services/",
    "/services/advertising/",
    "/services/cms-support/",
    "/government-buyers/",
    "/capability-statement/",
    "/design/?design=northside",
    "/previews/aer-field/",
    "/assets/justinj-industries-capability-statement.pdf",
  ]) {
    const r = await fetch(new URL(p, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (r.status !== 200 || !r.headers.get("x-robots-tag")?.includes("noindex"))
      throw new Error("Preview status/noindex failure");
    if (
      r.headers.get("content-type")?.includes("text/html") &&
      !p.startsWith("/previews/")
    ) {
      const html = await r.text();
      if (
        !/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.justinjindustries\.com\//i.test(
          html,
        )
      )
        throw new Error("Production canonical missing");
    } else await r.arrayBuffer();
    results.push({ path: p, status: r.status, noindex: true });
  }
  let redirects = 0;
  for (const map of await routes()) {
    const r = await fetch(new URL(map.source + "?jji_backup_check=1", origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const next = new URL(
      r.headers.get("location") ?? "",
      new URL(map.source, origin),
    );
    if (
      r.status !== 301 ||
      next.origin !== new URL(origin).origin ||
      next.pathname !== map.target ||
      next.search !== "?jji_backup_check=1"
    )
      throw new Error("Exact legacy redirect/query verification failed");
    await r.body?.cancel();
    const final = await fetch(next, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (final.status !== 200)
      throw new Error("Legacy redirect final status mismatch");
    await final.body?.cancel();
    redirects++;
  }
  return {
    paths: results,
    legacy301WithQuery: redirects,
    fragmentNote:
      "HTTP fragments are client-side; no Location fragment overwrites the inherited fragment.",
  };
}
async function save(root, name, value) {
  await writeFile(
    path.join(root, "evidence", name),
    JSON.stringify(value, null, 2) + "\n",
  );
}
export async function deployAndVerify(
  root,
  env = process.env,
  { apiRead = api, uploadPreview = pinnedRunner } = {},
) {
  assertContext(env);
  const token = env.CLOUDFLARE_PAGES_TOKEN;
  if (!token || /[\r\n]/.test(token))
    throw new Error("Protected Pages token absent");
  await verifyCloudflareDirectory(
    path.join(root, "package"),
    path.join(root, "upload"),
    await routes(),
  );
  const base = `/accounts/${ACCOUNT}/pages/projects/${PROJECT}`;
  const before = await apiRead(base, token);
  assertPreview(before);
  let deployment, origin;
  const requested = env.VERIFY_DEPLOYMENT_ID;
  if (requested) {
    if (!deploymentId.test(requested))
      throw new Error("Invalid verification-only deployment identity");
    deployment = await apiRead(base + "/deployments/" + requested, token);
    assertPreview(before, deployment);
    origin = deployment.url.replace(/\/$/, "") + "/";
  } else {
    const existing = await apiRead(base + "/deployments", token);
    if (
      !Array.isArray(existing) ||
      existing.length >= 25 ||
      existing.some((d) => d.deployment_trigger?.metadata?.branch === BRANCH)
    )
      throw new Error(
        "Existing test deployment or incomplete listing; inspect outcome, use verification-only mode, never duplicate",
      );
    await save(root, "write-intent.json", {
      state: "uncertain-before-upload",
      sourceCommit: SOURCE,
      workflowCommit: env.GITHUB_SHA,
      runId: env.GITHUB_RUN_ID,
      branch: BRANCH,
    });
    origin = await uploadPreview(
      path.join(root, "upload"),
      token,
      env.GITHUB_RUN_ID,
      env.GITHUB_SHA,
    );
    const list = await apiRead(base + "/deployments", token);
    const matches = list.filter(
      (d) => d.url.replace(/\/$/, "") + "/" === origin,
    );
    if (matches.length !== 1)
      throw new Error(
        "Upload receipt not found in provider metadata; inspect before retry",
      );
    [deployment] = matches;
    assertPreview(before, deployment);
  }
  const operation = verifyPreviewOperation(
    deployment,
    before.canonical_deployment.id,
    env,
  );
  if (deployment.latest_stage?.status !== "success")
    throw new Error("Preview deployment not successful; inspect before retry");
  if (!requested && env.GITHUB_OUTPUT)
    await appendFile(
      env.GITHUB_OUTPUT,
      `operation_sha256=${operation.digest}\n`,
    );
  const issued = await createRecoveryReceipt({
    packageRoot: path.join(root, "package"),
    origin,
    bootstrapOrigin: RAW,
    sourceCommit: SOURCE,
    workflowCommit: env.GITHUB_SHA,
    workflowRunId: env.GITHUB_RUN_ID,
  });
  await writeFile(
    path.join(root, "evidence/recovery-receipt.json"),
    issued.bytes,
  );
  await writeFile(
    path.join(root, "evidence/recovery-receipt.sha256"),
    issued.sha256 + "\n",
  );
  const recovered = path.join(root, "recovered");
  await recoverPackage({
    receiptBytes: issued.bytes,
    expectedDigest: issued.sha256,
    output: recovered,
  });
  if (
    JSON.stringify(await verifyPackage(recovered)) !==
    JSON.stringify(await verifyPackage(path.join(root, "package")))
  )
    throw new Error("Actual hosted recovery did not match package metadata");
  const checks = await checkPaths(origin),
    after = await apiRead(base, token);
  if (
    after.canonical_deployment?.id !== before.canonical_deployment.id ||
    after.production_branch !== before.production_branch
  )
    throw new Error("Project production deployment changed; stop");
  const provider = {
    schema: "jji-backup-only-provider-test-2",
    issuingOperation: operation.identity,
    issuingOperationSha256: operation.digest,
    verifier: { runId: env.GITHUB_RUN_ID, controlSha: env.GITHUB_SHA },
    repository: REPO,
    sourceCommit: SOURCE,
    workflowCommit: env.GITHUB_SHA,
    runId: env.GITHUB_RUN_ID,
    project: PROJECT,
    environment: "preview",
    branch: BRANCH,
    deploymentId: deployment.id,
    origin,
    originalProductionDeploymentId: before.canonical_deployment.id,
    productionDeploymentUnchanged: true,
    recoveryReceiptSha256: issued.sha256,
    sourceIdentity: RELEASE,
    verifiedPublicFiles: issued.receipt.publicFiles.length,
    verifiedStageFiles: issued.receipt.stageFiles.length,
    recovery: "actual HTTPS bytes and SHA256; no mocks",
    verificationOnly: !!requested,
    providerCommitHash: deployment.deployment_trigger.metadata.commit_hash,
    checks,
    primaryBootstrap: false,
    liveFailover: false,
  };
  await save(root, "provider-receipt.json", provider);
  const files = await readdir(path.join(root, "evidence"));
  if (
    files.some(
      (n) =>
        ![
          "write-intent.json",
          "recovery-receipt.json",
          "recovery-receipt.sha256",
          "provider-receipt.json",
        ].includes(n),
    )
  )
    throw new Error("Unexpected evidence artifact file");
  let size = 0;
  for (const n of files)
    size += (await stat(path.join(root, "evidence", n))).size;
  if (size > 2 * 1024 * 1024)
    throw new Error(
      "Small test-receipt artifact exceeds 2MiB; stop without upload",
    );
  console.log(
    JSON.stringify({
      previewUrl: origin,
      deploymentId: deployment.id,
      publicFiles: provider.verifiedPublicFiles,
      stageFiles: provider.verifiedStageFiles,
      receiptSha256: issued.sha256,
      evidenceBytes: size,
      legacy301: checks.legacy301WithQuery,
      productionUnchanged: true,
    }),
  );
  return provider;
}
export async function readback(root, downloaded) {
  const original = path.join(root, "evidence"),
    names = (await readdir(original)).sort();
  if (
    JSON.stringify(names) !== JSON.stringify((await readdir(downloaded)).sort())
  )
    throw new Error("Artifact readback file inventory mismatch");
  for (const n of names)
    if (
      !(await readFile(path.join(original, n))).equals(
        await readFile(path.join(downloaded, n)),
      )
    )
      throw new Error("Artifact readback exact bytes mismatch");
  const bytes = await readFile(path.join(downloaded, "recovery-receipt.json")),
    digest = (
      await readFile(path.join(downloaded, "recovery-receipt.sha256"), "utf8")
    ).trim();
  decodeReceipt(bytes, digest);
  await recoverPackage({
    receiptBytes: bytes,
    expectedDigest: digest,
    output: path.join(root, "artifact-restored"),
  });
  const same =
    JSON.stringify(
      await verifyPackage(path.join(root, "artifact-restored")),
    ) === JSON.stringify(await verifyPackage(path.join(root, "package")));
  if (!same) throw new Error("Independent artifact readback recovery mismatch");
  console.log(
    "Verified uploaded/downloaded artifact bytes and genuine hosted recovery; no primary publication.",
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, a, b] = process.argv.slice(2);
  try {
    if (command === "prepare") await prepare(a, b);
    else if (command === "deploy") await deployAndVerify(a);
    else if (command === "readback") await readback(a, b);
    else throw new Error("Explicit backup-test command required");
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
