import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkReleaseHolds } from "../scripts/check-release-holds.mjs";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const hold = JSON.parse(
  await readFile(
    new URL("../config/release-holds.json", import.meta.url),
    "utf8",
  ),
);
const rows = (
  await readFile(
    new URL("fixtures/northside-monthly-leads.csv", import.meta.url),
    "utf8",
  )
)
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((s) => s.split(","));
test("Home chart matches all24 exported monthly lead values while preserving twelve-month KPIs", () => {
  assert.equal(rows.length, 24);
  assert.equal(rows[0][0], "Oct 2024");
  assert.equal(rows.at(-1)[0], "Sep 2026");
  const points = html
    .match(
      /class="home-story__report-plot"[\s\S]*?<polyline\s+points="([^"]+)"/,
    )[1]
    .split(/\s+/)
    .map((p) => p.split(",").map(Number));
  assert.equal(points.length, 24);
  rows.forEach(([, value], i) => {
    assert.ok(Math.abs(points[i][0] - (4 + (i * 588) / 23)) < 0.006);
    assert.ok(
      Math.abs(points[i][1] - (4 + ((130 - Number(value)) * 186) / 25)) < 0.006,
    );
  });
  assert.equal(
    rows.slice(-12).reduce((s, r) => s + Number(r[1]), 0),
    1382,
  );
  assert.match(html, /Overview · Oct 2025–Sep 2026/);
  assert.match(html, /Website leads · 24-month trend/);
  assert.match(html, /ends at 112 in September 2026/);
});
test("approved chart guard still refuses other changes and held carousel content", async (t) => {
  assert.equal(hold.homepageCarousel.status, "publication_hold");
  assert.equal(
    hold.homepageCarousel.publicationBaselineSha256,
    "7a9a03ba02fd627b5631177731d7eda9d0ee06ab5cb4eaad231eb3cec2404d38",
  );
  const dir = await mkdtemp(path.join(os.tmpdir(), "jji-chart-hold-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, "config"));
  const setHold = (homepageCarousel) =>
    writeFile(
      path.join(dir, "config/release-holds.json"),
      JSON.stringify({ homepageCarousel }),
    );
  await setHold(hold.homepageCarousel);
  const set = (s) => writeFile(path.join(dir, "index.html"), s);
  await set(html);
  await checkReleaseHolds(dir);
  const review = html.replace(
    "Website leads · 24-month trend",
    "Local review fixture",
  );
  const reviewSection = review.match(
    /<section\s+id="next-step"[\s\S]*?<\/section>/,
  )[0];
  const reviewDigest = createHash("sha256").update(reviewSection).digest("hex");
  assert.notEqual(reviewDigest, hold.homepageCarousel.publicationBaselineSha256);
  await setHold({ ...hold.homepageCarousel, sha256: reviewDigest });
  await set(review);
  await assert.rejects(checkReleaseHolds(dir), /publication is on hold/);
  await set(html);
  await checkReleaseHolds(dir);
  await setHold({ ...hold.homepageCarousel, publicationBaselineSha256: undefined });
  await assert.rejects(checkReleaseHolds(dir), /publication is on hold/);
  await setHold(hold.homepageCarousel);
  await set(html + "home-journeys");
  await assert.rejects(checkReleaseHolds(dir), /publication is on hold/);
  await set(html);
  await mkdir(path.join(dir, "assets"));
  await writeFile(
    path.join(dir, hold.homepageCarousel.forbiddenSources[0]),
    "held",
  );
  await assert.rejects(checkReleaseHolds(dir), /Held carousel asset/);
});
