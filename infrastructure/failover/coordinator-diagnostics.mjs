// Fixed diagnostic vocabulary only. Never persist provider bodies, URLs, stacks,
// environment values or free-form errors. This is not a publication authority.
import { mkdir, lstat, open, writeFile } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";

const stages = new Set([
  "startup",
  "inputs",
  "identity",
  "publisher",
  "storage",
  "provider",
  "candidate",
  "recovery",
  "package",
  "baseline",
  "publication",
]);
const codes = new Map([
  ["Unapproved paired publication inputs; no writes", "inputs_rejected"],
  ["Missing existing read credential", "read_credential_absent"],
  [
    "GitHub prerequisite read failed; do not expand access automatically",
    "identity_read_failed",
  ],
  ["GitHub read failed; no scope expansion", "github_read_failed"],
  ["Unverified zero-spend storage guard", "storage_rejected"],
  ["Main advanced during publication; stop before next write", "main_advanced"],
  ["Owner-pinned candidate digest mismatch", "candidate_digest_mismatch"],
  [
    "Prepared backup/source/run provenance mismatch",
    "candidate_provenance_mismatch",
  ],
  [
    "Immutable recovery read failed (status, integrity, security or timeout); stop without retry",
    "recovery_read_failed",
  ],
  ["Recovery total wait exceeded", "recovery_timeout"],
  [
    "Public checkpoint is not bound to exact phase artifact",
    "checkpoint_binding_rejected",
  ],
  [
    "M1 checkpoint timed out; inspect deployed phase before recovery",
    "checkpoint_timeout",
  ],
]);
export function diagnosticCode(error) {
  return codes.get(error?.message) ?? "unclassified_failure";
}
export async function startDiagnostics(root, command, env) {
  if (
    !["prepare", "promote"].includes(command) ||
    typeof env.RUNNER_TEMP !== "string" ||
    !path.isAbsolute(env.RUNNER_TEMP) ||
    /[\r\n]/.test(env.RUNNER_TEMP) ||
    root !== path.join(env.RUNNER_TEMP, "jji-paired") ||
    path.normalize(root) !== root
  )
    throw new Error("Invalid coordinator diagnostic root");
  // mkdir without recursion refuses any existing/symlinked coordinator root.
  // RUNNER_TEMP is allocated by Actions; never create its ancestors here.
  if (!(await lstat(env.RUNNER_TEMP)).isDirectory())
    throw new Error("Invalid coordinator diagnostic parent");
  await mkdir(root, { mode: 0o700 });
  let stage = "startup";
  const record = () => ({ schema: 1, command, pid: process.pid, stage });
  // Append fixed progress records: no replacement race or symlink-following.
  await writeFile(
    path.join(root, "coordinator.jsonl"),
    JSON.stringify(record()) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  return {
    async stage(next) {
      if (!stages.has(next))
        throw new Error("Invalid coordinator diagnostic stage");
      stage = next;
      await writeFile(
        path.join(root, "coordinator.jsonl"),
        JSON.stringify(record()) + "\n",
        {
          flag: constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW,
          mode: 0o600,
        },
      );
    },
    async failed(error) {
      await writeFile(
        path.join(root, "outcome.json"),
        JSON.stringify({
          status: "failed",
          diagnostic: { ...record(), code: diagnosticCode(error) },
        }) + "\n",
        { flag: "wx", mode: 0o600 },
      );
    },
  };
}
async function readBounded(file) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) return null;
    if (stat.size > 8192) throw new Error("Diagnostic record exceeds cap");
    const bytes = await handle.readFile();
    if (bytes.length > 8192) throw new Error("Diagnostic record exceeds cap");
    return bytes;
  } catch (e) {
    if (["ENOENT", "ELOOP"].includes(e.code)) return null;
    throw e;
  } finally {
    await handle?.close();
  }
}
export async function readDiagnosticOutcome(root) {
  const bytes = await readBounded(path.join(root, "outcome.json"));
  if (!bytes) return null;
  const outcome = JSON.parse(bytes),
    d = outcome.diagnostic;
  if (outcome.status !== "failed") return null;
  if (
    !d ||
    d.schema !== 1 ||
    !["prepare", "promote"].includes(d.command) ||
    !Number.isSafeInteger(d.pid) ||
    d.pid <= 0 ||
    !stages.has(d.stage) ||
    ![...codes.values(), "unclassified_failure"].includes(d.code)
  )
    throw new Error("Invalid sanitized coordinator outcome");
  // Return newly constructed fields, never unknown input keys.
  return {
    schema: 1,
    command: d.command,
    pid: d.pid,
    stage: d.stage,
    code: d.code,
  };
}

export async function readCoordinatorProgress(root) {
  const bytes = await readBounded(path.join(root, "coordinator.jsonl"));
  if (!bytes) return null;
  let latest;
  for (const line of bytes.toString("utf8").trim().split("\n")) {
    const d = JSON.parse(line);
    if (
      d.schema !== 1 ||
      !["prepare", "promote"].includes(d.command) ||
      !Number.isSafeInteger(d.pid) ||
      d.pid <= 0 ||
      !stages.has(d.stage) ||
      (latest && (latest.pid !== d.pid || latest.command !== d.command))
    )
      throw new Error("Invalid sanitized coordinator progress");
    latest = { schema: 1, command: d.command, pid: d.pid, stage: d.stage };
  }
  return latest;
}
