import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
async function check(t, text) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-copy-leak-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "scripts"));
  await mkdir(path.join(root, "dist"));
  await writeFile(
    path.join(root, "scripts/check-public-content.mjs"),
    await readFile(
      new URL("../scripts/check-public-content.mjs", import.meta.url),
    ),
  );
  await writeFile(
    path.join(root, "dist/index.html"),
    "<html><body>" + text + "</body></html>",
  );
  return () =>
    execFileSync(
      process.execPath,
      [path.join(root, "scripts/check-public-content.mjs")],
      { stdio: "pipe" },
    );
}
test("rejects the leaked review sentence including HTML wrapping and capitalization", async (t) => {
  for (const text of [
    "The homepage image shows a local icon-alignment preview.",
    "The homepage image shows a <span>local icon-alignment</span>\n preview.",
    "LOCAL ICON ALIGNMENT PREVIEW",
  ])
    assert.throws(await check(t, text), /Command failed/);
});
test("rejects source-installation instructions accidentally copied into demo form copy", async (t) => {
  for (const text of [
    "The source demo saves enquiries only inside its local WordPress installation.",
    "The source WordPress form stores a submission only in its local installation.",
    "Fields marked * are required in the source demonstration.",
  ])
    assert.throws(await check(t, text), /Command failed/);
});
test("retains useful preview, demo, form and consent explanations", async (t) => {
  const run = await check(
    t,
    "Page preview. Preview changes before they go live. This illustrative form does not send or store information. The project owner approves the consent policy.",
  );
  assert.match(run().toString(), /Checked 1 public text/);
});

test("rejects the retired dashboard notice without banning the footer policy link", async (t) => {
  assert.throws(
    await check(
      t,
      "Loading or opening the report connects to Google. Read the privacy details.",
    ),
    /Command failed/,
  );
  assert.throws(
    await check(
      t,
      "Loading or opening <span>the report</span> connects to Google.",
    ),
    /Command failed/,
  );
  assert.match(
    (
      await check(
        t,
        '<a href="/policies/#privacy">Privacy &amp; measurement</a>',
      )
    )().toString(),
    /Checked 1 public text/,
  );
});
