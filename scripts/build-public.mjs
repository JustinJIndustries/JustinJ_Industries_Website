import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicFiles = Object.freeze([
  "index.html",
  "government-buyers.html",
  "capability-statement.html",
  "styles.css",
  "script.js",
  "robots.txt",
  "sitemap.xml",
  "assets/logos/JJI-Logo-Only-grey.png",
  "assets/logos/JJI-Logo-Only-white.png",
]);

const repositoryRoot = await realpath(
  path.resolve(fileURLToPath(new URL("..", import.meta.url))),
);
const artifactRoot = path.resolve(repositoryRoot, "dist");

function resolveContainedPath(root, relativePath) {
  if (
    !relativePath ||
    path.posix.normalize(relativePath) !== relativePath ||
    path.posix.isAbsolute(relativePath) ||
    relativePath.includes("\\")
  ) {
    throw new Error(`Unsafe public path: ${relativePath}`);
  }

  const resolvedPath = path.resolve(root, ...relativePath.split("/"));
  const relativeResolvedPath = path.relative(root, resolvedPath);

  if (
    !relativeResolvedPath ||
    relativeResolvedPath === ".." ||
    relativeResolvedPath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeResolvedPath)
  ) {
    throw new Error(`Public path escapes its root: ${relativePath}`);
  }

  return resolvedPath;
}

async function getStatus(targetPath, missingMessage) {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(missingMessage, { cause: error });
    }

    throw error;
  }
}

async function validateSourceFile(relativePath) {
  const segments = relativePath.split("/");
  let currentPath = repositoryRoot;

  for (const [index, segment] of segments.entries()) {
    currentPath = path.join(currentPath, segment);
    const status = await getStatus(
      currentPath,
      `Missing approved public source: ${relativePath}`,
    );
    const isLastSegment = index === segments.length - 1;

    if (status.isSymbolicLink()) {
      throw new Error(
        `Approved public source cannot be a symlink: ${relativePath}`,
      );
    }

    if (isLastSegment && !status.isFile()) {
      throw new Error(`Approved public source must be a file: ${relativePath}`);
    }

    if (!isLastSegment && !status.isDirectory()) {
      throw new Error(
        `Approved public source parent must be a directory: ${relativePath}`,
      );
    }
  }

  return resolveContainedPath(repositoryRoot, relativePath);
}

function getExpectedDirectories() {
  const directories = new Set();

  for (const relativePath of publicFiles) {
    const segments = relativePath.split("/");

    for (let index = 1; index < segments.length; index += 1) {
      directories.add(segments.slice(0, index).join("/"));
    }
  }

  return directories;
}

async function prepareArtifactRoot() {
  if (path.relative(repositoryRoot, artifactRoot) !== "dist") {
    throw new Error("Refusing to build outside the repository dist directory.");
  }

  try {
    const status = await lstat(artifactRoot);

    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new Error(
        "Refusing to replace dist because it is not a directory.",
      );
    }

    await rm(artifactRoot, { recursive: true });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  await mkdir(artifactRoot);
}

async function copyPublicFile(relativePath, sourcePath) {
  const destinationPath = resolveContainedPath(artifactRoot, relativePath);

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);

  const destinationStatus = await lstat(destinationPath);
  if (destinationStatus.isSymbolicLink() || !destinationStatus.isFile()) {
    throw new Error(`Built artifact is not a regular file: ${relativePath}`);
  }

  const [sourceBytes, artifactBytes] = await Promise.all([
    readFile(sourcePath),
    readFile(destinationPath),
  ]);

  if (!sourceBytes.equals(artifactBytes)) {
    throw new Error(`Built artifact differs from its source: ${relativePath}`);
  }
}

async function walkArtifact(
  directoryPath,
  relativeDirectory = "",
  artifactFiles = [],
) {
  const entries = await readdir(directoryPath);
  entries.sort();

  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry}`
      : entry;
    const entryPath = resolveContainedPath(artifactRoot, relativePath);
    const status = await lstat(entryPath);

    if (status.isSymbolicLink()) {
      throw new Error(
        `Built artifact cannot contain a symlink: ${relativePath}`,
      );
    }

    if (status.isDirectory()) {
      if (!expectedDirectories.has(relativePath)) {
        throw new Error(`Unexpected artifact directory: ${relativePath}`);
      }

      await walkArtifact(entryPath, relativePath, artifactFiles);
      continue;
    }

    if (!status.isFile()) {
      throw new Error(`Unsupported artifact entry: ${relativePath}`);
    }

    if (!expectedFiles.has(relativePath)) {
      throw new Error(`Unexpected artifact file: ${relativePath}`);
    }

    artifactFiles.push(relativePath);
  }

  return artifactFiles;
}

if (new Set(publicFiles).size !== publicFiles.length) {
  throw new Error("The public file allowlist contains a duplicate path.");
}

const expectedFiles = new Set(publicFiles);
const expectedDirectories = getExpectedDirectories();
const sourcePaths = new Map();

for (const relativePath of publicFiles) {
  resolveContainedPath(repositoryRoot, relativePath);
  sourcePaths.set(relativePath, await validateSourceFile(relativePath));
}

await prepareArtifactRoot();

for (const relativePath of publicFiles) {
  await copyPublicFile(relativePath, sourcePaths.get(relativePath));
}

const artifactFiles = (await walkArtifact(artifactRoot)).sort();
const sortedExpectedFiles = [...publicFiles].sort();

if (
  artifactFiles.length !== sortedExpectedFiles.length ||
  artifactFiles.some(
    (relativePath, index) => relativePath !== sortedExpectedFiles[index],
  )
) {
  const missingFiles = sortedExpectedFiles.filter(
    (relativePath) => !artifactFiles.includes(relativePath),
  );
  throw new Error(
    `Built artifact is missing files: ${missingFiles.join(", ")}`,
  );
}

const output = [`Built dist/ with ${artifactFiles.length} public files:`];

for (const relativePath of artifactFiles) {
  const status = await lstat(resolveContainedPath(artifactRoot, relativePath));
  output.push(`- ${relativePath} (${status.size} bytes)`);
}

process.stdout.write(`${output.join("\n")}\n`);
