import test from "node:test";
import assert from "node:assert/strict";
import {
  assertContext,
  assertPreview,
  completeDeployments,
  verifyPreviewOperation,
  SOURCE,
  readback,
} from "../../infrastructure/backup-test/backup-only.mjs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  admitPreviewRun,
  verifyPreviewRun,
} from "../../infrastructure/backup-test/verify-run.mjs";
const env = () => ({
  GITHUB_REPOSITORY: "JustinJIndustries/JustinJ_Industries_Website",
  GITHUB_REF: "refs/heads/release-control",
  GITHUB_TRIGGERING_ACTOR: "JustinJIndustries",
  GITHUB_WORKFLOW_SHA: "a".repeat(40),
  GITHUB_WORKFLOW_REF:
    "JustinJIndustries/JustinJ_Industries_Website/.github/workflows/backup-only-test.yml@refs/heads/release-control",
  BACKUP_CONTROL_PIN: "a".repeat(40),
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_ACTOR: "JustinJIndustries",
  GITHUB_SHA: "a".repeat(40),
  APPROVED_WORKFLOW_SHA: "a".repeat(40),
  GITHUB_RUN_ID: "123",
  GITHUB_RUN_ATTEMPT: "1",
  RUNNER_ENVIRONMENT: "github-hosted",
  RUNNER_OS: "Linux",
  CLOUDFLARE_ACCOUNT_ID: "986b5334eba2d05d253ee98ca9842dfe",
  ZERO_SPEND_CONFIRMED: "yes",
  BUDGET_VERIFIED_AT: String(Date.now()),
});
const project = {
  name: "jji-backup-20261023",
  production_branch: "main",
  canonical_deployment: { id: "original-production" },
};
const deployment = {
  environment: "preview",
  url: "https://1234abcd.jji-backup-20261023.pages.dev",
  deployment_trigger: {
    metadata: { branch: "backup-ci-test-20261122-control-01", commit_hash: SOURCE },
  },
};

test("new preview is bound to the publishing run; verification-only requires the owner's exact previous operation", () => {
  const current = env();
  const id = "11111111-1111-4111-8111-111111111111";
  const production = "22222222-2222-4222-8222-222222222222";
  const record = {
    ...deployment,
    id,
    created_on: "2026-10-24T12:01:00Z",
    deployment_trigger: {
      metadata: {
        ...deployment.deployment_trigger.metadata,
        commit_message:
          "JJI backup-only test run " +
          current.GITHUB_RUN_ID +
          " workflow " +
          current.GITHUB_SHA,
      },
    },
  };
  const issued = verifyPreviewOperation(record, production, current);
  const next = {
    ...current,
    GITHUB_RUN_ID: "124",
    VERIFY_DEPLOYMENT_ID: id,
    VERIFY_ORIGINAL_RUN_ID: current.GITHUB_RUN_ID,
    VERIFY_ORIGINAL_CONTROL_SHA: current.GITHUB_SHA,
    VERIFY_OPERATION_SHA256: issued.digest,
  };
  assert.deepEqual(verifyPreviewOperation(record, production, next), issued);
  for (const patch of [
    { VERIFY_OPERATION_SHA256: undefined },
    { VERIFY_OPERATION_SHA256: "b".repeat(64) },
    { VERIFY_ORIGINAL_RUN_ID: "124" },
    { VERIFY_ORIGINAL_RUN_ID: "144" },
    { VERIFY_ORIGINAL_CONTROL_SHA: "c".repeat(40) },
    { VERIFY_DEPLOYMENT_ID: production },
  ])
    assert.throws(() =>
      verifyPreviewOperation(record, production, { ...next, ...patch }),
    );
  assert.throws(() => verifyPreviewOperation(record, id, current));
  assert.throws(() =>
    verifyPreviewOperation(record, production, {
      ...current,
      GITHUB_RUN_ID: "124",
    }),
  );
  for (const patch of [
    { id: production },
    { created_on: "2026-10-25T12:01:00Z" },
    { url: "https://11223344.jji-backup-20261023.pages.dev" },
    { environment: "production" },
    {
      deployment_trigger: {
        metadata: {
          ...record.deployment_trigger.metadata,
          commit_hash: "a".repeat(40),
        },
      },
    },
  ])
    assert.throws(() =>
      verifyPreviewOperation({ ...record, ...patch }, production, next),
    );
});

