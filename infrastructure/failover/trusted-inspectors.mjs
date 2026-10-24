// Read-only prerequisite inspectors. No billing mutation, token creation, secret
// storage, workflow dispatch or publishing endpoint is implemented here.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
const REPO = "JustinJIndustries/JustinJ_Industries_Website";
const GIT = `https://github.com/${REPO}.git`;
const WORKFLOW = ".github/workflows/paired-release.yml";
const ENVIRONMENT = "failover-sync";
const OWNER = "JustinJIndustries";
const sha = /^[a-f0-9]{40}$/;
const digest = (b) => createHash("sha256").update(b).digest("hex");

export function assertRemoteMetadata(repo, remote) {
  if (
    repo?.full_name !== REPO ||
    repo.private !== false ||
    repo.default_branch !== "main" ||
    repo.clone_url !== GIT ||
    ![GIT, GIT.slice(0, -4)].includes(remote.trim())
  )
    throw new Error(
      "Repository/remote does not match approved public GitHub origin",
    );
}
export function assertCiIdentity(env, event) {
  if (
    env.GITHUB_REPOSITORY !== REPO ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_WORKFLOW_REF !== `${REPO}/${WORKFLOW}@refs/heads/main` ||
    env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    env.RUNNER_OS !== "Linux" ||
    !sha.test(env.GITHUB_SHA ?? "") ||
    env.APPROVED_WORKFLOW_SHA !== env.GITHUB_SHA ||
    !/^\d+$/.test(env.GITHUB_RUN_ID ?? "") ||
    event?.repository?.full_name !== REPO ||
    event.repository.private !== false ||
    event.ref !== "refs/heads/main" ||
    event.pull_request ||
    event.inputs?.approved_workflow_sha !== env.GITHUB_SHA
  )
    throw new Error("Untrusted workflow identity or unapproved revision");
}
export function assertProtectedEnvironment(environment, policies) {
  const reviewers =
    environment?.protection_rules?.find((r) => r.type === "required_reviewers")
      ?.reviewers ?? [];
  if (
    environment?.name !== ENVIRONMENT ||
    environment.deployment_branch_policy?.custom_branch_policies !== true ||
    !reviewers.some((r) => r.reviewer?.login === OWNER) ||
    policies?.branch_policies?.length !== 1 ||
    policies.branch_policies[0].name !== "main" ||
    policies.branch_policies[0].type !== "branch"
  )
    throw new Error(
      "Required owner review and exact main-only environment protection missing",
    );
}
export function githubInspector({ token, fetcher = globalThis.fetch }) {
  if (typeof token !== "string" || !token || /[\r\n]/.test(token))
    throw new Error("Missing existing read credential");
  return async function read(endpoint) {
    if (
      !(
        endpoint === `/repos/${REPO}` || endpoint.startsWith(`/repos/${REPO}/`)
      ) ||
      /[\r\n?#]/.test(endpoint)
    )
      throw new Error("Unapproved inspection endpoint");
    try {
      const r = await fetcher("https://api.github.com" + endpoint, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2026-03-10",
        },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error();
      return await r.json();
    } catch {
      throw new Error(
        "GitHub prerequisite read failed; do not expand access automatically",
      );
    }
  };
}
export async function inspectTrustedCi({ env, event, remote, read }) {
  assertCiIdentity(env, event);
  // Repository endpoint uses a trailing slash to stay within the fixed namespace.
  const repo = await read(`/repos/${REPO}`);
  assertRemoteMetadata(repo, remote);
  const main = await read(`/repos/${REPO}/commits/main`);
  if (main.sha !== env.GITHUB_SHA)
    throw new Error("Main advanced; do not publish a stale run");
  const run = await read(`/repos/${REPO}/actions/runs/${env.GITHUB_RUN_ID}`);
  if (
    run.head_sha !== env.GITHUB_SHA ||
    run.head_branch !== "main" ||
    run.event !== "workflow_dispatch" ||
    run.path !== WORKFLOW ||
    run.repository?.full_name !== REPO ||
    run.pull_requests?.length
  )
    throw new Error("Untrusted run provenance");
  const protection = await read(`/repos/${REPO}/environments/${ENVIRONMENT}`);
  const policies = await read(
    `/repos/${REPO}/environments/${ENVIRONMENT}/deployment-branch-policies`,
  );
  assertProtectedEnvironment(protection, policies);
  const publisher = await read(
    `/repos/${REPO}/actions/workflows/jekyll-gh-pages.yml`,
  );
  if (publisher.state !== "disabled_manually")
    throw new Error(
      "Independent production publisher is not paused; no write permitted",
    );
  return {
    repository: REPO,
    ref: env.GITHUB_REF,
    event: "workflow_dispatch",
    sha: env.GITHUB_SHA,
    runId: env.GITHUB_RUN_ID,
    approvedSha: env.GITHUB_SHA,
    environmentApproved: true,
    environment: ENVIRONMENT,
    workflowPath: WORKFLOW,
    concurrencyGroup: "pages",
    otherPublishersPaused: true,
  };
}

export async function readOriginManifestEntry(
  origin,
  e,
  { fetcher = globalThis.fetch, requirePrimaryMarker = false } = {},
) {
  const root = new URL(origin);
  if (
    root.protocol !== "https:" ||
    (!["www.justinjindustries.com"].includes(root.hostname) &&
      !/^[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev$/.test(root.hostname)) ||
    root.pathname !== "/" ||
    root.username ||
    root.password ||
    root.port ||
    root.search ||
    root.hash
  )
    throw new Error("Unapproved verification origin");
  if (
    !/^[\w.@/-]+$/.test(e.path) ||
    e.path.includes("..") ||
    e.path.startsWith("/") ||
    !/^[a-f0-9]{64}$/.test(e.sha256)
  )
    throw new Error("Unsafe manifest entry");
  let url = new URL(e.path, root),
    response;
  const seen = new Set();
  for (let hop = 0; hop < 6; hop++) {
    if (seen.has(url.href)) throw new Error("Verification redirect loop");
    seen.add(url.href);
    try {
      response = await fetcher(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: { "cache-control": "no-cache" },
      });
    } catch {
      throw new Error("Origin verification failed; no TLS bypass permitted");
    }
    if (response.headers.get("cf-mitigated") === "challenge")
      throw new Error("Origin security challenge; no bypass permitted");
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const target = new URL(response.headers.get("location") ?? "", url);
    if (response.body) await response.body.cancel();
    if (target.origin !== root.origin || target.username || target.password)
      throw new Error("Foreign verification redirect");
    url = target;
  }
  if (
    response.status !== 200 ||
    (requirePrimaryMarker && response.headers.get("x-jji-source") !== "primary")
  )
    throw new Error("Origin manifest/status mismatch; stop publication");
  try {
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch {
    throw new Error("Origin body verification failed; no TLS bypass permitted");
  }
}

export async function verifyOriginManifest(origin, entries, options = {}) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 2000)
    throw new Error("Missing or excessive verification inventory");
  for (const e of entries) {
    const result = await readOriginManifestEntry(origin, e, options);
    if (digest(result.bytes) !== e.sha256)
      throw new Error("Origin manifest/status mismatch; stop publication");
  }
  return { origin: new URL(origin).href, verifiedFiles: entries.length };
}

export async function verifyToolchain(root) {
  const pin = JSON.parse(
    await readFile(path.join(root, "toolchain-pin.json"), "utf8"),
  );
  const lock = JSON.parse(
    await readFile(path.join(root, "package-lock.json"), "utf8"),
  );
  if (
    pin.version !== "4.152.0" ||
    pin.registry !== "https://registry.npmjs.org/" ||
    lock.packages?.["node_modules/wrangler"]?.version !== pin.version ||
    lock.packages["node_modules/wrangler"].integrity !== pin.integrity
  )
    throw new Error("Deployment dependency pin mismatch");
  for (const [name, item] of Object.entries(lock.packages)) {
    if (!name) continue;
    if (
      !item.integrity?.startsWith("sha512-") ||
      !item.resolved?.startsWith("https://registry.npmjs.org/")
    )
      throw new Error("Unpinned deployment dependency");
  }
  const cli = path.join(root, "node_modules/wrangler/bin/wrangler.js");
  if (digest(await readFile(cli)) !== pin.cliSha256)
    throw new Error("Deployment entrypoint hash mismatch");
  return { cli, cliSha256: pin.cliSha256, version: pin.version };
}
