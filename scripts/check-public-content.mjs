import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const artifactRoot = fileURLToPath(new URL("../dist/", import.meta.url));
const root = artifactRoot;
const forbidden = [
  /\b(?:codex|chatgpt)\b/i,
  /\b(?:TODO|FIXME|XXX)\b/,
  /\b(?:local review|review draft|owner review|owner-review|audit notes?|internal notes?|fresh test visit|before publication|before publishing|under review)\b/i,
  /\b(?:pending|awaiting|requires?)\s+(?:owner|publication|release)\s+(?:review|approval)\b/i,
  /\/(?:Users|home)\/[^\s/]+\//,
  /\b(?:seo-sem-review|repo-backups|\.playwright-cli)\b/,
];
let checked = 0;
const findings = [];
async function walk(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      await walk(file);
      continue;
    }
    if (!/\.(?:html|js|css|json|xml|txt|svg|md|map)$/i.test(file)) continue;
    checked++;
    const source = await readFile(file, "utf8");
    // Also inspect normalized text so HTML wrapping cannot split a prohibited phrase.
    const normalized = source.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    for (const pattern of forbidden) {
      if (pattern.test(source) || pattern.test(normalized))
        findings.push(`${path.relative(root, file)}: ${pattern}`);
    }
  }
}
await walk(root);
if (findings.length)
  throw new Error(
    `Public content requires review:\n${findings.join("\n")}\nPreserve legitimate licenses and attribution; review findings rather than deleting them automatically.`,
  );
console.log(
  `Checked ${checked} public text/source assets for internal notes and private paths.`,
);
