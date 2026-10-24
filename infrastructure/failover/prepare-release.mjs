import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  cp,
  access,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PREFIX = "__jji_releases";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function files(root, parent = "") {
  const output = [];
  for (const item of await readdir(path.join(root, parent), {
    withFileTypes: true,
  })) {
    const rel = path.posix.join(parent, item.name);
    if (item.isSymbolicLink())
      throw new Error("Symlinks are not allowed in a release");
    if (item.isDirectory()) output.push(...(await files(root, rel)));
    else if (item.isFile()) output.push(rel);
    else throw new Error("Unsupported release file");
  }
  return output.sort();
}
async function manifest(root) {
  const entries = [];
  for (const name of await files(root))
    entries.push({
      path: name,
      sha256: sha(await readFile(path.join(root, name))),
    });
  return entries;
}
function asset(name) {
  return (
    !/\.html$/.test(name) &&
    !["robots.txt", "sitemap.xml", "_headers", "_redirects", "CNAME"].includes(
      name,
    )
  );
}
export function rewrite(text, name, assets, release) {
  const prefix = `/${PREFIX}/${release}/`;
  function ref(value) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(value)) return value;
    const resolved = new URL(
      value,
      `https://www.justinjindustries.com/${name}`,
    );
    const rel = resolved.pathname.slice(1);
    return assets.has(rel)
      ? prefix + rel + resolved.search + resolved.hash
      : value;
  }
  // The public /assets/ namespace also occurs in design.js template strings.
  if (/\.js$/.test(name))
    text = text.replace(/\/assets\//g, prefix + "assets/");
  text = text.replace(
    /\b(srcset|data-srcset)=(['"])(.*?)\2/g,
    (_, key, quote, value) =>
      `${key}=${quote}${value
        .split(",")
        .map((part) => {
          const match = part.trim().match(/^(\S+)(.*)$/);
          return match ? ref(match[1]) + match[2] : part;
        })
        .join(", ")}${quote}`,
  );
  text = text.replace(
    /(['"`])([^'"`\s<>]+)\1/g,
    (_, quote, value) => quote + ref(value) + quote,
  );
  return text.replace(
    /url\(\s*([^'"\s)][^)]*?)\s*\)/g,
    (_, value) => `url(${ref(value)})`,
  );
}

export async function verifyPackage(root, { requireStage = true } = {}) {
  const meta = JSON.parse(
    await readFile(path.join(root, "release.json"), "utf8"),
  );
  if (
    meta.schema !== 1 ||
    !Array.isArray(meta.releases) ||
    meta.releases[0] !== meta.release ||
    meta.releases.length > 16 ||
    new Set(meta.releases).size !== meta.releases.length ||
    meta.releases.some((id) => !/^[a-f0-9]{64}$/.test(id)) ||
    sha("jji-release-schema-1\n" + JSON.stringify(meta.sourceFiles)) !==
      meta.release
  )
    throw new Error("Invalid release metadata");
  if (
    JSON.stringify(await manifest(path.join(root, "public"))) !==
    JSON.stringify(meta.files)
  )
    throw new Error("Previous package digest mismatch");
  if ((meta.releases.length > 1 || meta.bootstrap === true) && requireStage) {
    if (
      (meta.bootstrap === true
        ? meta.releases.length !== 1 ||
          JSON.stringify(meta.previousFiles) !==
            JSON.stringify(meta.sourceFiles)
        : meta.previousRelease !== meta.releases[1]) ||
      !Array.isArray(meta.stageFiles)
    )
      throw new Error("Missing authenticated stage metadata");
    if (
      JSON.stringify(await manifest(path.join(root, "stage"))) !==
      JSON.stringify(meta.stageFiles)
    )
      throw new Error("Stage package digest mismatch");
    const expectedStage = new Map(
      (meta.previousFiles ?? []).map((f) => [f.path, f.sha256]),
    );
    for (const f of meta.files.filter((f) =>
      f.path.startsWith(PREFIX + "/" + meta.release + "/"),
    ))
      expectedStage.set(f.path, f.sha256);
    if (
      JSON.stringify([...expectedStage].sort()) !==
      JSON.stringify(meta.stageFiles.map((f) => [f.path, f.sha256]).sort())
    )
      throw new Error("Stage changed predecessor files");
    // The rollback stage must retain EVERY immutable asset exposed by final HTML.
    const stageAssets = new Map(meta.stageFiles.map((f) => [f.path, f.sha256]));
    if (
      meta.files.some(
        (f) =>
          f.path.startsWith(PREFIX + "/") &&
          stageAssets.get(f.path) !== f.sha256,
      )
    )
      throw new Error("Stage immutable asset union mismatch");
  }
  return meta;
}

export async function prepareRelease({
  source,
  output,
  previous,
  bootstrap = false,
  maxBytes = 200 * 1024 * 1024,
}) {
  if (bootstrap && previous)
    throw new Error("Bootstrap cannot replace a predecessor");
  try {
    await access(output);
    throw new Error("Output already exists; releases are write-once");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const names = await files(source);
  if (
    names.some(
      (n) =>
        n.startsWith(PREFIX + "/") ||
        /(^|\/)(?:\.git|node_modules|docs|tools|scripts|partials)(\/|$)/.test(
          n,
        ),
    )
  )
    throw new Error("Source must be the allowlisted public build");
  const sourceFiles = await manifest(source);
  const release = sha("jji-release-schema-1\n" + JSON.stringify(sourceFiles));
  const assets = new Set(names.filter(asset));
  // Only predecessor PUBLIC is reused; a compact checkpoint need not retain its
  // historical stage. Current candidate stage is still mandatory for publication.
  const previousMeta = previous
    ? await verifyPackage(previous, { requireStage: false })
    : null;
  if (previousMeta && previousMeta.releases.includes(release))
    throw new Error("Release already exists; reuse the verified package");
  const publicRoot = path.join(output, "public");
  await mkdir(publicRoot, { recursive: true });
  await cp(source, publicRoot, { recursive: true });
  if (previousMeta)
    await cp(
      path.join(previous, "public", PREFIX),
      path.join(publicRoot, PREFIX),
      { recursive: true },
    );
  for (const name of names) {
    let bytes = await readFile(path.join(source, name));
    if (/\.(?:html|css|js|svg)$/.test(name))
      bytes = Buffer.from(rewrite(bytes.toString(), name, assets, release));
    await writeFile(path.join(publicRoot, name), bytes);
    if (assets.has(name)) {
      const target = path.join(publicRoot, PREFIX, release, name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
  }
  const entries = await manifest(publicRoot);
  const totalBytes = (
    await Promise.all(
      entries.map((e) => readFile(path.join(publicRoot, e.path))),
    )
  ).reduce((n, b) => n + b.length, 0);
  const releases = [release, ...(previousMeta?.releases ?? [])];
  if (totalBytes > maxBytes || entries.length > 2000 || releases.length > 16)
    throw new Error(
      "Free-budget retention limit reached; owner review required, no pruning performed",
    );
  const meta = {
    schema: 1,
    release,
    releases,
    totalBytes,
    sourceFiles,
    files: entries,
  };
  if (previousMeta) {
    // Publish this before new HTML: old pages plus both immutable asset generations.
    const stage = path.join(output, "stage");
    await cp(path.join(previous, "public"), stage, { recursive: true });
    await cp(
      path.join(publicRoot, PREFIX, release),
      path.join(stage, PREFIX, release),
      { recursive: true },
    );
    for (const name of (await files(path.join(previous, "public"))).filter(
      (n) => n.endsWith(".html"),
    )) {
      if (
        !(await readFile(path.join(stage, name))).equals(
          await readFile(path.join(previous, "public", name)),
        )
      )
        throw new Error("Staging changed previous HTML");
    }
    meta.previousRelease = previousMeta.release;
    meta.previousFiles = previousMeta.files;
    meta.stageFiles = await manifest(stage);
  } else if (bootstrap) {
    // Initial transition: unmodified approved root/HTML plus new immutable assets.
    const stage = path.join(output, "stage");
    await cp(source, stage, { recursive: true });
    await cp(
      path.join(publicRoot, PREFIX, release),
      path.join(stage, PREFIX, release),
      { recursive: true },
    );
    meta.bootstrap = true;
    meta.previousFiles = sourceFiles;
    meta.stageFiles = await manifest(stage);
  }
  await writeFile(
    path.join(output, "release.json"),
    JSON.stringify(meta, null, 2) + "\n",
  );
  await verifyPackage(output);
  return meta;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [source, output, previous] = process.argv.slice(2);
  if (!source || !output)
    throw new Error(
      "Usage: prepare-release.mjs PUBLIC_DIST NEW_PACKAGE [PREVIOUS_VERIFIED_PACKAGE]",
    );
  const result = await prepareRelease({
    source,
    output,
    previous: previous === "--bootstrap" ? undefined : previous,
    bootstrap: previous === "--bootstrap",
  });
  console.log(
    JSON.stringify({
      release: result.release,
      files: result.files.length,
      bytes: result.totalBytes,
    }),
  );
}
