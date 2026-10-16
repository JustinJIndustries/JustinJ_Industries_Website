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
  });
  const response = await page.goto(`${origin}${path}`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(response.status(), 200, path);
}
async function checkVideo(context, selector, button) {
  if (button) {
    const v = await context.$eval(selector, (element) => ({
      paused: element.paused,
      currentTime: element.currentTime,
    }));
    if (v.paused) await context.click(button);
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
const results = {};
await visit("/previews/aer-field/");
results.homeDesktop = await checkVideo(
  page,
  ".hero-video",
  "[data-video-toggle]",
);
await visit("/previews/aer-field/", 390);
results.homeMobile = await checkVideo(
  page,
  ".hero-video",
  "[data-video-toggle]",
);
assert.equal(results.homeMobile.source, "takeoff-grass-portrait.mp4");
await visit("/previews/aer-field/services/");
results.servicesDesktop = await checkVideo(
  page,
  ".services-video",
  "[data-services-video-toggle]",
);
await visit("/previews/aer-field/services/", 390);
results.servicesMobile = await checkVideo(
  page,
  ".services-video",
  "[data-services-video-toggle]",
);
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
await visit("/design/?design=aer");
let frame = await page.waitForFrame((f) =>
  f.url().endsWith("/previews/aer-field/"),
);
assert.ok(frame, "AER iframe");
results.embeddedHome = await checkVideo(
  frame,
  ".hero-video",
  "[data-video-toggle]",
);
await visit("/design/?design=aer", 390);
frame = await page.waitForFrame((f) =>
  f.url().endsWith("/previews/aer-field/"),
);
results.embeddedHomeMobile = await checkVideo(
  frame,
  ".hero-video",
  "[data-video-toggle]",
);
assert.equal(results.embeddedHomeMobile.source, "takeoff-grass-portrait.mp4");
await page.click('[role="tab"]:nth-child(2)');
await page.waitForSelector('iframe[src="/previews/aer-field/work/"]');
frame = await page.waitForFrame((f) =>
  f.url().endsWith("/previews/aer-field/work/"),
);
assert.ok(frame, "AER Work iframe");
assert.ok(await frame.$('a[href="/previews/aer-field/films/golf/"]'));
await visit("/design/?design=still");
await page.click('[role="tab"]:nth-child(2)');
await page.waitForSelector('iframe[src="/previews/still-form/work/"]');
assert.deepEqual(failures, []);
await browser.close();
console.log(JSON.stringify(results, null, 2));
