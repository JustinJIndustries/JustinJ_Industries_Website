import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const origin = process.env.SITE_ORIGIN || "http://127.0.0.1:8080";
const routes = [
  "/",
  "/work/",
  "/about/",
  "/government-buyers/",
  "/catalogue/",
  "/design/?design=aer",
];
const destinations = {
  Home: "/",
  Services: "/#services",
  Work: "/work/",
  Designs: "/catalogue/",
  About: "/about/",
  "Government Buyers": "/government-buyers/",
  "Let's Talk": "/#contact",
};
const currentPage = (route) =>
  route === "/"
    ? "Home"
    : route === "/work/"
      ? "Work"
      : route === "/about/"
        ? "About"
      : route === "/government-buyers/"
        ? "Government Buyers"
        : "Designs";
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.emulateMediaFeatures([
  { name: "prefers-reduced-motion", value: "reduce" },
]);
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
page.on("response", (response) => {
  if (response.url().startsWith(origin) && response.status() >= 400) {
    failures.push(`${response.status()} ${response.url()}`);
  }
});

let clicks = 0;
for (const mobile of [false, true]) {
  await page.setViewport({
    width: mobile ? 390 : 1440,
    height: mobile ? 844 : 900,
  });
  for (const route of routes) {
    await page.goto(`${origin}${route}`, { waitUntil: "networkidle0" });
    const menu = mobile ? ".overlay-menu" : ".nav-links";
    const links = await page.$$eval(`${menu} a`, (elements) =>
      elements.map((el) => ({
        label: el.textContent.trim(),
        href: el.getAttribute("href"),
        current: el.getAttribute("aria-current"),
      })),
    );
    assert.deepEqual(
      links.map(({ label }) => label),
      Object.keys(destinations),
      `${route} has inconsistent ${mobile ? "mobile" : "desktop"} navigation`,
    );
    assert.deepEqual(
      links.filter(({ current }) => current).map(({ label }) => label),
      [currentPage(route)],
    );

    for (const { label, href } of links) {
      const expected = destinations[label];
      assert.ok(expected, `Unknown ${label} link on ${route}`);
      assert.equal(
        new URL(href, origin).pathname + new URL(href, origin).hash,
        expected,
      );
      await page.goto(`${origin}${route}`, { waitUntil: "networkidle0" });
      if (mobile) await page.click("#menu-toggle");
      const selector = `${menu} a[href="${href}"]`;
      await page.click(selector);
      await page.waitForFunction(
        (target) => location.pathname + location.hash === target,
        {},
        expected,
      );
      const url = new URL(page.url());
      assert.equal(
        url.origin,
        origin,
        `${route} ${label} escaped preview origin`,
      );
      await page.waitForFunction(
        (activeLabel) => {
          const links = [
            ...document.querySelectorAll(".nav-links a[aria-current]"),
          ];
          return (
            links.length === 1 && links[0].textContent.trim() === activeLabel
          );
        },
        {},
        label,
      );
      if (expected === "/work/") {
        assert.doesNotMatch(
          await page.$eval("main", (el) => el.textContent),
          /metro credit union/i,
        );
      }
      if (expected.includes("#")) {
        const hash = expected.slice(expected.indexOf("#") + 1);
        await page.waitForFunction(
          (id) => {
            const target = document.getElementById(id);
            return target && target.getBoundingClientRect().top < innerHeight;
          },
          {},
          hash,
        );
        assert.ok(
          await page.$eval(
            `#${hash}`,
            (el) => el.getBoundingClientRect().bottom > 0,
          ),
          `${route} ${label} section is above viewport`,
        );
      }
      if (mobile) {
        assert.equal(
          await page.$eval("#menu-toggle", (el) =>
            el.getAttribute("aria-expanded"),
          ),
          "false",
        );
      }
      clicks++;
    }

    await page.goto(`${origin}${route}`, { waitUntil: "networkidle0" });
    await page.click(".nav .brand");
    assert.equal(
      new URL(page.url()).pathname,
      "/",
      `${route} logo should go home`,
    );
    clicks++;
  }
}

await page.setViewport({ width: 1440, height: 900 });
await page.goto(origin, { waitUntil: "networkidle0" });
assert.equal(
  await page.$('.nav-links a[aria-current="location"]'),
  null,
  "No section should be active at the hero",
);
assert.equal(
  await page.$eval('.nav-links a[href="/"]', (el) =>
    el.getAttribute("aria-current"),
  ),
  "page",
);
await page.$eval("#work", (el) => el.scrollIntoView());
await page.waitForFunction(
  () => !document.querySelector(".nav-links a[aria-current]"),
);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForFunction(() =>
  document.querySelector('.nav-links a[href="/"][aria-current="page"]'),
);
await page.click('.nav-links a[href="#services"]');
assert.equal(
  await page.$eval('.nav-links a[href="#services"]', (el) =>
    el.getAttribute("aria-current"),
  ),
  "location",
);
await page.goBack({ waitUntil: "networkidle0" });
assert.equal(new URL(page.url()).hash, "", "Back should return to home hero");
await page.waitForFunction(
  () => !document.querySelector('.nav-links a[aria-current="location"]'),
);
assert.equal(
  await page.$eval('.nav-links a[href="/"]', (el) =>
    el.getAttribute("aria-current"),
  ),
  "page",
);
await page.goForward({ waitUntil: "networkidle0" });
assert.equal(
  new URL(page.url()).hash,
  "#services",
  "Forward should restore Services",
);
await page.waitForFunction(() =>
  document.querySelector(
    '.nav-links a[href="#services"][aria-current="location"]',
  ),
);
await page.goto(`${origin}/work.html`, { waitUntil: "networkidle0" });
assert.doesNotMatch(
  await page.$eval("main", (el) => el.textContent),
  /metro credit union/i,
);
assert.deepEqual(failures, []);
await browser.close();
console.log(
  `Navigation audit passed: ${clicks} desktop/mobile logo and nav clicks across ${routes.length} pages, Services active state, history, legacy Work, local origin, and no Metro.`,
);
