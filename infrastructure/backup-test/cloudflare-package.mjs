import { cp, readFile, writeFile, access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { verifyPackage } from "./prepare-release.mjs";

async function inventory(root, prefix = "") {
  const names = [];
  for (const f of await readdir(root, { withFileTypes: true })) {
    if (f.isSymbolicLink())
      throw new Error("Cloudflare upload symlink rejected");
    if (f.isDirectory())
      names.push(
        ...(await inventory(path.join(root, f.name), prefix + f.name + "/")),
      );
    else if (f.isFile()) names.push(prefix + f.name);
    else throw new Error("Unsupported upload file");
  }
  return names.sort();
}

export async function verifyCloudflareDirectory(packageRoot, output, routes) {
  const meta = await verifyPackage(packageRoot);
  const expected = [
    ...meta.files.map((f) => f.path),
    "_headers",
    "_redirects",
  ].sort();
  if (JSON.stringify(await inventory(output)) !== JSON.stringify(expected))
    throw new Error("Cloudflare upload inventory mismatch");
  for (const f of meta.files) {
    if (
      createHash("sha256")
        .update(await readFile(path.join(output, f.path)))
        .digest("hex") !== f.sha256
    )
      throw new Error("Cloudflare upload public digest mismatch");
  }
  if (
    (await readFile(path.join(output, "_headers"), "utf8")) !==
      "/*\n  X-Robots-Tag: noindex\n" ||
    (await readFile(path.join(output, "_redirects"), "utf8")) !==
      routes.map((r) => `${r.source} ${r.target} 301\n`).join("")
  )
    throw new Error("Cloudflare upload metadata mismatch");
  return meta;
}

export async function cloudflarePackage(packageRoot, output, routes) {
  const meta = await verifyPackage(packageRoot);
  try {
    await access(output);
    throw new Error("Output already exists");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const route of routes) {
    if (
      !/^\/(?!\/)[\w/.-]+\.html$/.test(route.source) ||
      !/^\/(?!\/)[\w/.-]*\/$|^\/$/.test(route.target) ||
      route.source.includes("..") ||
      route.target.includes("..")
    )
      throw new Error("Unsafe redirect mapping");
    await access(path.join(packageRoot, "public", route.target, "index.html"));
  }
  await cp(path.join(packageRoot, "public"), output, { recursive: true });
  await writeFile(
    path.join(output, "_redirects"),
    routes.map((r) => `${r.source} ${r.target} 301\n`).join(""),
  );
  await writeFile(
    path.join(output, "_headers"),
    "/*\n  X-Robots-Tag: noindex\n",
  );
  for (const f of meta.files) {
    const digest = createHash("sha256")
      .update(await readFile(path.join(output, f.path)))
      .digest("hex");
    if (digest !== f.sha256)
      throw new Error("Cloudflare packaging changed public bytes");
  }
  await verifyCloudflareDirectory(packageRoot, output, routes);
  return meta;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [input, output, routeFile] = process.argv.slice(2);
  await cloudflarePackage(
    input,
    output,
    JSON.parse(await readFile(routeFile, "utf8")),
  );
  console.log(
    "Cloudflare adapter prepared; public bytes match the GitHub package.",
  );
}
