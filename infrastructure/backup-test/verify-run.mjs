// The preview environment and control pin are enrolled by the owner outside the candidate tree.
import { pathToFileURL } from "node:url";
import { assertContext } from "./backup-only.mjs";
import {
  CONTROL_BRANCH,
  REPO,
  owner,
  verifyControl,
  verifiedReviewTarget,
} from "../failover/control-identity.mjs";

const environment = "backup-preview";
export async function verifyPreviewRun(env, read) {
  assertContext(env);
  await verifyControl(read, env.GITHUB_SHA, env.BACKUP_CONTROL_PIN);
  const base = `/repos/${REPO}`;
  const run = await read(`${base}/actions/runs/${env.GITHUB_RUN_ID}`);
  if (
    String(run.id) !== env.GITHUB_RUN_ID ||
    run.run_attempt !== 1 ||
    run.repository?.full_name !== REPO ||
    run.head_repository?.full_name !== REPO ||
    run.head_sha !== env.GITHUB_SHA ||
    run.head_branch !== CONTROL_BRANCH ||
    run.path !== ".github/workflows/backup-only-test.yml" ||
    run.event !== "workflow_dispatch" ||
    !owner(run.actor) ||
    !owner(run.triggering_actor)
  )
    throw new Error("Untrusted backup preview run");
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
  const approved = await verifiedReviewTarget(
    read,
    env.GITHUB_RUN_ID,
    environment,
  );
  if (approved.id !== config.id)
    throw new Error(
      "Approval belongs to a different backup preview environment",
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await verifyPreviewRun(process.env, async (endpoint) => {
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
  });
