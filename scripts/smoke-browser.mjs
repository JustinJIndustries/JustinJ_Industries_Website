import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const origin = process.env.SITE_ORIGIN || "http://127.0.0.1:8080";
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

async function visit(route) {
  const response = await page.goto(`${origin}${route}`, {
    waitUntil: "networkidle0",
  });
  assert.equal(response.status(), 200, route);
  return page;
}

await page.setViewport({ width: 1440, height: 900 });
await visit("/");
assert.match(await page.title(), /JustinJ Industries/);
await page.screenshot({ path: "/tmp/jji-home-desktop.png", fullPage: false });
assert.equal(await page.$("#about"), null);
assert.equal(await page.$("#government-buyers"), null);
assert.ok(await page.$('a[href="/government-buyers/"]'));
assert.ok(await page.$('a[href="/capability-statement/"]'));
assert.ok(await page.$('#contact form[action^="https://formspree.io/"]'));
await visit("/about/");
assert.match(await page.title(), /About \| JustinJ Industries/);
for (const id of ["about", "accessibility", "privacy"]) assert.ok(await page.$(`#${id}`));
for (const destination of ["/#contact", "/work/"]) {
  assert.ok(await page.$(`.about-hero__copy a[href="${destination}"]`));
}
assert.equal(await page.$eval('link[rel="canonical"]', el => el.href), "https://www.justinjindustries.com/about/");
await page.screenshot({ path: "/tmp/jji-about-desktop.png", fullPage: false });
await visit("/#privacy");
assert.equal(new URL(page.url()).pathname + new URL(page.url()).hash, "/about/#privacy");
await visit("/?ref=legacy#about");
assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, "/about/?ref=legacy");
await page.click('a[href="/work/"]');
assert.equal(new URL(page.url()).pathname, "/work/");
await visit("/catalogue/");
await page.click('a[href="/design/?design=aer"]');
assert.equal(new URL(page.url()).search, "?design=aer");
await page.waitForSelector('iframe[src="/previews/aer-field/"]');
await page.click('[role="tab"]:nth-child(2)');
await page.waitForSelector('iframe[src="/previews/aer-field/work/"]');
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((el) => el.textContent.includes("Request a site like this"))
    .click(),
);
assert.ok(
  await page.$(
    'input[name="service_kit"][value="AER/FIELD website setup"]:checked',
  ),
);
assert.ok(await page.$('form[action^="https://formspree.io/"]'));
await page.screenshot({ path: "/tmp/jji-design-desktop.png", fullPage: false });

await page.setViewport({
  width: 390,
  height: 844,
  isMobile: true,
  deviceScaleFactor: 1,
});
await visit("/");
await page.screenshot({ path: "/tmp/jji-home-mobile.png", fullPage: false });
await visit("/about/");
await page.screenshot({ path: "/tmp/jji-about-mobile.png", fullPage: false });
await visit("/");
const horizontalOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth + 1,
);
assert.equal(horizontalOverflow, false, "mobile horizontal overflow");
await page.click('button[aria-label="Open menu"]');
assert.equal(
  await page.$eval("#menu-toggle", (el) => el.getAttribute("aria-expanded")),
  "true",
);
await page.click('.overlay-menu a[href="/government-buyers/"]');
assert.equal(new URL(page.url()).pathname, "/government-buyers/");
await visit("/?inquiry_type=RFQ%2FRFP#contact");
const inquiry = await page.$eval(
  'select[name="inquiry_type"]',
  (el) => el.value,
);
assert.equal(inquiry, "RFQ/RFP");
await visit("/previews/aer-field/work/");
assert.equal((await page.$$("img")).length, 3);
await page.screenshot({
  path: "/tmp/jji-aer-work-mobile.png",
  fullPage: false,
});
await visit("/work.html");
assert.match(await page.title(), /Selected Work/);

// Exercise every published HTML route in a browser, including the four demo sites.
async function htmlFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith(".html")) result.push(full);
  }
  return result;
}
const artifactRoot = path.resolve("dist");
const cleanRoutes = new Set(
  (await htmlFiles(artifactRoot)).map((file) => {
    const relative = path
      .relative(artifactRoot, file)
      .split(path.sep)
      .join("/");
    return relative.endsWith("index.html")
      ? `/${relative.slice(0, -"index.html".length)}`
      : `/${relative.slice(0, -".html".length)}/`;
  }),
);
for (const route of cleanRoutes) await visit(route);
assert.deepEqual(failures, []);
await browser.close();
console.log(
  `Browser smoke passed: ${cleanRoutes.size} clean routes, desktop concept tabs/form UI, mobile navigation, query prefill, preview gallery, legacy URL. Screenshots: /tmp/jji-*.png`,
);
