import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const origin = process.env.SITE_ORIGIN || "http://127.0.0.1:8080";
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
try {
  for (const [width, height] of [
    [430, 220],
    [320, 256],
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewport({ width, height });
    await page.goto(`${origin}/design/?design=northside`, {
      waitUntil: "networkidle2",
    });
    await page.click("#enquiry-open");
    assert.ok(await page.$eval("#enquiry-form", (e) => e.clientHeight > 0));
    for (const selector of [
      "#enquiry-close",
      '[name="goals"]',
      "#enquiry-next",
    ]) {
      await page.focus(selector);
      const visible = await page.$eval(selector, (e) => {
        const r = e.getBoundingClientRect();
        const d = e.closest("dialog").getBoundingClientRect();
        return (
          Math.min(r.bottom, d.bottom, innerHeight) - Math.max(r.top, d.top, 0)
        );
      });
      assert.ok(visible > 20, `${width}×${height}: ${selector} visible`);
    }
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "enquiry-open",
    );
  }

  await page.setViewport({ width: 390, height: 900 });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await page.goto(`${origin}/previews/aer-field/work/`, {
    waitUntil: "networkidle2",
  });
  await page.focus("[data-reel-motion]");
  await page.keyboard.press("Space");
  assert.equal(
    await page.$eval("[data-reel-motion]", (e) => e.textContent.trim()),
    "Play film previews",
  );
  await page.$eval(".film-video", (e) => e.scrollIntoView({ block: "center" }));
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(
    await page.$$eval(".film-video", (videos) => videos.every((v) => v.paused)),
  );
  await page.focus("[data-reel-motion]");
  await page.keyboard.press("Space");
  await page.$eval(".film-video", (e) => e.scrollIntoView({ block: "center" }));
  await page.waitForFunction(() => {
    const video = document.querySelector(".film-video");
    return !video.paused && video.classList.contains("is-playing");
  });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.bringToFront();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-reel-motion]").hidden &&
      [...document.querySelectorAll(".film-video")].every((v) => v.paused),
  );
  assert.ok(await page.$eval("[data-reel-motion]", (e) => e.hidden));

  for (const film of ["golf", "real-estate", "business"]) {
    await page.goto(`${origin}/previews/aer-field/films/${film}/`, {
      waitUntil: "networkidle2",
    });
    assert.equal(
      await page.$eval(".detail-media video", (e) =>
        e.getAttribute("aria-describedby"),
      ),
      "film-description",
    );
    await page.focus("#film-description summary");
    await page.keyboard.press("Enter");
    assert.ok(await page.$eval("#film-description", (e) => e.open));
    assert.match(
      await page.$eval("#film-description p", (e) =>
        e.textContent.replace(/\s+/g, " "),
      ),
      /no speech or other audible information/,
    );
  }
  console.log(
    "Accessibility follow-up passed: short-screen dialog controls, Escape/focus return, keyboard reel pause/resume, reduced-motion response, and three silent-film alternatives.",
  );
} finally {
  await browser.close();
}
