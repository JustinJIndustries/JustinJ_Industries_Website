import test from "node:test";
import assert from "node:assert/strict";
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
    "14a00877225868071370261c22ef0fb2401e7703d8d1a6d5660e4b74c76b39ff",
  );
  const dir = await mkdtemp(path.join(os.tmpdir(), "jji-chart-hold-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, "config"));
  await writeFile(
    path.join(dir, "config/release-holds.json"),
    JSON.stringify(hold),
  );
  const set = (s) => writeFile(path.join(dir, "index.html"), s);
  await set(html);
  await checkReleaseHolds(dir);
  await set(
    html.replace("Website leads · 24-month trend", "Unapproved chart label"),
  );
  await assert.rejects(checkReleaseHolds(dir), /publication is on hold/);
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
