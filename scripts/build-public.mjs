import "./sync-footer.mjs";
import "./check-capability-pdf.mjs";
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
  "about.html",
  "policies.html",
  "work.html",
  "catalogue.html",
  "design.html",
  "government-buyers.html",
  "capability-statement.html",
  "assets/justinj-industries-capability-statement.pdf",
  "styles.css",
  "assets/home-journeys.css",
  "assets/home-journeys.js",
  "assets/site-footer.css",
  "script.js",
  "design.js",
  "robots.txt",
  "sitemap.xml",
  "favicon.svg",
  "assets/logos/JJI-Logo-Only-grey.png",
  "assets/logos/JJI-Logo-Only-white.png",
  "assets/logos/wordpress-wmark-gray.png",
  "assets/logos/wordpress-wmark-white.png",
  "assets/catalogue/harbor-home.png",
  "assets/catalogue/alder-home.webp",
  "assets/catalogue/still-arches.jpg",
  "assets/catalogue/aer-hero.jpg",
  "assets/catalogue/aer-golf.jpg",
  "assets/about/experience-measurement.svg",
  "assets/arrow-links.css",
  "assets/demo-return.css",
  "assets/demo-return.js",
  "assets/previews/alder-lane-mobile.png",
  "assets/previews/harbor-ledger-mobile.png",
  "assets/previews/still-form-mobile.png",
  "assets/previews/aer-field-mobile.png",
  "assets/previews/northside-mobile.png",
  "assets/previews/northside-mobile@3x.webp",
  "assets/previews/alder-lane-mobile@3x.webp",
  "assets/previews/harbor-ledger-mobile@3x.webp",
  "assets/previews/still-form-mobile@3x.webp",
  "assets/previews/aer-field-mobile@3x.webp",
  "previews/alder-lane/index.html",
  "previews/alder-lane/favicon-32.png",
  "previews/alder-lane/services.html",
  "previews/alder-lane/about.html",
  "previews/alder-lane/contact.html",
  "previews/alder-lane/styles.css",
  "previews/alder-lane/site.js",
  "previews/alder-lane/favicon.svg",
  "previews/harbor-ledger/index.html",
  "previews/harbor-ledger/favicon.svg",
  "previews/harbor-ledger/favicon-32.png",
  "previews/harbor-ledger/services.html",
  "previews/harbor-ledger/about.html",
  "previews/harbor-ledger/faq.html",
  "previews/harbor-ledger/contact.html",
  "previews/harbor-ledger/source.css",
  "previews/harbor-ledger/preview.css",
  "previews/harbor-ledger/site.js",
  "previews/harbor-ledger/assets/ledger-workspace.jpg",
  "previews/harbor-ledger/assets/quiet-workspace.jpg",
  "previews/still-form/index.html",
  "previews/still-form/favicon.svg",
  "previews/still-form/favicon-32.png",
  "previews/still-form/work.html",
  "previews/still-form/services.html",
  "previews/still-form/about.html",
  "previews/still-form/contact.html",
  "previews/still-form/source.css",
  "previews/still-form/site.js",
  "previews/still-form/project-media.js",
  "previews/still-form/project-media.css",
  "previews/still-form/project/arc/index.html",
  "previews/still-form/project/noon/index.html",
  "previews/still-form/project/form/index.html",
  "previews/still-form/project/kindred/index.html",
  "previews/still-form/project/ground/index.html",
  "previews/still-form/project/elsewhere/index.html",
  "previews/still-form/assets/design/arc.svg",
  "previews/still-form/assets/design/noon.svg",
  "previews/still-form/assets/design/form.svg",
  "previews/still-form/assets/design/kindred.svg",
  "previews/still-form/assets/design/ground.svg",
  "previews/still-form/assets/design/elsewhere.svg",
  "previews/still-form/assets/design/arc-identity.svg",
  "previews/still-form/assets/design/arc-posters.svg",
  "previews/still-form/assets/design/arc-programme.svg",
  "previews/still-form/assets/design/noon-range.svg",
  "previews/still-form/assets/design/noon-label.svg",
  "previews/still-form/assets/design/noon-campaign.svg",
  "previews/still-form/assets/design/arc-motion.mp4",
  "previews/still-form/assets/design/arc-motion-poster.png",
  "previews/still-form/assets/design/arc-motion.vtt",

  "previews/still-form/preview.css",
  "previews/still-form/assets/arches-luke-thornton.jpg",
  "previews/still-form/assets/lemons-missy-meyer.jpg",
  "previews/still-form/assets/color-paper-giorgio-trovato.jpg",
  "previews/still-form/assets/hands-hannah-busing.jpg",
  "previews/still-form/assets/dried-flowers-florencia-simonini.jpg",
  "previews/still-form/assets/coast-scott-taylor.jpg",
  "previews/aer-field/index.html",
  "previews/aer-field/work.html",
  "previews/aer-field/services.html",
  "previews/aer-field/studio.html",
  "previews/aer-field/contact.html",
  "previews/aer-field/films/golf.html",
  "previews/aer-field/films/real-estate.html",
  "previews/aer-field/films/business.html",
  "previews/aer-field/source.css",
  "previews/aer-field/preview.css",
  "previews/aer-field/site.js",
  "previews/aer-field/favicon.svg",
  "previews/aer-field/favicon-32.png",
  "previews/aer-field/assets/hero-poster.jpg",
  "previews/aer-field/assets/hero-mobile-poster.jpg",
  "previews/aer-field/assets/golf-poster.jpg",
  "previews/aer-field/assets/house-pool-poster.jpg",
  "previews/aer-field/assets/construction-poster.jpg",
  "previews/aer-field/assets/takeoff-greenery.mp4",
  "previews/aer-field/assets/takeoff-grass-portrait.mp4",
  "previews/aer-field/assets/golf.mp4",
  "previews/aer-field/assets/house-pool.mp4",
  "previews/aer-field/assets/construction.mp4",
  "previews/aer-field/assets/golf-gallery-1.jpg",
  "previews/aer-field/assets/golf-gallery-2.jpg",
  "previews/aer-field/assets/house-gallery-1.jpg",
  "previews/aer-field/assets/house-gallery-2.jpg",
  "previews/aer-field/assets/business-gallery-1.jpg",
  "previews/aer-field/assets/business-gallery-2.jpg",
  "previews/northside/index.html",
  "previews/northside/favicon.svg",
  "previews/northside/favicon-32.png",
  "previews/northside/services/index.html",
  "previews/northside/services/boiler-care/index.html",
  "previews/northside/about/index.html",
  "previews/northside/contact/index.html",
  "previews/northside/preview.css",
  "previews/northside/site.js",
  "previews/northside/inquiry.css",
  "previews/northside/navigation.css",
  "previews/northside/navigation.js",
  "assets/work/uaid-usa-home.png",
  "assets/work/northside-cover.svg",
  "assets/work/northside-home-cover.png",
  "assets/work/northside-home-cover-640.webp",
  "assets/work/northside-home-cover-1280.webp",
  "assets/work/northside-home-cover-2200.webp",
  "assets/work/northside-boiler-room.png",
  "assets/work/northside-dashboard-demo.png",
]);

