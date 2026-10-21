import { readFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function checkReleaseHolds(root) {
  const holds = JSON.parse(
    await readFile(path.join(root, "config/release-holds.json"), "utf8"),
  );
  const hold = holds.homepageCarousel;
  if (hold.status !== "publication_hold")
    throw new Error(
      "The homepage release hold must only change after explicit owner review.",
    );
  const html = await readFile(path.join(root, "index.html"), "utf8");
  const section = html.match(
    /<section\s+id="next-step"[\s\S]*?<\/section>/,
  )?.[0];
  const hash = createHash("sha256")
    .update(section ?? "")
    .digest("hex");
  if (
    !section ||
    hash !== hold.sha256 ||
    hold.forbiddenMarkup.some((token) => html.includes(token))
  ) {
    throw new Error(
      "Homepage carousel publication is on hold. Restore the published section; do not include the pending carousel without explicit owner approval.",
    );
  }
  for (const source of hold.forbiddenSources) {
    let exists = true;
    try {
      await access(path.join(root, source));
    } catch (error) {
      if (error.code === "ENOENT") exists = false;
      else throw error;
    }
    if (exists)
      throw new Error(
        `Held carousel asset cannot enter this release checkout: ${source}`,
      );
  }
  console.log(
    "Verified publication hold: original homepage section retained; pending carousel assets absent.",
  );
}

const root = fileURLToPath(new URL("../", import.meta.url));
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await checkReleaseHolds(root);
