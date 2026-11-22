// Live state comes from GitHub, while the owner enrolls the immutable SHA
// outside the website tree. A matching branch name alone cannot admit a run.
export const CONTROL_BRANCH = "release-control";
export const CONTROL_REF = "refs/heads/" + CONTROL_BRANCH;
export const REPO = "JustinJIndustries/JustinJ_Industries_Website";
const OWNER_ID = 107809547;
export const owner = (user) =>
  user?.login === "JustinJIndustries" && user.id === OWNER_ID;

export async function verifyControl(read, commit, pin) {
  if (!/^[a-f0-9]{40}$/.test(commit ?? "") || commit !== pin)
    throw new Error("Control revision is not independently enrolled");
  const branch = await read(`/repos/${REPO}/branches/${CONTROL_BRANCH}`);
  if (
    branch.name !== CONTROL_BRANCH ||
    branch.protected !== true ||
    branch.commit?.sha !== commit
  )
    throw new Error("Unprotected or stale control revision");
}

export function verifyEnvironment(env, policies, expected) {
  const reviewers = env?.protection_rules?.find(
    (r) => r.type === "required_reviewers",
  )?.reviewers;
  const branches = policies?.branch_policies;
  if (
    !["paired-cloudflare", "paired-pages", "paired-proof"].includes(expected) ||
    env?.name !== expected ||
    env.can_admins_bypass !== false ||
    env.deployment_branch_policy?.custom_branch_policies !== true ||
    reviewers?.length !== 1 ||
    reviewers[0].type !== "User" ||
    !owner(reviewers[0].reviewer) ||
    branches?.length !== 1 ||
    branches[0].name !== CONTROL_BRANCH ||
    branches[0].type !== "branch" ||
    (policies.total_count !== undefined && policies.total_count !== 1)
  )
    throw new Error("Missing protected owner/control-branch environment");
}

export async function verifiedReviewTarget(read, runId, ...environments) {
  if (!/^[1-9][0-9]*$/.test(String(runId)))
    throw new Error("Invalid review run");
  const history = await read(`/repos/${REPO}/actions/runs/${runId}/approvals`);
  const relevant = history.filter((review) =>
    review.environments?.some((e) => environments.includes(e.name)),
  );
  if (
    relevant.length !== 1 ||
    relevant[0].state !== "approved" ||
    !owner(relevant[0].user)
  )
    throw new Error(
      "Missing or ambiguous owner approval for this run and environment",
    );
  const targets = relevant[0].environments.filter((e) =>
    environments.includes(e.name),
  );
  if (targets.length !== 1) throw new Error("Ambiguous review destination");
  return targets[0];
}

export async function verifyReview(read, runId, ...environments) {
  return (await verifiedReviewTarget(read, runId, ...environments)).name;
}

// Both publisher roles require baseline evidence. Only Pages promotion may
// request later stage, final or manual Worker checkpoints.
export async function verifyParentReview(read, parentRunId, phase) {
  const acceptable =
    phase === "baseline"
      ? ["paired-cloudflare", "paired-pages"]
      : ["paired-pages"];
  const environment = await verifyReview(read, parentRunId, ...acceptable);
  const endpoint = `/repos/${REPO}/environments/${environment}`;
  verifyEnvironment(
    await read(endpoint),
    await read(endpoint + "/deployment-branch-policies"),
    environment,
  );
}
