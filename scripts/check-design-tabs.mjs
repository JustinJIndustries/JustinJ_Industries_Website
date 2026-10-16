import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const origin = "http://127.0.0.1:8080";
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
let checked = 0;
for (const width of [1440, 390]) {
  await page.setViewport({ width, height: 900, isMobile: width === 390 });
  for (const [key, base, labels, navSelector] of [
    [
      "still",
      "still-form",
      ["Home", "Work", "Services", "About", "Contact"],
      ".site-nav",
    ],
    [
      "aer",
      "aer-field",
      ["Home", "Film", "Services", "About", "Contact"],
      ".primary-nav",
    ],
  ]) {
    await page.goto(`${origin}/design/?design=${key}`, {
      waitUntil: "domcontentloaded",
    });
    const price = key === "still" ? "$1,695" : "$1,995";
    const service = `${key === "still" ? "Still Form" : "AER/FIELD"} website setup`;
    assert.ok(
      (await page.$eval("#design-scope-copy", (el) => el.textContent)).includes(
        price,
      ),
    );
    assert.ok(
      await page.$(`input[name="service_kit"][value="${service}"]:checked`),
    );
    const tabs = await page.$$eval('[role="tab"]', (elements) =>
      elements.map((e) => e.textContent.trim()),
    );
    assert.deepEqual(tabs, labels, `${key} outer tab labels`);
    for (const [index, label] of labels.entries()) {
      await page.click(`[role="tab"]:nth-child(${index + 1})`);
      const slug =
        label === "Home"
          ? ""
          : key === "aer" && label === "Film"
            ? "work/"
            : key === "aer" && label === "About"
              ? "studio/"
              : `${label.toLowerCase()}/`;
      const route = `/previews/${base}/${slug}`;
      await page.waitForSelector(`iframe[src="${route}"]`);
      const frame = await page.waitForFrame(
        (f) => f.url() === `${origin}${route}`,
      );
      assert.ok(frame, `${key} ${label} frame`);
      const inner = await frame.$$eval(`${navSelector} a`, (links) =>
        links.map((a) => ({
          label: a.textContent.trim(),
          path: new URL(a.href).pathname,
        })),
      );
      assert.ok(
        inner.some((link) => link.label === label && link.path === route),
        `${key} ${label} inner nav`,
      );
      checked += 1;
    }
    if (key === "aer" && width === 390) {
      const frame = await page.waitForFrame(
        (f) => f.url() === `${origin}/previews/aer-field/contact/`,
      );
      await frame.click(".menu-toggle");
      assert.equal(
        await frame.$eval(".menu-toggle", (el) =>
          el.getAttribute("aria-expanded"),
        ),
        "true",
      );
    }
  }
}
await page.goto(`${origin}/previews/aer-field/films/golf/`);
assert.equal(
  await page.$eval('.primary-nav a[href="/previews/aer-field/work/"]', (el) =>
    el.textContent.trim(),
  ),
  "Film",
);
await page.goto(`${origin}/catalogue/`);
for (const [id, amount] of [
  ["still-form-card", "$1,695"],
  ["aer-field-card", "$1,995"],
]) {
  assert.ok(
    (await page.$eval(`#${id}`, (el) => el.textContent)).includes(amount),
  );
}
await browser.close();
console.log(
  `Design tab audit passed: ${checked} desktop/mobile outer tabs match demo navigation and routes; AER mobile menu, film detail Film link, and setup prices verified.`,
);
