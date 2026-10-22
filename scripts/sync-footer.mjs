import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { format } from "prettier";

const root = fileURLToPath(new URL("../", import.meta.url));
const pages = [
  "index.html",
  "about.html",
  "work.html",
  "catalogue.html",
  "design.html",
  "government-buyers.html",
  "policies.html",
  "capability-statement.html",
  "404.html",
  "services.html",
  "services/website-development/index.html",
  "services/analytics-tagging/index.html",
  "services/advertising/index.html",
  "services/cms-support/index.html",
  "services/responsible-implementation/index.html",
  "design/alder-lane/index.html",
  "design/harbor-ledger/index.html",
  "design/still-form/index.html",
  "design/aer-field/index.html",
  "design/northside/index.html",
];
const template = (
  await readFile(path.join(root, "partials/site-footer.html"), "utf8")
).trim();
const css = await readFile(path.join(root, "assets/site-footer.css"));
const digest = createHash("sha256").update(css).digest("hex").slice(0, 10);
const footer =
  "    <!-- shared:footer:start -->\n" +
  template
    .split("\n")
    .map((line) => "    " + line)
    .join("\n") +
  "\n    <!-- shared:footer:end -->";
const cssLink = `    <link rel="stylesheet" href="/assets/site-footer.css?v=${digest}" />`;
const write = process.argv.includes("--write");
const stale = [];
for (const page of pages) {
  const target = path.join(root, page);
  const source = await readFile(target, "utf8");
  let next = source;
  if (source.includes("<!-- shared:footer:start -->")) {
    next = next.replace(
      /^    <!-- shared:footer:start -->[\s\S]*?^    <!-- shared:footer:end -->/m,
      footer,
    );
  } else if (/<footer\b/.test(source)) {
    next = next.replace(/^    <footer\b[\s\S]*?^    <\/footer>/m, footer);
  } else {
    next = next.replace(/^    <script>\s*$/m, footer + "\n    <script>");
  }
  if (!next.includes(footer))
    throw new Error(`Could not locate shared footer in ${page}`);
  if (
    /^    <link rel="stylesheet" href="\/assets\/site-footer\.css[^\n]*$/m.test(
      next,
    )
  ) {
    next = next.replace(
      /^    <link rel="stylesheet" href="\/assets\/site-footer\.css[^\n]*$/m,
      cssLink,
    );
  } else {
    next = next.replace("  </head>", cssLink + "\n  </head>");
  }
  next = await format(next, { parser: "html" });
  if (next !== source) {
    stale.push(page);
    if (write) await writeFile(target, next);
  }
}
if (stale.length && !write) {
  throw new Error(
    `Shared footer is stale: ${stale.join(", ")}. Run npm run sync:footer.`,
  );
}
console.log(
  `${write ? "Synchronized" : "Verified"} shared footer across ${pages.length} JJI pages.`,
);
