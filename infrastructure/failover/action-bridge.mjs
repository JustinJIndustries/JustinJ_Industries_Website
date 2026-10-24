// Local runner IPC only. Official pinned Actions perform artifact transport;
// credentials and OIDC tokens never enter the request/response files.
import { mkdir, readFile, writeFile, rename, lstat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const phases = new Set([
  "stage",
  "recovery",
  "final",
  "public-baseline",
  "public-stage",
  "public-final",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(file) {
  try {
    if ((await lstat(file)).isSymbolicLink()) throw new Error("IPC symlink");
    const bytes = await readFile(file);
    if (bytes.length > 8192) throw new Error("IPC size");
    return JSON.parse(bytes);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function write(file, value) {
  await writeFile(file + ".next", JSON.stringify(value) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  await rename(file + ".next", file);
}
export function actionBridge(
  root,
  { timeoutMs = 120000, publicTimeoutMs = 600000, pollMs = 100 } = {},
) {
  if (
    !path.isAbsolute(root) ||
    timeoutMs <= 0 ||
    timeoutMs > 180000 ||
    publicTimeoutMs <= 0 ||
    publicTimeoutMs > 600000 ||
    pollMs <= 0
  )
    throw new Error("Invalid bounded action bridge");
  const file = (phase, kind) => {
    if (!phases.has(phase)) throw new Error("Unknown artifact phase");
    return path.join(root, `${phase}.${kind}.json`);
  };
  async function wait(phase, kind) {
    const end =
      Date.now() + (phase.startsWith("public-") ? publicTimeoutMs : timeoutMs);
    while (Date.now() < end) {
      const result = await json(file(phase, kind));
      if (result) return result;
      const outcome = await json(path.join(root, "outcome.json"));
      if (outcome?.status === "failed")
        throw new Error("Publisher stopped; inspect before retry");
      await sleep(pollMs);
    }
    throw new Error(
      "Artifact handoff timed out; outcome may be uncertain; do not replay",
    );
  }
  return {
    async request(phase) {
      await mkdir(root, { recursive: true });
      if (await json(file(phase, "request")))
        throw new Error("Handoff already attempted; no replay");
      const request = { phase, nonce: randomUUID() };
      await write(file(phase, "request"), request);
      const reply = await wait(phase, "reply");
      if (
        reply.nonce !== request.nonce ||
        reply.phase !== phase ||
        !Number.isSafeInteger(reply.id) ||
        reply.id < 1 ||
        !/^[a-f0-9]{64}$/.test(reply.digest ?? "")
      )
        throw new Error("Artifact handoff identity mismatch");
      return reply;
    },
    async waitRequest(phase) {
      const r = await wait(phase, "request");
      if (r.phase !== phase || !/^[a-f0-9-]{36}$/.test(r.nonce ?? ""))
        throw new Error("Invalid action request");
      return r;
    },
    async reply(phase, { id, digest }) {
      const r = await this.waitRequest(phase);
      if (await json(file(phase, "reply")))
        throw new Error("Reply already exists");
      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        !/^[a-f0-9]{64}$/.test(digest ?? "")
      )
        throw new Error("Invalid official artifact outputs");
      await write(file(phase, "reply"), { ...r, id, digest });
    },
  };
}
