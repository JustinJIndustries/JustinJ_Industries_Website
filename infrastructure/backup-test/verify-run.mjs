// The preview environment and control pin are enrolled by the owner outside the candidate tree.
import { pathToFileURL } from "node:url";
import { appendFile } from "node:fs/promises";
import { assertDispatch, assertContext } from "./backup-only.mjs";
import {
  CONTROL_BRANCH,
  REPO,
  owner,
  verifyControl,
  verifiedReviewTarget,
} from "../failover/control-identity.mjs";

const environment = "backup-preview";
async function trustedRun(read, runId, control) {
  const run = await read(`/repos/${REPO}/actions/runs/${runId}`);
  if (
    String(run.id) !== runId ||
    run.run_attempt !== 1 ||
    run.repository?.full_name !== REPO ||
    run.head_repository?.full_name !== REPO ||
    run.head_sha !== control ||
    run.head_branch !== CONTROL_BRANCH ||
    run.path !== ".github/workflows/backup-only-test.yml" ||
    run.event !== "workflow_dispatch" ||
    !owner(run.actor) ||
    !owner(run.triggering_actor)
  )
    throw new Error("Untrusted backup preview run");
  return run;
}

export async function admitPreviewRun(env, read) {
  assertDispatch(env);
  await verifyControl(read, env.GITHUB_SHA, env.BACKUP_CONTROL_PIN);
  const base = `/repos/${REPO}`;
  await trustedRun(read, env.GITHUB_RUN_ID, env.GITHUB_SHA);
  const endpoint = `${base}/environments/${environment}`;
  const config = await read(endpoint);
  const policy = await read(endpoint + "/deployment-branch-policies");
  const review = config.protection_rules?.find(
    (r) => r.type === "required_reviewers",
  );
  if (
    config.name !== environment ||
    !Number.isSafeInteger(config.id) ||
    config.id <= 0 ||
    config.can_admins_bypass !== false ||
    config.deployment_branch_policy?.custom_branch_policies !== true ||
    review?.reviewers?.length !== 1 ||
    review.reviewers[0].type !== "User" ||
    !owner(review.reviewers[0].reviewer) ||
    policy.total_count !== 1 ||
    policy.branch_policies?.length !== 1 ||
    policy.branch_policies[0].type !== "branch" ||
    policy.branch_policies[0].name !== CONTROL_BRANCH
  )
    throw new Error("Missing protected backup preview environment");
  if (env.VERIFY_DEPLOYMENT_ID) {
    const original = await trustedRun(
      read,
      env.VERIFY_ORIGINAL_RUN_ID,
      env.VERIFY_ORIGINAL_CONTROL_SHA,
    );
    const priorReview = await verifiedReviewTarget(
      read,
      env.VERIFY_ORIGINAL_RUN_ID,
      environment,
    );
    if (original.status !== "completed" || priorReview.id !== config.id)
      throw new Error(
        "Original upload lacks a completed approved run in this environment",
      );
    const jobs = await read(
      `${base}/actions/runs/${env.VERIFY_ORIGINAL_RUN_ID}/attempts/1/jobs?per_page=100`,
    );
    const previewJobs = jobs.jobs?.filter((job) => job.name === "preview");
    const receiptName =
      "Record backup operation " + env.VERIFY_OPERATION_SHA256;
    const matching = previewJobs?.[0]?.steps?.filter(
      (step) => step.name === receiptName,
    );
    if (
      !Array.isArray(jobs.jobs) ||
      jobs.total_count !== jobs.jobs.length ||
      previewJobs.length !== 1 ||
      String(previewJobs[0].run_id) !== env.VERIFY_ORIGINAL_RUN_ID ||
      previewJobs[0].run_attempt !== 1 ||
      previewJobs[0].head_sha !== env.VERIFY_ORIGINAL_CONTROL_SHA ||
      matching?.length !== 1 ||
      matching[0].status !== "completed" ||
      matching[0].conclusion !== "success"
    )
      throw new Error(
        "Original issuing runner did not record this approved provider operation",
      );
  }
  return { name: environment, id: config.id };
}

export async function verifyPreviewRun(env, read) {
  assertContext(env);
  const target = await admitPreviewRun(env, read);
  if (String(target.id) !== env.BACKUP_ENVIRONMENT_ID)
    throw new Error("Backup preview environment changed after admission");
  const approved = await verifiedReviewTarget(
    read,
    env.GITHUB_RUN_ID,
    environment,
  );
  if (approved.id !== target.id)
    throw new Error(
      "Approval belongs to a different backup preview environment",
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const read = async (endpoint) => {
    const response = await fetch("https://api.github.com" + endpoint, {
      headers: {
        authorization: "Bearer " + process.env.GH_READ_TOKEN,
        accept: "application/vnd.github+json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Backup control metadata unavailable");
    return response.json();
  };
  if (process.argv[2] === "admit") {
    const target = await admitPreviewRun(process.env, read);
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `environment=${target.name}\nenvironment_id=${target.id}\n`,
    );
  } else if (process.argv.length === 2) {
    await verifyPreviewRun(process.env, read);
  } else throw new Error("Unknown preview verification operation");
}
