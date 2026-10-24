import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  inspectTrustedCi,
  githubInspector,
  verifyToolchain,
} from "./trusted-inspectors.mjs";
// Invoked only by the inactive proposal after owner enables a reviewed workflow.
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const remote = execFileSync("git", ["remote", "get-url", "origin"], {
  encoding: "utf8",
});
await inspectTrustedCi({
  env: process.env,
  event,
  remote,
  read: githubInspector({ token: process.env.GH_READ_TOKEN }),
});
await verifyToolchain(new URL("./toolchain", import.meta.url).pathname);
console.log(
  "Trusted-main revision, protected environment, paused publisher, remote and deployment toolchain verified.",
);
