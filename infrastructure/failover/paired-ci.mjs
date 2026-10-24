// Inactive workflow's concrete runner. Importing this module performs no I/O.
// External writes require the exact protected manual context and explicit policy.
import { mkdir, readFile, writeFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { actionBridge } from "./action-bridge.mjs";
import { verifyOwnerMacProof } from "./owner-archive.mjs";
import { prepareRelease, verifyPackage } from "./prepare-release.mjs";
import { cloudflarePackage } from "./cloudflare-package.mjs";
import {
  createRecoveryReceipt,
  decodeReceipt,
  recoverPackage,
} from "./recovery-receipt.mjs";
import {
  inspectTrustedCi,
  githubInspector,
  verifyOriginManifest,
  verifyToolchain,
} from "./trusted-inspectors.mjs";
import {
  createProviderAdapters,
  WriteJournal,
} from "./deployment-adapters.mjs";
import {
  bindBootstrapAdapters,
  bindReleaseAdapters,
} from "./bind-release-adapters.mjs";
import {
  coordinateBootstrap,
  coordinateRelease,
} from "./coordinate-release.mjs";
import { artifactPlan } from "./artifact-plan.mjs";
import { assertStorageBudget } from "./release-policy.mjs";
import { inspectLogicalInventory, RETENTION } from "./storage-admission.mjs";
import { sanitizedJournal } from "./recovery-store.mjs";

const REPO = "JustinJIndustries/JustinJ_Industries_Website";
const ACCOUNT = "986b5334eba2d05d253ee98ca9842dfe";
const PROJECT = "jji-backup-20261023";
const RAW = "https://ac3af448.jji-backup-20261023.pages.dev/";
const SHA = /^[a-f0-9]{40}$/;
const hash = (b) => createHash("sha256").update(b).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const here = path.dirname(new URL(import.meta.url).pathname);
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
async function save(file, value) {
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
}

export function assertPairedInputs(env, event) {
  if (
    env.GITHUB_ACTOR !== "JustinJIndustries" ||
    env.GITHUB_RUN_ATTEMPT !== "1" ||
    env.PAIRED_WRITES_APPROVED !== "yes" ||
    !SHA.test(env.SOURCE_COMMIT ?? "") ||
    !/^[a-f0-9]{64}$/.test(env.APPROVED_RELEASE ?? "") ||
    !["prepare", "promote"].includes(env.PAIRED_PHASE) ||
    !["bootstrap", "release"].includes(env.PAIRED_MODE) ||
    event.inputs?.phase !== env.PAIRED_PHASE ||
    event.inputs?.mode !== env.PAIRED_MODE ||
    event.inputs?.source_commit !== env.SOURCE_COMMIT ||
    event.inputs?.approved_public_release !== env.APPROVED_RELEASE ||
    env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT
  )
    throw new Error("Unapproved paired publication inputs; no writes");
  const policy = JSON.parse(env.POLICY_APPROVAL ?? "null");
  if (
    !policy ||
    policy.allowInventoryAdmission !== true ||
    policy.allowOwnerMacArchive !== true ||
    policy.retentionApproved !== true ||
    (env.PAIRED_MODE === "bootstrap" && policy.noWorkerRouteConfirmed !== true)
  )
    throw new Error(
      "Explicit inventory, owner-Mac archive and retention policy approval required",
    );
  return policy;
}

export async function requestOidc(env, fetcher = fetch) {
  const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".actions.githubusercontent.com")
  )
    throw new Error("Untrusted runner OIDC endpoint");
  // Match actions/deploy-pages core.getIDToken(): preserve the runner's default audience.
  const r = await fetcher(url, {
    headers: { authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("OIDC request refused");
  const j = await r.json();
  if (typeof j.value !== "string" || !j.value) throw new Error("OIDC absent");
  return j.value; // memory only, never serialized
}

// Fresh owner-reviewed account inventory is the basis, not fabricated capacity.
// Re-read every current-repository artifact before each write; retain other
// account repositories/Packages evidence and its ORIGINAL 15-minute timestamp.
async function refreshBudget(env, read, context) {
  if ((await read(`/repos/${REPO}/commits/main`)).sha !== context.sha)
    throw new Error("Main advanced during publication; stop before next write");
  const base = JSON.parse(env.STORAGE_SNAPSHOT ?? "null");
  if (!base?.logicalInventory)
    throw new Error("Complete approved account snapshot required");
  const inventory = structuredClone(base.logicalInventory);
  inventory.currentRunId = context.runId;
  const own = inventory.repositories.find((r) => r.fullName === REPO);
  if (!own) throw new Error("Current repository omitted from inventory");
  own.artifacts = [];
  for (let page = 1; ; page++) {
    if (page > 100) throw new Error("Artifact inventory pagination cap");
    const data = await read(
      `/repos/${REPO}/actions/artifacts?per_page=100&page=${page}`,
    );
    if (!Array.isArray(data.artifacts))
      throw new Error("Incomplete artifact inventory");
    for (const a of data.artifacts)
      if (!a.expired)
        own.artifacts.push({
          id: a.id,
          name: a.name,
          bytes: a.size_in_bytes,
          runId: String(a.workflow_run?.id ?? ""),
        });
    if (data.artifacts.length < 100) break;
  }
  const result = {
    ...base,
    logicalInventory: inventory,
    ...inspectLogicalInventory(inventory, base.observedAt),
  };
  assertStorageBudget(result, Date.now(), {
    allowInventoryAdmission: true,
    currentRunId: context.runId,
  });
  return result;
}

async function readGithub(endpoint, token, fetcher = fetch) {
  if (!endpoint.startsWith(`/repos/${REPO}/`) || /[\r\n]/.test(endpoint))
    throw new Error("Unapproved GitHub namespace");
  const r = await fetcher("https://api.github.com" + endpoint, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
    },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("GitHub read failed; no scope expansion");
  return r.json();
}
async function readPages(suffix, token) {
  if (!/^\/(?:deployments)?$/.test(suffix))
    throw new Error("Unapproved Pages read");
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}${suffix === "/" ? "" : suffix}`,
    {
      headers: { authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw new Error("Pages project inspection failed");
  const body = await r.json();
  if (body.success !== true) throw new Error("Pages read refused");
  return body.result;
}

export function assertCandidate(candidate, receipt, env, run, artifact) {
  if (
    candidate?.schema !== 1 ||
    candidate.sourceCommit !== env.SOURCE_COMMIT ||
    receipt.sourceCommit !== env.SOURCE_COMMIT ||
    receipt.metadata.release !== env.APPROVED_RELEASE ||
    receipt.workflowCommit !== env.GITHUB_SHA ||
    candidate.workflowCommit !== env.GITHUB_SHA ||
    receipt.workflowRunId !== String(run.id) ||
    candidate.runId !== String(run.id) ||
    candidate.mode !== env.PAIRED_MODE ||
    run.conclusion !== "success" ||
    candidate.receiptSha256 !== env.CANDIDATE_RECEIPT_SHA256 ||
    String(run.id) !== env.CANDIDATE_RUN_ID ||
    run.head_sha !== env.GITHUB_SHA ||
    run.head_branch !== "main" ||
    run.event !== "workflow_dispatch" ||
    run.path !== ".github/workflows/paired-release.yml" ||
    run.repository?.full_name !== REPO ||
    run.actor?.login !== "JustinJIndustries" ||
    artifact.expired !== false ||
    artifact.workflow_run?.id !== run.id ||
    artifact.workflow_run?.head_sha !== env.GITHUB_SHA ||
    artifact.name !== `paired-candidate-${run.id}` ||
    artifact.size_in_bytes > 2 * 1024 * 1024
  )
    throw new Error("Prepared backup/source/run provenance mismatch");
}

export async function runPreparedPublisher({
  packageRoot,
  candidate,
  receiptBytes,
  receiptSha256,
  proof,
  policy,
  context,
  provider,
  bridge,
  inspectCurrent,
  verifyPrimary,
  verifyBackup,
  oidc,
  readArtifact,
  readBackRoot,
  journal,
  code,
  expectedWorkerDeployment,
  writesApproved = false,
  beforeArtifactWrite = async () => {
    throw new Error("Fresh write budget missing");
  },
}) {
  if (!writesApproved) throw new Error("Prepared publisher is disabled");
  const receipt = decodeReceipt(receiptBytes, receiptSha256);
  const meta = await verifyPackage(packageRoot);
  if (!same(meta, receipt.metadata))
    throw new Error("Prepared package/receipt mismatch");
  const archive = verifyOwnerMacProof(proof, receipt, receiptSha256, {
    approved: policy.allowOwnerMacArchive === true,
  });
  const bindings = {
    provider: {
      ...provider,
      uploadBackup: async () => {
        await verifyBackup(receipt.origin, meta.files); // preuploaded immutable deployment, no second upload
        return { origin: receipt.origin };
      },
    },
    release: meta,
    packageRoot,
    // Metadata adapter is re-created from exactly recovered bytes, not new source.
    cloudflareDirectory: candidate.cloudflareDirectory,
    routes: candidate.routes,
    inspectCurrent,
    verifyPrimary,
    verifyBackup,
    code,
    expectedWorkerDeployment,
    writesApproved: true,
    githubArtifactFor: async (_directory, phase) => {
      await beforeArtifactWrite();
      const a = await bridge.request(phase);
      return {
        artifactId: a.id,
        artifactDigest: "sha256:" + a.digest,
        oidcToken: await oidc(),
      };
    },
    receiptRecorder: async (boundMeta, origin) => {
      if (!same(boundMeta, meta) || origin !== receipt.origin)
        throw new Error("Recovery bound to wrong release");
      const folder = path.join(readBackRoot, "record");
      await mkdir(folder);
      const logged = sanitizedJournal(await readFile(journal.file));
      if (logged.length > RETENTION.journalBytes)
        throw new Error("Recovery journal size");
      const files = {
        "receipt.json": receiptBytes,
        "archive-proof.json": Buffer.from(JSON.stringify(archive) + "\n"),
        "journal.json": logged,
      };
      for (const [name, bytes] of Object.entries(files))
        await writeFile(path.join(folder, name), bytes, { flag: "wx" });
      if (
        Object.values(files).reduce((n, b) => n + b.length, 0) >
        RETENTION.recoveryArtifactBytes
      )
        throw new Error("Recovery record size");
      await beforeArtifactWrite();
      const a = await bridge.request("recovery");
      const observed = await readArtifact(a.id);
      if (
        observed.digest !== "sha256:" + a.digest ||
        observed.workflow_run?.id !== Number(context.runId) ||
        observed.workflow_run?.head_sha !== context.sha ||
        observed.name !== "paired-release-receipt" ||
        observed.expired !== false ||
        observed.id !== a.id ||
        !Number.isSafeInteger(observed.size_in_bytes) ||
        observed.size_in_bytes < 1 ||
        !Number.isFinite(Date.parse(observed.expires_at)) ||
        !Number.isFinite(Date.parse(observed.created_at)) ||
        observed.size_in_bytes >
          Math.ceil(RETENTION.recoveryArtifactBytes * 1.2) ||
        Math.abs(
          Date.parse(observed.expires_at) -
            Date.parse(observed.created_at) -
            7 * 86400000,
        ) > 120000
      )
        throw new Error(
          "Recovery artifact provenance/digest/retention mismatch",
        );
      const downloaded = path.join(readBackRoot, "readback");
      if (!same((await readdir(downloaded)).sort(), Object.keys(files).sort()))
        throw new Error("Unexpected artifact files");
      for (const [name, bytes] of Object.entries(files))
        if (
          (await lstat(path.join(downloaded, name))).isSymbolicLink() ||
          !Buffer.from(await readFile(path.join(downloaded, name))).equals(
            bytes,
          )
        )
          throw new Error("Actual recovery artifact readback mismatch");
      return {
        bytes: receiptBytes,
        sha256: receiptSha256,
        durable: true,
        archive,
      };
    },
  };
  const adapters = (
    candidate.mode === "bootstrap" ? bindBootstrapAdapters : bindReleaseAdapters
  )(bindings);
  return (
    candidate.mode === "bootstrap" ? coordinateBootstrap : coordinateRelease
  )(packageRoot, adapters);
}

async function main(command, root, env = process.env) {
  if (command === "paths") {
    for (const value of [env.RUNNER_TEMP, env.GITHUB_WORKSPACE])
      if (
        typeof value !== "string" ||
        !path.isAbsolute(value) ||
        /[\r\n]/.test(value)
      )
        throw new Error("Invalid trusted runner path");
    const paths = {
      PAIRED_ROOT: path.join(env.RUNNER_TEMP, "jji-paired"),
      CANDIDATE_DIRECTORY: path.join(env.RUNNER_TEMP, "incoming-candidate"),
      PREVIOUS_RECEIPT_FILE: path.join(
        env.RUNNER_TEMP,
        "previous-receipt/receipt.json",
      ),
      SOURCE_DIST: path.join(env.GITHUB_WORKSPACE, "production/dist"),
    };
    await writeFile(
      env.GITHUB_ENV,
      Object.entries(paths)
        .map(([k, v]) => `${k}=${v}\n`)
        .join(""),
      { flag: "a" },
    );
    return;
  }
  const bridge = actionBridge(root, { timeoutMs: 180000 });
  if (command === "inputs") {
    for (const [value, prefix] of [
      [env.PREPARED_CANDIDATE, "CANDIDATE"],
      [env.PREVIOUS_RECEIPT, "PREVIOUS"],
    ]) {
      if (!value) continue;
      const v = JSON.parse(value);
      if (
        !/^\d+$/.test(String(v.run_id)) ||
        !/^\d+$/.test(String(v.artifact_id)) ||
        !/^[a-f0-9]{64}$/.test(v.receipt_sha256 ?? "")
      )
        throw new Error("Invalid candidate/predecessor identity");
      await writeFile(
        env.GITHUB_ENV,
        `${prefix}_RUN_ID=${v.run_id}\n${prefix}_ARTIFACT_ID=${v.artifact_id}\n${prefix}_RECEIPT_SHA256=${v.receipt_sha256}\n`,
        { flag: "a" },
      );
      if (prefix === "CANDIDATE" && v.expected_worker_deployment) {
        if (!/^[a-f0-9-]{36}$/.test(v.expected_worker_deployment))
          throw new Error("Invalid expected Worker deployment");
        await writeFile(
          env.GITHUB_ENV,
          `EXPECTED_WORKER_DEPLOYMENT=${v.expected_worker_deployment}\n`,
          { flag: "a" },
        );
      }
    }
    return;
  }
  if (command === "wait") return bridge.waitRequest(env.ARTIFACT_PHASE);
  if (command === "summary") {
    const bytes = await readFile(path.join(root, "journal.json")).catch(
      () => null,
    );
    if (bytes && env.GITHUB_STEP_SUMMARY) {
      const safe = sanitizedJournal(bytes).toString("utf8");
      await writeFile(
        env.GITHUB_STEP_SUMMARY,
        `\nSanitized publication journal (inspect before retry):\n\n\`\`\`json\n${safe}\`\`\`\n`,
        { flag: "a" },
      );
    }
    return;
  }
  if (command === "action-reply") {
    if (!/^\d+$/.test(env.ARTIFACT_ID ?? ""))
      throw new Error("Invalid official Pages artifact ID");
    const a = await readGithub(
      `/repos/${REPO}/actions/artifacts/${env.ARTIFACT_ID}`,
      env.GH_READ_TOKEN,
    );
    if (
      a.workflow_run?.id !== Number(env.GITHUB_RUN_ID) ||
      a.workflow_run?.head_sha !== env.GITHUB_SHA ||
      a.name !== `paired-${env.ARTIFACT_PHASE}` ||
      !/^sha256:[a-f0-9]{64}$/.test(a.digest ?? "")
    )
      throw new Error("Untrusted official Pages artifact");
    return bridge.reply(env.ARTIFACT_PHASE, {
      id: a.id,
      digest: a.digest.slice(7),
    });
  }
  if (command === "reply")
    return bridge.reply(env.ARTIFACT_PHASE, {
      id: Number(env.ARTIFACT_ID),
      digest: env.ARTIFACT_DIGEST,
    });
  if (command === "status") {
    const end = Date.now() + 180000;
    while (Date.now() < end) {
      const s = await json(path.join(root, "outcome.json")).catch(() => null);
      if (s) {
        if (s.status !== "success")
          throw new Error("Publisher failed; no retry");
        return s;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Publisher outcome uncertain");
  }
  const event = await json(env.GITHUB_EVENT_PATH),
    policy = assertPairedInputs(env, event);
  const context = await inspectTrustedCi({
    env,
    event,
    remote: execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
    }),
    read: githubInspector({ token: env.GH_READ_TOKEN }),
  });
  const read = (endpoint) => readGithub(endpoint, env.GH_READ_TOKEN);
  for (const status of [
    "in_progress",
    "queued",
    "waiting",
    "requested",
    "pending",
  ]) {
    const runs = await read(
      `/repos/${REPO}/actions/workflows/jekyll-gh-pages.yml/runs?status=${status}&per_page=1`,
    );
    if (!Array.isArray(runs.workflow_runs) || runs.workflow_runs.length)
      throw new Error("Legacy publisher has an unfinished run; stop");
  }
  const storagePolicy = {
    allowInventoryAdmission: true,
    currentRunId: context.runId,
  };
  const refreshStorage = () => refreshBudget(env, read, context);
  if (command === "guard") {
    await refreshStorage();
    return;
  }
  const journal = new WriteJournal(path.join(root, "journal.json"));
  const provider = createProviderAdapters({
    account: ACCOUNT,
    worker:
      env.PAIRED_MODE === "bootstrap" ? "jji-failover-test" : "jji-failover",
    pagesToken: env.CLOUDFLARE_PAGES_TOKEN,
    workerToken: env.CLOUDFLARE_WORKER_TOKEN,
    githubToken: env.GH_READ_TOKEN,
    context,
    storage: await refreshStorage(),
    storagePolicy,
    refreshStorage,
    journal,
    writesApproved: true,
    ...(command === "prepare"
      ? await verifyToolchain(path.join(here, "toolchain"))
      : {}),
  });
  const packageRoot = path.join(root, "package"),
    cf = path.join(root, "cloudflare");
  const routes = await json(path.join(here, "legacy-redirects.json"));
  if (command === "prepare") {
    await mkdir(root);
    const previous =
      env.PAIRED_MODE === "release" ? path.join(root, "previous") : undefined;
    let prior;
    if (previous) {
      const b = await readFile(env.PREVIOUS_RECEIPT_FILE);
      prior = { bytes: b, sha256: env.PREVIOUS_RECEIPT_SHA256 };
      const predecessor = decodeReceipt(b, prior.sha256);
      const priorRun = await read(
        `/repos/${REPO}/actions/runs/${env.PREVIOUS_RUN_ID}`,
      );
      const priorArtifact = await read(
        `/repos/${REPO}/actions/artifacts/${env.PREVIOUS_ARTIFACT_ID}`,
      );
      if (
        priorRun.conclusion !== "success" ||
        priorRun.path !== ".github/workflows/paired-release.yml" ||
        priorRun.head_branch !== "main" ||
        priorArtifact.workflow_run?.id !== Number(env.PREVIOUS_RUN_ID) ||
        priorArtifact.name !== "paired-release-receipt" ||
        priorArtifact.expired !== false ||
        predecessor.repository !== REPO
      )
        throw new Error("Predecessor artifact/run not trusted");
      await recoverPackage({
        receiptBytes: b,
        expectedDigest: prior.sha256,
        output: previous,
      });
    }
    const meta = await prepareRelease({
      source: env.SOURCE_DIST,
      output: packageRoot,
      previous,
      bootstrap: !previous,
    });
    if (meta.release !== env.APPROVED_RELEASE)
      throw new Error("Unapproved public build");
    const primary = previous
      ? decodeReceipt(prior.bytes, prior.sha256).metadata.files
      : meta.sourceFiles;
    await verifyOriginManifest("https://www.justinjindustries.com/", primary, {
      requirePrimaryMarker: !!previous,
    });
    await cloudflarePackage(packageRoot, cf, routes);
    const plan = await artifactPlan(
      packageRoot,
      previous,
      await refreshStorage(),
      storagePolicy,
    );
    const project = await readPages("/", env.CLOUDFLARE_PAGES_TOKEN);
    if (
      project.name !== PROJECT ||
      project.production_branch === "failover-preview"
    )
      throw new Error("Preview branch would publish production");
    const deployed = await provider.uploadBackup({
      directory: cf,
      key: `prepare-${meta.release.slice(0, 40)}`,
    });
    const deployments = await readPages(
      "/deployments",
      env.CLOUDFLARE_PAGES_TOKEN,
    );
    if (
      !Array.isArray(deployments) ||
      !deployments.some(
        (d) =>
          d.environment === "preview" &&
          d.url.replace(/\/$/, "") + "/" === deployed.origin &&
          d.deployment_trigger?.metadata?.branch === "failover-preview",
      )
    )
      throw new Error("Preview outcome unverified; do not repeat");
    const issued = await createRecoveryReceipt({
      packageRoot,
      origin: deployed.origin,
      sourceCommit: env.SOURCE_COMMIT,
      workflowCommit: context.sha,
      workflowRunId: context.runId,
      bootstrapOrigin: RAW,
      previousReceiptBytes: prior?.bytes,
      previousReceiptDigest: prior?.sha256,
    });
    await mkdir(path.join(root, "candidate"));
    await writeFile(path.join(root, "candidate/receipt.json"), issued.bytes, {
      flag: "wx",
    });
    await save(path.join(root, "candidate/candidate.json"), {
      schema: 1,
      mode: env.PAIRED_MODE,
      runId: context.runId,
      sourceCommit: env.SOURCE_COMMIT,
      workflowCommit: context.sha,
      receiptSha256: issued.sha256,
    });
    if (env.GITHUB_STEP_SUMMARY)
      await writeFile(
        env.GITHUB_STEP_SUMMARY,
        `Prepared backup only. Receipt SHA256: ${issued.sha256}\nSource: ${env.SOURCE_COMMIT}\nOrigin: ${deployed.origin}\nReserved peak bytes: ${plan.peakBytes}\nOwner must restore an archive before a separate protected promotion run.\n`,
        { flag: "a" },
      );
    return;
  }
  if (command !== "promote") throw new Error("Unknown publication command");
  await mkdir(root);
  const incoming = env.CANDIDATE_DIRECTORY;
  const bytes = await readFile(path.join(incoming, "receipt.json"));
  if (hash(bytes) !== env.CANDIDATE_RECEIPT_SHA256)
    throw new Error("Owner-pinned candidate digest mismatch");
  const r = decodeReceipt(bytes, env.CANDIDATE_RECEIPT_SHA256),
    candidate = await json(path.join(incoming, "candidate.json"));
  const run = await read(`/repos/${REPO}/actions/runs/${candidate.runId}`);
  const artifact = await read(
    `/repos/${REPO}/actions/artifacts/${env.CANDIDATE_ARTIFACT_ID}`,
  );
  assertCandidate(candidate, r, env, run, artifact);
  verifyOwnerMacProof(
    JSON.parse(env.OWNER_ARCHIVE_PROOF),
    r,
    env.CANDIDATE_RECEIPT_SHA256,
    { approved: policy.allowOwnerMacArchive },
  );
  await recoverPackage({
    receiptBytes: bytes,
    expectedDigest: env.CANDIDATE_RECEIPT_SHA256,
    output: packageRoot,
  });
  await cloudflarePackage(packageRoot, cf, routes);
  await artifactPlan(
    packageRoot,
    undefined,
    await refreshStorage(),
    storagePolicy,
  );
  let pointer;
  if (candidate.mode !== "bootstrap") {
    pointer = await provider.currentWorkerDeployment();
    if (pointer.id !== env.EXPECTED_WORKER_DEPLOYMENT)
      throw new Error("Worker changed since review");
  }
  const meta = r.metadata;
  const verifyPrimary = (entries) =>
    verifyOriginManifest("https://www.justinjindustries.com/", entries, {
      requirePrimaryMarker: candidate.mode !== "bootstrap",
    });
  const baseline =
    candidate.mode === "bootstrap" ? meta.sourceFiles : meta.previousFiles;
  await verifyPrimary(baseline);
  const result = await runPreparedPublisher({
    writesApproved: true,
    packageRoot,
    candidate: { ...candidate, cloudflareDirectory: cf, routes },
    receiptBytes: bytes,
    receiptSha256: env.CANDIDATE_RECEIPT_SHA256,
    proof: JSON.parse(env.OWNER_ARCHIVE_PROOF),
    policy,
    context,
    provider,
    bridge,
    inspectCurrent: async () => {
      await verifyPrimary(baseline);
      return candidate.mode === "bootstrap"
        ? {
            exclusivePublisher: true,
            workerActive: false,
            primaryFiles: meta.sourceFiles,
          }
        : {
            exclusivePublisher: true,
            primaryFiles: meta.previousFiles,
            release: meta.previousRelease,
            pointerCurrent: (await provider.currentWorkerConfiguration())
              .current,
          };
    },
    verifyPrimary,
    verifyBackup: (origin, entries) => verifyOriginManifest(origin, entries),
    oidc: () => requestOidc(env),
    readArtifact: (id) => read(`/repos/${REPO}/actions/artifacts/${id}`),
    readBackRoot: root,
    journal,
    code: await readFile(path.join(here, "worker.mjs"), "utf8"),
    expectedWorkerDeployment: pointer?.id,
    beforeArtifactWrite: async () => {
      await artifactPlan(
        packageRoot,
        undefined,
        await refreshStorage(),
        storagePolicy,
      );
    },
  });
  await save(path.join(root, "outcome.json"), { status: "success", ...result });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [command, root] = process.argv.slice(2);
  main(command, root).catch(async () => {
    // No raw provider response/URL/credential or stack is printed.
    if (command === "promote")
      await save(path.join(root, "outcome.json"), { status: "failed" }).catch(
        () => {},
      );
    console.error(
      "Paired publisher stopped. Inspect phase/provider outcome before any retry.",
    );
    process.exitCode = 1;
  });
}
