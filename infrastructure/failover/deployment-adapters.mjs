// Proposed provider adapters. No CLI entry point, implicit credentials, resource
// creation, route/settings API, retry of writes, or console logging.
import { readFile, writeFile, rename, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  assertTrustedContext,
  assertStorageBudget,
} from "./release-policy.mjs";

const exec = promisify(execFile);
const REPO = "JustinJIndustries/JustinJ_Industries_Website";
const immutable = /^https:\/\/[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev\/$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digest = /^[a-f0-9]{64}$/;
const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function directoryFingerprint(root, prefix = "") {
  const entries = [];
  for (const f of (await readdir(root, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (f.isSymbolicLink()) throw new Error("Upload symlink rejected");
    if (f.isDirectory())
      entries.push(
        ...(await directoryFingerprint(
          root + "/" + f.name,
          prefix + f.name + "/",
        )),
      );
    else if (f.isFile())
      entries.push([
        prefix + f.name,
        createHash("sha256")
          .update(await readFile(root + "/" + f.name))
          .digest("hex"),
      ]);
    else throw new Error("Unsupported upload entry");
  }
  return entries;
}
function receipt(value) {
  if (
    !value ||
    Object.keys(value).some(
      (k) => !["id", "version", "origin", "release"].includes(k),
    ) ||
    Object.values(value).some(
      (v) => typeof v !== "string" || v.length > 200 || /[\r\n]/.test(v),
    )
  )
    throw new Error("Unsafe deployment receipt");
  if (value.origin && !immutable.test(value.origin))
    throw new Error("Invalid immutable receipt");
  if (value.release && !digest.test(value.release))
    throw new Error("Invalid release receipt");
  if (value.version && !uuid.test(value.version))
    throw new Error("Invalid version receipt");
  if (value.id && !/^[a-f0-9-]{1,64}$/.test(value.id))
    throw new Error("Invalid deployment receipt");
  return value;
}

export class WriteJournal {
  constructor(file) {
    this.file = file;
    this.entries = null;
  }
  async load() {
    if (!this.entries) {
      try {
        this.entries = JSON.parse(await readFile(this.file, "utf8"));
      } catch (e) {
        if (e.code !== "ENOENT") throw new Error("Invalid deployment journal");
        this.entries = {};
      }
    }
  }
  async save() {
    await writeFile(
      this.file + ".next",
      JSON.stringify(this.entries, null, 2) + "\n",
      { mode: 0o600 },
    );
    await rename(this.file + ".next", this.file);
  }
  async run(key, action, intent = { key }) {
    if (!/^[a-z][a-z0-9-]{1,80}$/.test(key))
      throw new Error("Invalid operation key");
    await this.load();
    const intentDigest = fingerprint(intent);
    if (this.entries[key] && this.entries[key].intentDigest !== intentDigest)
      throw new Error("Operation key reused with different intent; no write");
    if (this.entries[key]?.state === "confirmed")
      return receipt(this.entries[key].receipt);
    if (this.entries[key])
      throw new Error("Uncertain write: reconcile before any retry");
    this.entries[key] = { state: "uncertain", intentDigest };
    await this.save(); // durable intent BEFORE side effect
    try {
      const result = receipt(await action());
      this.entries[key] = { state: "confirmed", intentDigest, receipt: result };
      await this.save();
      return result;
    } catch {
      throw new Error(
        "Uncertain write: inspect provider state; no automatic retry",
      );
    }
  }
  async reconcile(key, inspectReadOnly) {
    await this.load();
    if (this.entries[key]?.state !== "uncertain")
      throw new Error("No uncertain operation");
    const result = receipt(await inspectReadOnly()); // must independently match exact artifact/version
    this.entries[key] = {
      ...this.entries[key],
      state: "confirmed",
      receipt: result,
    };
    await this.save();
    return result;
  }
}

// Caller supplies a single scoped credential, never a process-wide env lookup.
// Redirect errors prevent bearer-token forwarding. Both header and JSON-body
// waits are bounded; raw provider bodies/errors are never returned or logged.
function apiClient(base, token, fetcher) {
  if (typeof token !== "string" || !token || /[\r\n]/.test(token))
    throw new Error("Missing scoped credential");
  return async (pathname, method = "GET", body) => {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const headers = {
            authorization: `Bearer ${token}`,
            accept: "application/json",
          };
          if (base.includes("github"))
            headers["X-GitHub-Api-Version"] = "2026-03-10";
          if (body && !(body instanceof FormData))
            headers["content-type"] = "application/json";
          const r = await fetcher(base + pathname, {
            method,
            headers,
            body:
              body instanceof FormData
                ? body
                : body
                  ? JSON.stringify(body)
                  : undefined,
            redirect: "error",
            signal: controller.signal,
          });
          if (!r.ok) throw new Error("Provider status rejected");
          const text = await r.text();
          if (text.length > 1_000_000)
            throw new Error("Provider response too large");
          const data = JSON.parse(text);
          if (data.success === false)
            throw new Error("Provider operation rejected");
          return data.result ?? data;
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("Provider wait exceeded"));
          }, 15_000);
        }),
      ]);
    } catch {
      throw new Error(
        "Provider request failed; inspect sanitized operation state",
      );
    } finally {
      clearTimeout(timer);
    }
  };
}

