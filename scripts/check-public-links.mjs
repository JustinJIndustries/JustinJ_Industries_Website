import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const errors = [];
let checked = 0;

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

async function checkUrl(value, documentUrl, source) {
  if (
    !value ||
    value.startsWith("#") ||
    /^(?:mailto:|tel:|javascript:|data:)/i.test(value)
  )
    return;
  const target = new URL(value, documentUrl);
  if (target.origin !== documentUrl.origin) return;
  if (target.pathname.includes("//")) {
    errors.push(`${source}: duplicate slash in local URL: ${value}`);
    return;
  }
  const relative = decodeURIComponent(target.pathname).replace(/^\//, "");
  const file = path.resolve(
    root,
    relative,
    target.pathname.endsWith("/") ? "index.html" : "",
  );
  if (!file.startsWith(`${root}${path.sep}`)) {
    errors.push(`${source}: path escapes public artifact: ${value}`);
    return;
  }
  checked += 1;
  try {
    if (!(await stat(file)).isFile())
      errors.push(`${source}: not a file: ${value}`);
  } catch {
    errors.push(`${source}: missing: ${value}`);
  }
}

for (const file of await walk(root)) {
  if (!file.endsWith(".html")) continue;
  const source = path.relative(root, file);
  const documentUrl = new URL(`https://www.justinjindustries.com/${source}`);
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(
    /\b(href|src|srcset|poster|action)\s*=\s*(["'])(.*?)\2/gis,
  )) {
    const values =
      match[1].toLowerCase() === "srcset"
        ? match[3].split(",").map((item) => item.trim().split(/\s+/)[0])
        : [match[3]];
    for (const value of values) {
      if (
        match[1].toLowerCase() === "href" &&
        /\.html(?:[?#]|$)/i.test(value)
      ) {
        errors.push(`${source}: visitor link still uses .html: ${value}`);
      }
      await checkUrl(value, documentUrl, source);
    }
  }
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Verified ${checked} local HTML references in dist/.\n`);
}
