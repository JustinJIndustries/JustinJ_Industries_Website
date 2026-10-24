// Protected proof workflow entry point; no Cloudflare credentials or public fetch.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  githubReader,
  proofWorkflowGuard,
  writeProtectedProof,
} from "./checkpoint-github.mjs";
try {
  const env = process.env,
    read = githubReader(env.GH_READ_TOKEN),
    event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH));
  if (!path.isAbsolute(env.RUNNER_TEMP ?? "") || /[\r\n]/.test(env.RUNNER_TEMP))
    throw new Error("Invalid proof runner path");
  const root = path.join(env.RUNNER_TEMP, "jji-public-proof");
  if (process.argv[2] === "guard") {
    const c = await proofWorkflowGuard(env, event, read);
    await mkdir(root, { recursive: true });
    await writeFile(
      env.GITHUB_ENV,
      `CHECKPOINT_PARENT_RUN_ID=${c.claim.parentRunId}\nCHECKPOINT_REQUEST_ARTIFACT_ID=${c.artifact.id}\n`,
      { flag: "a" },
    );
  } else if (process.argv[2] === "record")
    await writeProtectedProof({ root, env, event, read });
  else throw new Error("Unknown proof command");
} catch {
  console.error(
    "Protected M1 proof refused; inspect exact request and owner review. No proof uploaded by this command.",
  );
  process.exitCode = 1;
}