test("only a complete, identified deployment inventory can authorize the next check", () => {
  const page = {
    page: 1,
    per_page: 25,
    count: 1,
    total_count: 1,
    total_pages: 1,
  };
  assert.deepEqual(
    completeDeployments({ result: [deployment], result_info: page }),
    [deployment],
  );
  for (const change of [
    { page: 2 },
    { per_page: 10 },
    { count: 2 },
    { total_count: 2 },
    { total_pages: 2 },
  ])
    assert.throws(() =>
      completeDeployments({
        result: [deployment],
        result_info: { ...page, ...change },
      }),
    );
  assert.throws(() => completeDeployments({ result: [deployment] }));
  assert.throws(() => completeDeployments({ result: [{}], result_info: page }));
});

function runFixture() {
  const current = env();
  current.BACKUP_ENVIRONMENT_ID = "17";
  const owner = { login: current.GITHUB_ACTOR, id: 107809547 };
  const base = "/repos/" + current.GITHUB_REPOSITORY;
  const run = base + "/actions/runs/" + current.GITHUB_RUN_ID;
  const endpoint = base + "/environments/backup-preview";
  const records = new Map([
    [
      base + "/branches/release-control",
      {
        name: "release-control",
        protected: true,
        commit: { sha: current.GITHUB_SHA },
      },
    ],
    [
      run,
      {
        id: Number(current.GITHUB_RUN_ID),
        run_attempt: 1,
        repository: { full_name: current.GITHUB_REPOSITORY },
        head_repository: { full_name: current.GITHUB_REPOSITORY },
        head_sha: current.GITHUB_SHA,
        head_branch: "release-control",
        path: ".github/workflows/backup-only-test.yml",
        event: "workflow_dispatch",
        actor: owner,
        triggering_actor: owner,
      },
    ],
    [
      endpoint,
      {
        id: 17,
        name: "backup-preview",
        can_admins_bypass: false,
        deployment_branch_policy: { custom_branch_policies: true },
        protection_rules: [
          {
            type: "required_reviewers",
            reviewers: [{ type: "User", reviewer: owner }],
          },
        ],
      },
    ],
    [
      endpoint + "/deployment-branch-policies",
      {
        total_count: 1,
        branch_policies: [{ type: "branch", name: "release-control" }],
      },
    ],
  ]);
  function approve(id) {
    records.set(run + "/approvals", [
      {
        state: "approved",
        user: owner,
        environments: [{ id, name: "backup-preview" }],
      },
    ]);
  }
  const read = async (route) => {
    assert.ok(records.has(route));
    return records.get(route);
  };
  approve(17);
  return { current, owner, base, run, endpoint, records, approve, read };
}

test("issuer and verifier each require independent run and environment approval, and GitHub's original operation digest", async () => {
  const { current, base, run, records, read } = runFixture();
  const env = {
    ...current,
    VERIFY_DEPLOYMENT_ID: "11111111-1111-4111-8111-111111111111",
    VERIFY_ORIGINAL_RUN_ID: "122",
    VERIFY_ORIGINAL_CONTROL_SHA: current.GITHUB_SHA,
    VERIFY_OPERATION_SHA256: "d".repeat(64),
  };
  const original = base + "/actions/runs/122";
  const originalRun = { ...records.get(run), id: 122, status: "completed" };
  const approvals = records.get(run + "/approvals");
  const step = {
    name: "Record backup operation " + env.VERIFY_OPERATION_SHA256,
    status: "completed",
    conclusion: "success",
  };
  const job = {
    name: "preview",
    run_id: 122,
    run_attempt: 1,
    head_sha: current.GITHUB_SHA,
    steps: [step],
  };
  const key = original + "/attempts/1/jobs?per_page=100";
  records.set(original, originalRun);
  records.set(original + "/approvals", approvals);
  records.set(key, { total_count: 1, jobs: [job] });
  await verifyPreviewRun(env, read);
  for (const [path, bad] of [
    [original, { ...originalRun, head_sha: "b".repeat(40) }],
    [original, { ...originalRun, status: "in_progress" }],
    [original, { ...originalRun, run_attempt: 2 }],
    [original, { ...originalRun, actor: { login: "other", id: 1 } }],
    [original + "/approvals", []],
    [
      original + "/approvals",
      [{ ...approvals[0], environments: [{ id: 18, name: "backup-preview" }] }],
    ],
    [run + "/approvals", []],
    [key, { total_count: 2, jobs: [job] }],
    [key, { total_count: 2, jobs: [job, job] }],
    ...[
      { run_id: 123 },
      { run_attempt: 2 },
      { head_sha: "b".repeat(40) },
      { steps: [] },
      { steps: [step, step] },
      { steps: [{ ...step, conclusion: "skipped" }] },
      {
        steps: [{ ...step, name: "Record backup operation " + "b".repeat(64) }],
      },
    ].map((change) => [key, { total_count: 1, jobs: [{ ...job, ...change }] }]),
  ]) {
    const originalRecord = records.get(path);
    records.set(path, bad);
    await assert.rejects(verifyPreviewRun(env, read));
    records.set(path, originalRecord);
  }
});

