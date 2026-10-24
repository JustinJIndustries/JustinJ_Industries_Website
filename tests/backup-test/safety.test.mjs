import test from "node:test";
import assert from "node:assert/strict";
import {
  assertContext,
  assertPreview,
  SOURCE,
  readback,
} from "../../infrastructure/backup-test/backup-only.mjs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const env = () => ({
  GITHUB_REPOSITORY: "JustinJIndustries/JustinJ_Industries_Website",
  GITHUB_REF: "refs/heads/main",
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
    metadata: { branch: "backup-ci-test-20261024", commit_hash: SOURCE },
  },
};
test("only exact reviewed owner/manual/main/free-runner context is accepted", () => {
  assert.doesNotThrow(() => assertContext(env()));
  for (const change of [
    { GITHUB_REF: "refs/pull/1/merge" },
    { GITHUB_EVENT_NAME: "pull_request_target" },
    { GITHUB_EVENT_NAME: "push" },
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
    { ...project, production_branch: "backup-ci-test-20261024" },
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
        metadata: {
          branch: "backup-ci-test-20261024",
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