// This runner is code only. It is not invoked by importing this module. Future
// CI must provide an already-reviewed, locally installed Wrangler JS entry point
// with exact SHA256. No npx/npm install, shell, login, inherited credentials,
// analytics, or token in argv/output. stdout/stderr discarded even on failure.
export async function pinnedPagesRunner({
  cli,
  cliSha256,
  args,
  token,
  account,
}) {
  if (
    !cli?.startsWith("/") ||
    !digest.test(cliSha256 ?? "") ||
    createHash("sha256")
      .update(await readFile(cli))
      .digest("hex") !== cliSha256
  )
    throw new Error("Unverified Pages tool");
  try {
    const { stdout } = await exec(process.execPath, [cli, ...args], {
      shell: false,
      timeout: 120_000,
      maxBuffer: 1_000_000,
      env: {
        PATH: "/usr/bin:/bin",
        HOME: "/tmp/jji-isolated-wrangler",
        CI: "true",
        CLOUDFLARE_API_TOKEN: token,
        CLOUDFLARE_ACCOUNT_ID: account,
        WRANGLER_SEND_METRICS: "false",
        WRANGLER_WRITE_LOGS: "false",
      },
    });
    const urls =
      stdout.match(
        /https:\/\/[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev\/?/g,
      ) ?? [];
    if (new Set(urls.map((u) => u.replace(/\/$/, ""))).size !== 1)
      throw new Error();
    return urls[0].replace(/\/$/, "") + "/";
  } catch {
    throw new Error(
      "Pages upload outcome uncertain; inspect existing project deployments",
    );
  }
}

export function createProviderAdapters({
  account,
  worker,
  workerToken,
  pagesToken,
  githubToken,
  context,
  storage,
  storagePolicy = {},
  refreshStorage,
  journal,
  writesApproved = false,
  fetcher = globalThis.fetch,
  pagesRunner = pinnedPagesRunner,
  cli,
  cliSha256,
  delay = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  // No client is created until the future approved caller explicitly supplies it.
  if (
    !/^[a-f0-9]{32}$/.test(account ?? "") ||
    !/^jji-failover(?:-test)?$/.test(worker ?? "")
  )
    throw new Error("Unapproved provider target");
  const cf = workerToken
    ? apiClient("https://api.cloudflare.com/client/v4", workerToken, fetcher)
    : null;
  const gh = githubToken
    ? apiClient("https://api.github.com", githubToken, fetcher)
    : null;
  const workerBase = `/accounts/${account}/workers/scripts/${worker}`;
  const gate = async () => {
    if (!writesApproved) throw new Error("External writes disabled");
    assertTrustedContext(context);
    if (
      storagePolicy.allowInventoryAdmission === true &&
      storagePolicy.currentRunId !== context.runId
    )
      throw new Error("Inventory policy must match the trusted current run");
    assertStorageBudget(
      refreshStorage ? await refreshStorage() : storage,
      Date.now(),
      storagePolicy,
    );
  };
  return {
    async currentWorkerDeployment() {
      if (!cf) throw new Error("Worker read credential absent");
      const result = await cf(workerBase + "/deployments");
      const d = result.deployments?.[0];
      if (
        !uuid.test(d?.id ?? "") ||
        d.versions?.length !== 1 ||
        d.versions[0].percentage !== 100 ||
        !uuid.test(d.versions[0].version_id)
      )
        throw new Error("Worker is not an expected single-version deployment");
      return { id: d.id, version: d.versions[0].version_id };
    },
    async currentWorkerConfiguration() {
      if (!cf) throw new Error("Worker read credential absent");
      const settings = await cf(workerBase + "/settings");
      const binding = settings.bindings?.filter(
        (b) => b.name === "RELEASE_CONFIG" && b.type === "plain_text",
      );
      if (binding?.length !== 1)
        throw new Error("Worker release configuration absent");
      const config = JSON.parse(binding[0].text);
      if (
        !immutable.test(config.origin ?? "") ||
        !digest.test(config.current ?? "") ||
        !Array.isArray(config.retained) ||
        config.retained.length > 15 ||
        config.retained.some((r) => !digest.test(r))
      )
        throw new Error("Invalid observed Worker configuration");
      return config;
    },
    async uploadWorkerVersion({ code, config, key }) {
      await gate();
      if (
        !cf ||
        !immutable.test(config?.origin ?? "") ||
        !digest.test(config?.current ?? "") ||
        !Array.isArray(config.retained) ||
        config.retained.length > 15 ||
        config.retained.some((id) => !digest.test(id))
      )
        throw new Error("Invalid Worker release configuration");
      const settings = await cf(workerBase + "/settings");
      if (
        !Array.isArray(settings.bindings) ||
        settings.bindings.some(
          (b) => b.name !== "RELEASE_CONFIG" || b.type !== "plain_text",
        ) ||
        (settings.compatibility_flags?.length ?? 0) !== 0 ||
        settings.observability?.enabled !== false
      )
        throw new Error(
          "Worker has unreviewed bindings, flags or observability; no write",
        );
      // Dedicated availability Worker ONLY. Caller must preflight that it has no
      // secret/other resource bindings; this does not preserve an arbitrary app.
      return journal.run(
        key,
        async () => {
          const form = new FormData();
          form.set(
            "metadata",
            JSON.stringify({
              main_module: "worker.mjs",
              compatibility_date: "2026-10-23",
              bindings: [
                {
                  type: "plain_text",
                  name: "RELEASE_CONFIG",
                  text: JSON.stringify(config),
                },
              ],
            }),
          );
          form.set(
            "worker.mjs",
            new Blob([code], { type: "application/javascript+module" }),
            "worker.mjs",
          );
          const r = await cf(workerBase + "/versions", "POST", form);
          if (!uuid.test(r.id ?? "")) throw new Error("Invalid version ID");
          return { version: r.id };
        },
        { target: workerBase, code: fingerprint(code), config },
      );
    },
    async promoteWorker({ version, expectedDeployment, key }) {
      await gate();
      if (!uuid.test(version ?? "") || !uuid.test(expectedDeployment ?? ""))
        throw new Error("Invalid promotion");
      const before = await this.currentWorkerDeployment();
      if (before.id !== expectedDeployment)
        throw new Error("Stale Worker pointer; no write");
      // API has no compare-and-swap transaction. Shared CI lock and a single
      // publisher are REQUIRED; the read alone cannot exclude outside UI edits.
      return journal.run(
        key,
        async () => {
          const r = await cf(workerBase + "/deployments", "POST", {
            strategy: "percentage",
            versions: [{ version_id: version, percentage: 100 }],
          });
          if (!uuid.test(r.id ?? "")) throw new Error("Invalid deployment ID");
          return { id: r.id, version };
        },
        { target: workerBase, version, expectedDeployment },
      );
    },
    async uploadBackup({ directory, key }) {
      await gate();
      if (!pagesToken || !directory?.startsWith("/"))
        throw new Error("Missing Pages upload inputs");
      const files = await directoryFingerprint(directory);
      return journal.run(
        key,
        async () => ({
          origin: await pagesRunner({
            cli,
            cliSha256,
            token: pagesToken,
            account,
            args: [
              "pages",
              "deploy",
              directory,
              "--project-name=jji-backup-20261023",
              "--branch=failover-preview",
              "--commit-dirty=false",
            ],
          }),
        }),
        { account, project: "jji-backup-20261023", files },
      );
    },
    async deployGithub({ artifactId, artifactDigest, oidcToken, key }) {
      await gate();
      if (
        !gh ||
        !Number.isSafeInteger(artifactId) ||
        artifactId < 1 ||
        !/^sha256:[a-f0-9]{64}$/.test(artifactDigest ?? "") ||
        typeof oidcToken !== "string" ||
        !oidcToken
      )
        throw new Error("Missing GitHub deployment inputs");
      const artifact = await gh(
        `/repos/${REPO}/actions/artifacts/${artifactId}`,
      );
      if (
        artifact.id !== artifactId ||
        artifact.expired !== false ||
        artifact.digest !== artifactDigest ||
        artifact.workflow_run?.head_sha !== context.sha ||
        artifact.workflow_run?.head_branch !== "main"
      )
        throw new Error("Untrusted GitHub artifact; no write");
      return journal.run(
        key,
        async () => {
          const r = await gh(`/repos/${REPO}/pages/deployments`, "POST", {
            artifact_id: artifactId,
            environment: context.environment,
            pages_build_version: context.sha,
            oidc_token: oidcToken,
          });
          return receipt({ id: String(r.id) });
        },
        { repository: REPO, artifactId, artifactDigest, sha: context.sha },
      );
    },
    async waitGithub(id, polls = 12) {
      if (
        !gh ||
        !/^[a-f0-9-]{1,64}$/.test(id) ||
        !Number.isInteger(polls) ||
        polls < 1 ||
        polls > 24
      )
        throw new Error("Invalid bounded status polling");
      for (let i = 0; i < polls; i++) {
        const r = await gh(`/repos/${REPO}/pages/deployments/${id}`);
        if (r.status === "succeed") return { id };
        if (
          ![
            "deployment_queued",
            "deployment_in_progress",
            "queued",
            "pending",
            "waiting",
          ].includes(r.status)
        )
          throw new Error("GitHub deployment did not succeed");
        if (i + 1 < polls) await delay(5000);
      }
      throw new Error(
        "GitHub deployment still pending; inspect before continuing",
      );
    },
  };
}
