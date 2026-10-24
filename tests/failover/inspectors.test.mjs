import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  assertCiIdentity,
  assertRemoteMetadata,
  assertProtectedEnvironment,
  inspectTrustedCi,
  verifyOriginManifest,
  verifyToolchain,
  githubInspector,
} from "../../infrastructure/failover/trusted-inspectors.mjs";
const repo = "JustinJIndustries/JustinJ_Industries_Website",
  sha = "a".repeat(40);
const metadata = {
  full_name: repo,
  private: false,
  clone_url: `https://github.com/${repo}.git`,
  default_branch: "main",
};
const env = {
  GITHUB_REPOSITORY: repo,
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/paired-release.yml@refs/heads/main`,
  RUNNER_ENVIRONMENT: "github-hosted",
  RUNNER_OS: "Linux",
  GITHUB_SHA: sha,
  APPROVED_WORKFLOW_SHA: sha,
  GITHUB_RUN_ID: "123",
};
const event = {
  repository: metadata,
  ref: "refs/heads/main",
  inputs: { approved_workflow_sha: sha },
};
const protection = {
  name: "failover-sync",
  deployment_branch_policy: { custom_branch_policies: true },
  protection_rules: [
    {
      type: "required_reviewers",
      reviewers: [{ reviewer: { login: "JustinJIndustries" } }],
    },
  ],
};
const policies = { branch_policies: [{ name: "main", type: "branch" }] };
const read = async (endpoint) => {
  if (endpoint.endsWith("/commits/main")) return { sha };
  if (endpoint.endsWith("/actions/runs/123"))
    return {
      head_sha: sha,
      head_branch: "main",
      event: "workflow_dispatch",
      path: ".github/workflows/paired-release.yml",
      repository: metadata,
      pull_requests: [],
    };
  if (endpoint.endsWith("/deployment-branch-policies")) return policies;
  if (endpoint.endsWith("/environments/failover-sync")) return protection;
  if (endpoint.endsWith("/workflows/jekyll-gh-pages.yml"))
    return { state: "disabled_manually" };
  return metadata;
};
test("trusted inspectors reject PRs, arbitrary refs, stale approvals, local remotes and absent reviewer", () => {
  assert.doesNotThrow(() => assertCiIdentity(env, event));
  for (const change of [
    { GITHUB_EVENT_NAME: "pull_request_target" },
    { GITHUB_REF: "refs/heads/feature" },
    { GITHUB_SHA: "b".repeat(40) },
    { RUNNER_ENVIRONMENT: "self-hosted" },
  ])
    assert.throws(() => assertCiIdentity({ ...env, ...change }, event));
  assert.doesNotThrow(() => assertRemoteMetadata(metadata, metadata.clone_url));
  assert.throws(() => assertRemoteMetadata(metadata, "/tmp/local-snapshot"));
  assert.doesNotThrow(() => assertProtectedEnvironment(protection, policies));
  assert.throws(() =>
    assertProtectedEnvironment(
      { ...protection, protection_rules: [] },
      policies,
    ),
  );
  assert.throws(() =>
    assertProtectedEnvironment(protection, {
      branch_policies: [{ name: "*", type: "branch" }],
    }),
  );
});
test("read-only preflight rejects intervening main commit and active independent publisher", async () => {
  assert.equal(
    (await inspectTrustedCi({ env, event, remote: metadata.clone_url, read }))
      .otherPublishersPaused,
    true,
  );
  for (const replacement of [
    async (p) =>
      p.endsWith("/commits/main") ? { sha: "b".repeat(40) } : read(p),
    async (p) =>
      p.endsWith("/workflows/jekyll-gh-pages.yml")
        ? { state: "active" }
        : read(p),
  ])
    await assert.rejects(
      inspectTrustedCi({
        env,
        event,
        remote: metadata.clone_url,
        read: replacement,
      }),
    );
});
test("provider read failure does not expose bearer token or follow redirects", async () => {
  let call;
  const client = githubInspector({
    token: "FAKE_PRIVATE",
    fetcher: async (u, o) => {
      call = o;
      throw new Error("FAKE_PRIVATE");
    },
  });
  await assert.rejects(
    client(`/repos/${repo}`),
    (e) => !e.message.includes("FAKE_PRIVATE"),
  );
  assert.equal(call.redirect, "error");
  await assert.rejects(client("/users/unrelated/settings/billing"));
});
test("manifest inspector checks bytes/status and same-origin redirects; never bypasses security", async () => {
  const bytes = "approved public bytes";
  const entries = [
    {
      path: "services.html",
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  ];
  let calls = 0;
  const fetcher = async () =>
    ++calls === 1
      ? new Response(null, { status: 301, headers: { location: "/services/" } })
      : new Response(bytes);
  assert.equal(
    (
      await verifyOriginManifest(
        "https://www.justinjindustries.com/",
        entries,
        { fetcher },
      )
    ).verifiedFiles,
    1,
  );
  for (const response of [
    () => new Response("bad"),
    () =>
      new Response(null, {
        status: 301,
        headers: { location: "https://foreign.invalid/" },
      }),
    () =>
      new Response("challenge", {
        status: 403,
        headers: { "cf-mitigated": "challenge" },
      }),
    () => new Response("missing", { status: 404 }),
  ])
    await assert.rejects(
      verifyOriginManifest("https://www.justinjindustries.com/", entries, {
        fetcher: async () => response(),
      }),
    );
  await assert.rejects(
    verifyOriginManifest("http://www.justinjindustries.com/", entries),
  );
});
test("installed Wrangler and every locked deployment dependency are integrity pinned", async () => {
  const result = await verifyToolchain(
    path.resolve("infrastructure/failover/toolchain"),
  );
  assert.equal(result.version, "4.152.0");
  assert.match(result.cliSha256, /^[a-f0-9]{64}$/);
});

test("origin manifest verification supports existing retina @3x asset names", async () => {
  const bytes = "retina asset";
  await verifyOriginManifest(
    "https://www.justinjindustries.com/",
    [
      {
        path: "assets/preview@3x.webp",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ],
    { fetcher: async () => new Response(bytes) },
  );
});