const repositoryRoot = await realpath(
  path.resolve(fileURLToPath(new URL("..", import.meta.url))),
);
const artifactRoot = path.resolve(repositoryRoot, "dist");
// Keep the original .html pages reachable while publishing directory-index
// copies for the visitor-facing, extensionless routes.
const cleanRouteCopies = new Map(
  publicFiles
    .filter(
      (relativePath) =>
        relativePath.endsWith(".html") && !relativePath.endsWith("index.html"),
    )
    .map((relativePath) => [
      relativePath,
      relativePath.replace(/\.html$/, "/index.html"),
    ]),
);
const outputFiles = [...publicFiles, ...cleanRouteCopies.values()];

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

  for (const relativePath of outputFiles) {
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

if (new Set(outputFiles).size !== outputFiles.length) {
  throw new Error("The public file allowlist contains a duplicate path.");
}

const expectedFiles = new Set(outputFiles);
const expectedDirectories = getExpectedDirectories();
const sourcePaths = new Map();

for (const relativePath of publicFiles) {
  resolveContainedPath(repositoryRoot, relativePath);
  sourcePaths.set(relativePath, await validateSourceFile(relativePath));
}

await prepareArtifactRoot();

for (const relativePath of publicFiles) {
  await copyPublicFile(relativePath, sourcePaths.get(relativePath));
  if (cleanRouteCopies.has(relativePath)) {
    await copyPublicFile(
      cleanRouteCopies.get(relativePath),
      sourcePaths.get(relativePath),
    );
  }
}

const artifactFiles = (await walkArtifact(artifactRoot)).sort();
const sortedExpectedFiles = [...outputFiles].sort();

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
