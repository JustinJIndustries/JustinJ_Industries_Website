import { readFile, writeFile, mkdir, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import {
  REPO,
  OWNER,
  OWNER_ID,
  CHECKPOINT,
  hash,
  validateRequest,
  validateProof,
  requestName,
  proofName,
  assertRun,
  assertArtifact,
  assertCheckpointArtifactBudget,
} from "./public-checkpoint.mjs";

export function githubReader(token, fetcher = globalThis.fetch) {
  if (typeof token !== "string" || !token || /[\r\n]/.test(token))
    throw new Error("Existing GitHub read credential required");
  return async (endpoint) => {
    if (!endpoint.startsWith(`/repos/${REPO}/`) || /[\r\n#]/.test(endpoint))
      throw new Error("Unapproved checkpoint inspection endpoint");
    const response = await fetcher("https://api.github.com" + endpoint, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error("Checkpoint GitHub read failed; no access expansion");
    return response.json();
  };
}
export async function listArtifacts(read) {
  const all = [];
  for (let page = 1; page <= 100; page++) {
    const r = await read(
      `/repos/${REPO}/actions/artifacts?per_page=100&page=${page}`,
    );
    if (!Array.isArray(r.artifacts))
      throw new Error("Incomplete checkpoint artifact inventory");
    all.push(...r.artifacts);
    if (r.artifacts.length < 100) return all;
  }
  throw new Error("Checkpoint artifact pagination cap");
}
export async function assertProtectedOwner(read) {
  const env = await read(`/repos/${REPO}/environments/failover-sync`);
  const policies = await read(
    `/repos/${REPO}/environments/failover-sync/deployment-branch-policies`,
  );
  const reviewers = env.protection_rules?.find(
    (x) => x.type === "required_reviewers",
  )?.reviewers;
  if (
    env.name !== "failover-sync" ||
    env.can_admins_bypass !== false ||
    env.deployment_branch_policy?.custom_branch_policies !== true ||
    reviewers?.length !== 1 ||
    !reviewers?.some(
      (x) =>
        x.type === "User" &&
        x.reviewer?.login === OWNER &&
        x.reviewer?.id === OWNER_ID,
    ) ||
    policies.branch_policies?.length !== 1 ||
    policies.branch_policies[0].name !== "main" ||
    policies.branch_policies[0].type !== "branch"
  )
    throw new Error(
      "Protected owner/main-only checkpoint environment required",
    );
  return env;
}
export async function authenticateRecord({
  read,
  record,
  recordSha256,
  request,
  requestDigest,
  reply,
  now = Date.now(),
}) {
  validateRequest(request, { now });
  if (
    !record ||
    Object.keys(record).sort().join() !==
      [
        "schema",
        "proofRunId",
        "requestArtifactId",
        "requestArtifactDigest",
        "proof",
      ]
        .sort()
        .join() ||
    record.schema !== "jji-protected-m1-proof-1" ||
    !/^\d+$/.test(record.proofRunId ?? "") ||
    !Number.isSafeInteger(record.requestArtifactId) ||
    !/^[a-f0-9]{64}$/.test(recordSha256 ?? "")
  )
    throw new Error("Unauthenticated M1 proof record");
  const artifact = await read(`/repos/${REPO}/actions/artifacts/${reply.id}`);
  assertArtifact(artifact, {
    runId: record.proofRunId,
    control: request.workflowCommit,
    name: proofName(request) + "-" + recordSha256,
    maxBytes: CHECKPOINT.proofBytes,
    now,
  });
  if (artifact.digest !== "sha256:" + reply.digest)
    throw new Error("M1 proof artifact digest mismatch");
  assertRun(await read(`/repos/${REPO}/actions/runs/${record.proofRunId}`), {
    runId: record.proofRunId,
    control: request.workflowCommit,
    proof: true,
  });
  assertRun(await read(`/repos/${REPO}/actions/runs/${request.parentRunId}`), {
    runId: request.parentRunId,
    control: request.workflowCommit,
  });
  if (
    (await read(`/repos/${REPO}/commits/main`)).sha !== request.workflowCommit
  )
    throw new Error("Main advanced during M1 checkpoint");
  await assertProtectedOwner(read);
  const original = await read(
    `/repos/${REPO}/actions/artifacts/${record.requestArtifactId}`,
  );
  assertArtifact(original, {
    runId: request.parentRunId,
    control: request.workflowCommit,
    name: requestName(request.parentRunId, request.phase),
    maxBytes: CHECKPOINT.requestBytes,
    now,
  });
  if (
    original.digest !== record.requestArtifactDigest ||
    Date.parse(original.created_at) < request.issuedAt - CHECKPOINT.skewMs ||
    Date.parse(artifact.created_at) < request.issuedAt - CHECKPOINT.skewMs
  )
    throw new Error("M1 proof request artifact mismatch");
  validateProof(record.proof, request, requestDigest, {
    now,
    requestArtifact: original,
  });
  return original;
}

export async function waitForProof({
  root,
  phase,
  read,
  env,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  requestName(env.GITHUB_RUN_ID, phase);
  const bytes = await readFile(
    path.join(root, "checkpoints", phase, "request.json"),
  );
  const request = validateRequest(JSON.parse(bytes), { now: now() });
  if (
    request.parentRunId !== env.GITHUB_RUN_ID ||
    request.workflowCommit !== env.GITHUB_SHA ||
    request.phase !== phase
  )
    throw new Error("Checkpoint polling identity mismatch");
  const end = Math.min(request.expiresAt, now() + CHECKPOINT.waitMs);
  while (now() < end) {
    const matches = (await listArtifacts(read)).filter(
      (a) =>
        !a.expired &&
        new RegExp("^" + proofName(request) + "-[a-f0-9]{64}$").test(a.name),
    );
    if (matches.length > 1)
      throw new Error("Duplicate M1 proof artifacts; no replay");
    if (matches.length) {
      const a = matches[0],
        runId = String(a.workflow_run?.id ?? "");
      const run = await read(`/repos/${REPO}/actions/runs/${runId}`);
      if (run.status === "completed") {
        assertRun(run, { runId, control: request.workflowCommit, proof: true });
        assertArtifact(a, {
          runId,
          control: request.workflowCommit,
          name: a.name,
          maxBytes: CHECKPOINT.proofBytes,
          now: now(),
        });
        await writeFile(
          env.GITHUB_ENV,
          `PUBLIC_PROOF_ARTIFACT_ID=${a.id}\nPUBLIC_PROOF_RUN_ID=${runId}\nPUBLIC_PROOF_DIGEST=${a.digest.slice(7)}\n`,
          { flag: "a" },
        );
        return { id: a.id, runId, digest: a.digest.slice(7) };
      }
    }
    await sleep(5000);
  }
  throw new Error(
    "M1 checkpoint timed out; inspect deployed phase before recovery",
  );
}

export async function proofWorkflowGuard(env, event, read) {
  if (
    env.GITHUB_REPOSITORY !== REPO ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_ACTOR !== OWNER ||
    env.GITHUB_RUN_ATTEMPT !== "1" ||
    env.GITHUB_WORKFLOW_REF !==
      `${REPO}/.github/workflows/paired-public-proof.yml@refs/heads/main` ||
    env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    env.RUNNER_OS !== "Linux" ||
    !Number.isSafeInteger(Number(env.GITHUB_RUN_ID)) ||
    Number(env.GITHUB_RUN_ID) < 1 ||
    event.repository?.full_name !== REPO ||
    event.ref !== "refs/heads/main" ||
    event.pull_request ||
    event.inputs?.checkpoint_claim !== env.CHECKPOINT_CLAIM ||
    event.inputs?.m1_public_proof !== env.M1_PUBLIC_PROOF
  )
    throw new Error("Untrusted M1 proof workflow context");
  await assertProtectedOwner(read);
  if ((await read(`/repos/${REPO}/commits/main`)).sha !== env.GITHUB_SHA)
    throw new Error("Unreviewed M1 proof control revision");
  const claim = JSON.parse(env.CHECKPOINT_CLAIM ?? "null");
  if (
    !claim ||
    Object.keys(claim).sort().join() !==
      ["parentRunId", "requestArtifactId", "requestSha256"].sort().join() ||
    !/^\d+$/.test(claim.parentRunId ?? "") ||
    !Number.isSafeInteger(claim.requestArtifactId) ||
    claim.requestArtifactId < 1 ||
    !/^[a-f0-9]{64}$/.test(claim.requestSha256 ?? "")
  )
    throw new Error("Invalid M1 checkpoint claim");
  assertRun(await read(`/repos/${REPO}/actions/runs/${claim.parentRunId}`), {
    runId: claim.parentRunId,
    control: env.GITHUB_SHA,
  });
  const a = await read(
    `/repos/${REPO}/actions/artifacts/${claim.requestArtifactId}`,
  );
  const phase = a.name?.split("-").at(-1);
  assertArtifact(a, {
    runId: claim.parentRunId,
    control: env.GITHUB_SHA,
    name: requestName(claim.parentRunId, phase),
    maxBytes: CHECKPOINT.requestBytes,
  });
  if (
    (await read(`/repos/${REPO}/actions/workflows/jekyll-gh-pages.yml`))
      .state !== "disabled_manually"
  )
    throw new Error("Competing production publisher at M1 checkpoint");
  return { claim, artifact: a, phase };
}
export async function writeProtectedProof({ root, env, event, read }) {
  const checked = await proofWorkflowGuard(env, event, read);
  const folder = path.join(root, "request");
  if (
    (await readdir(folder)).sort().join() !== "request.json" ||
    (await lstat(path.join(folder, "request.json"))).isSymbolicLink()
  )
    throw new Error("Unexpected checkpoint request files");
  const bytes = await readFile(path.join(folder, "request.json"));
  if (
    bytes.length > CHECKPOINT.requestBytes ||
    hash(bytes) !== checked.claim.requestSha256
  )
    throw new Error("M1 request digest mismatch");
  const request = validateRequest(JSON.parse(bytes));
  if (
    request.parentRunId !== checked.claim.parentRunId ||
    request.workflowCommit !== env.GITHUB_SHA ||
    request.phase !== checked.phase ||
    Date.parse(checked.artifact.created_at) <
      request.issuedAt - CHECKPOINT.skewMs
  )
    throw new Error("M1 request control/run mismatch");
  if (Buffer.byteLength(env.M1_PUBLIC_PROOF ?? "") > CHECKPOINT.proofBytes)
    throw new Error("M1 proof payload size");
  const proof = validateProof(
    JSON.parse(env.M1_PUBLIC_PROOF ?? "null"),
    request,
    hash(bytes),
    { requestArtifact: checked.artifact },
  );
  const artifacts = await listArtifacts(read);
  assertCheckpointArtifactBudget(artifacts);
  if (
    artifacts.some(
      (a) => !a.expired && a.name.startsWith(proofName(request) + "-"),
    )
  )
    throw new Error("M1 proof already published; no duplicate");
  const record = {
    schema: "jji-protected-m1-proof-1",
    proofRunId: env.GITHUB_RUN_ID,
    requestArtifactId: checked.artifact.id,
    requestArtifactDigest: checked.artifact.digest,
    proof,
  };
  const output = path.join(root, "record");
  await mkdir(output, { recursive: true });
  const encoded = Buffer.from(JSON.stringify(record) + "\n");
  if (encoded.length > CHECKPOINT.proofBytes)
    throw new Error("Protected M1 proof record size");
  await writeFile(path.join(output, "proof.json"), encoded, {
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(
    env.GITHUB_ENV,
    `PUBLIC_PROOF_NAME=${proofName(request)}-${hash(encoded)}\n`,
    {
      flag: "a",
    },
  );
  return record;
}