test("approval matches the current environment ID as well as its name", async () => {
  const { current, endpoint, records, approve, read } = runFixture();
  const preflight = { ...current };
  delete preflight.CLOUDFLARE_ACCOUNT_ID;
  const target = await admitPreviewRun(preflight, read);
  assert.deepEqual(target, { name: "backup-preview", id: 17 });
  await assert.rejects(
    verifyPreviewRun({ ...current, BACKUP_ENVIRONMENT_ID: "18" }, read),
    /changed after admission/,
  );
  await verifyPreviewRun(current, read);
  approve(18);
  await assert.rejects(
    verifyPreviewRun(current, read),
    /different backup preview environment/,
  );
  approve(undefined);
  await assert.rejects(
    verifyPreviewRun(current, read),
    /different backup preview environment/,
  );
  records.delete(endpoint);
  await assert.rejects(admitPreviewRun(preflight, read));
});
test("only exact reviewed owner/manual/enrolled-control/free-runner context is accepted", () => {
  assert.doesNotThrow(() => assertContext(env()));
  for (const change of [
    { GITHUB_REF: "refs/pull/1/merge" },
    { GITHUB_EVENT_NAME: "pull_request_target" },
    { GITHUB_EVENT_NAME: "push" },
    { GITHUB_REF: "refs/heads/main" },
    { GITHUB_TRIGGERING_ACTOR: "other" },
    { BACKUP_CONTROL_PIN: "b".repeat(40) },
    { GITHUB_WORKFLOW_SHA: "b".repeat(40) },
    { GITHUB_ACTOR: "other" },
    { APPROVED_WORKFLOW_SHA: "b".repeat(40) },
    { GITHUB_RUN_ATTEMPT: "2" },
    { CLOUDFLARE_ACCOUNT_ID: "other" },
    { ZERO_SPEND_CONFIRMED: "no" },
    { BUDGET_VERIFIED_AT: String(Date.now() - 16 * 60000) },
    { BUDGET_VERIFIED_AT: "unknown" },
    { RUNNER_ENVIRONMENT: "self-hosted" },
  ])
    assert.throws(() => assertContext({ ...env(), ...change }));
});
test("project production branch and every deployment identity boundary fail closed", () => {
  assert.doesNotThrow(() => assertPreview(project, deployment));
  for (const p of [
    { ...project, name: "other" },
    { ...project, production_branch: "backup-ci-test-20261122-control-01" },
    { ...project, production_branch: undefined },
    { ...project, production_branch: "" },
    { ...project, production_branch: " backup-ci-test-20261122-control-01" },
    { ...project, production_branch: {} },
    { ...project, canonical_deployment: { id: {} } },
    { ...project, canonical_deployment: { id: " " } },
    { ...project, canonical_deployment: null },
  ])
    assert.throws(() => assertPreview(p));
  for (const d of [
    { ...deployment, environment: "production" },
    { ...deployment, url: "https://evil.invalid/" },
    { ...deployment, url: "https://jji-backup-20261023.pages.dev/" },
    {
      ...deployment,
      deployment_trigger: { metadata: { branch: "main", commit_hash: SOURCE } },
    },
    {
      ...deployment,
      deployment_trigger: {
        metadata: { branch: "backup-ci-test-20261024", commit_hash: SOURCE },
      },
    },
    {
      ...deployment,
      deployment_trigger: {
        metadata: {
          branch: "backup-ci-test-20261122-control-01",
          commit_hash: "f".repeat(40),
        },
      },
    },
  ])
    assert.throws(() => assertPreview(project, d));
});
test("artifact readback refuses additional, missing or changed files before recovery fetches", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-backup-readback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "evidence"));
  const out = path.join(root, "downloaded");
  await mkdir(out);
  await writeFile(path.join(root, "evidence", "receipt.json"), "original");
  await assert.rejects(readback(root, out), /inventory/);
  await writeFile(path.join(out, "receipt.json"), "changed");
  await assert.rejects(readback(root, out), /exact bytes/);
});
