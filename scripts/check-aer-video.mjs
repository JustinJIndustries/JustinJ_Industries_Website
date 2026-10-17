import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const origin = "http://127.0.0.1:8080";
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
page.on("response", (response) => {
  if (
    response.url().startsWith(origin) &&
    !response.url().endsWith("/favicon.ico") &&
    response.status() >= 400
  ) {
    failures.push(`${response.status()} ${response.url()}`);
  }
});

async function visit(path, width = 1440) {
  await page.setViewport({
    width,
    height: width < 700 ? 844 : 900,
    isMobile: width < 700,
    deviceScaleFactor: width < 700 ? 3 : 1,
  });
  const response = await page.goto(`${origin}${path}`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(response.status(), 200, path);
}
async function checkVideo(context, selector, button) {
  await context.waitForFunction(
    (sel) => document.readyState === "complete" && document.querySelector(sel),
    { timeout: 20000 },
    selector,
  );
  if (button) {
    const v = await context.$eval(selector, (element) => ({
      paused: element.paused,
      currentTime: element.currentTime,
    }));
    if (v.paused) await context.click(button);
    else await context.$eval(selector, (video) => video.play());
  } else {
    await context.$eval(selector, (video) => video.play());
  }
  await context.waitForFunction(
    (sel) => {
      const video = document.querySelector(sel);
      return (
        video &&
        !video.paused &&
        video.currentTime > 0.35 &&
        video.videoWidth > 0
      );
    },
    { timeout: 20000 },
    selector,
  );
  return context.$eval(selector, (video) => ({
    time: Number(video.currentTime.toFixed(2)),
    width: video.videoWidth,
    source: video.currentSrc.split("/").pop(),
  }));
}
async function checkAutoplay(context, selector) {
  await context.waitForFunction(
    (sel) => {
      const video = document.querySelector(sel);
      return (
        video &&
        !video.paused &&
        video.currentTime > 0.35 &&
        video.videoWidth > 0
      );
    },
    { timeout: 20000 },
    selector,
  );
  return context.$eval(selector, (video) => ({
    time: Number(video.currentTime.toFixed(2)),
    width: video.videoWidth,
    source: video.currentSrc.split("/").pop(),
    muted: video.muted,
    inline: video.playsInline,
  }));
}
const results = {};
await visit("/previews/aer-field/");
results.homeDesktop = await checkAutoplay(page, ".hero-video");
await visit("/previews/aer-field/", 390);
results.homeMobile = await checkAutoplay(page, ".hero-video");
assert.equal(results.homeMobile.source, "takeoff-grass-portrait.mp4");
await visit("/previews/aer-field/services/");
results.servicesDesktop = await checkAutoplay(page, ".services-video");
await visit("/previews/aer-field/services/", 390);
results.servicesMobile = await checkAutoplay(page, ".services-video");
for (const film of ["golf", "real-estate", "business"]) {
  await visit(`/previews/aer-field/films/${film}/`);
  results[film] = await checkVideo(page, ".detail-media video");
  assert.equal(
    await page.$$(".detail-gallery img").then((els) => els.length),
    2,
  );
}
for (const film of ["golf", "real-estate", "business"]) {
  await visit(`/previews/aer-field/films/${film}/`, 390);
  results[`${film}Mobile`] = await checkVideo(page, ".detail-media video");
}
await visit("/previews/aer-field/work/");
for (const [index, film] of ["golf", "real-estate", "business"].entries()) {
  const selector = `.film-card:nth-child(${index + 1}) .film-video`;
  await page.$eval(selector, (video) =>
    video.scrollIntoView({ block: "center" }),
  );
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.currentTime > 0.35,
    { timeout: 20000 },
    selector,
  );
  results[`${film}Reel`] = await page.$eval(selector, (video) => ({
    time: Number(video.currentTime.toFixed(2)),
    source: video.currentSrc.split("/").pop(),
  }));
}
await visit("/previews/aer-field/work/", 390);
await page.$eval(".film-card:first-child .film-video", (video) =>
  video.scrollIntoView({ block: "center" }),
);
results.golfReelMobile = await checkAutoplay(
  page,
  ".film-card:first-child .film-video",
);
await visit("/design/?design=aer");
await page.$eval(".preview-stage", (el) =>
  el.scrollIntoView({ block: "center" }),
);
let frame = await page.waitForFrame((f) =>
  f.url().endsWith("/previews/aer-field/"),
);
assert.ok(frame, "AER iframe");
results.embeddedHome = await checkAutoplay(frame, ".hero-video");
await visit("/design/?design=aer", 390);
await page.$eval("#design-mobile-image", (image) => image.scrollIntoView());
await page.waitForFunction(
  () => document.querySelector("#design-mobile-image")?.complete,
);
assert.equal(
  await page.$$("#design-panel iframe").then((items) => items.length),
  0,
);
results.mobileCard = await page.$eval("#design-mobile-image", (image) => ({
  source: image.currentSrc.split("/").pop(),
  width: image.getBoundingClientRect().width,
}));
assert.equal(results.mobileCard.source, "aer-field-mobile@3x.webp");
assert.equal(
  await page.$eval("#design-mobile-link", (link) => link.getAttribute("href")),
  "/previews/aer-field/",
);
await page.emulateMediaFeatures([
  { name: "prefers-reduced-motion", value: "reduce" },
]);
await visit("/previews/aer-field/", 390);
assert.deepEqual(
  await page.$eval(".hero-video", (video) => ({
    paused: video.paused,
    source: video.currentSrc,
  })),
  { paused: true, source: "" },
);
results.reducedMotionManual = await checkVideo(
  page,
  ".hero-video",
  "[data-video-toggle]",
);
await page.emulateMediaFeatures([
  { name: "prefers-reduced-motion", value: "no-preference" },
]);
await visit("/design/?design=still");
await page.click('[role="tab"]:nth-child(2)');
await page.waitForSelector('iframe[src="/previews/still-form/work/"]');
assert.deepEqual(failures, []);
await browser.close();
console.log(JSON.stringify(results, null, 2));
