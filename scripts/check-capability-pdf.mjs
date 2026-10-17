import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(
  await readFile(
    path.join(root, "docs/capability-statement-pdf-build.json"),
    "utf8",
  ),
);
const expectedSources = [
  "capability-statement.html",
  "assets/logos/JJI-Logo-Only-white.png",
  "assets/site-footer.css",
];
if (
  manifest.output !== "assets/justinj-industries-capability-statement.pdf" ||
  JSON.stringify(Object.keys(manifest.sources)) !==
    JSON.stringify(expectedSources)
)
  throw new Error("Unexpected capability PDF manifest paths.");
for (const source of expectedSources) {
  if (
    digest(await readFile(path.join(root, source))) !== manifest.sources[source]
  )
    throw new Error(
      `Capability PDF is stale after ${source} changed. Run npm run build:capability.`,
    );
}
const bytes = await readFile(path.join(root, manifest.output));
const raw = bytes.toString("latin1");
if (
  digest(bytes) !== manifest.sha256 ||
  !raw.startsWith("%PDF-") ||
  (raw.match(/\/Type\s*\/Page\b/g) || []).length !== 1 ||
  !raw.includes("/StructTreeRoot") ||
  !/\/Marked\s+true/.test(raw) ||
  !/\/Lang\s*\(en-US\)/.test(raw)
)
  throw new Error(
    "Capability PDF failed integrity, page-count or structure checks. Rebuild with npm run build:capability.",
  );
console.log(
  "Verified current one-page capability PDF, source hashes and tagged document structure.",
);
