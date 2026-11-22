// Run after building dist. All HTTP requests are intercepted, including Formspree.
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import puppeteer from "puppeteer";

const origin = "https://fixture.invalid";
const endpoint = "https://formspree.io/f/mgvlrzdq";
const root = path.resolve("dist");
const browser = await puppeteer.launch({
  headless: true,
  args: [
    "--disable-background-networking",
    "--proxy-server=127.0.0.1:9",
    "--host-resolver-rules=MAP * ~NOTFOUND",
  ],
});
const routes = [
  "?design=alder",
  "alder-lane/",
  "harbor-ledger/",
  "still-form/",
  "aer-field/",
  "northside/",
];
try {
  const browserVersion = await browser.version();
  if (process.argv.includes("--require-pinned-browser")) {
    assert.equal(browserVersion, `Chrome/${puppeteer.defaultBrowserRevision}`);
  }
  console.log("Inquiry test browser:", browserVersion);
  for (const route of routes) {
    const page = await browser.newPage();
    let posts = 0,
      mode = "fail",
      release;
    const unexpected = [];
    await page.setRequestInterception(true);
    page.on("request", async (req) => {
      const url = new URL(req.url());
      if (url.protocol === "data:") return req.continue();
      if (req.url() === endpoint && req.method() === "POST") {
        posts++;
        if (mode === "fail") return req.abort();
        if (mode === "hold")
          await new Promise((resolve) => {
            release = resolve;
          });
        return req.respond({
          status: 200,
          contentType: "application/json",
          headers: { "access-control-allow-origin": origin },
          body: '{"ok":true}',
        });
      }
      const staticQuery = [...url.searchParams].every(
        ([key, value]) =>
          (key === "v" && /^[a-zA-Z0-9._-]+$/.test(value)) ||
          (key === "design" &&
            value === "alder" &&
            url.pathname === "/design/"),
      );
      if (
        url.origin !== origin ||
        req.method() !== "GET" ||
        !staticQuery ||
        url.pathname.startsWith("/cdn-cgi/") ||
        /Fixture|fixture@|example\.invalid/i.test(
          decodeURIComponent(url.pathname + url.search),
        )
      ) {
        unexpected.push([url.hostname, req.method()]);
        return req.abort();
      }
      const file = path.resolve(
        root,
        "." + url.pathname + (url.pathname.endsWith("/") ? "index.html" : ""),
      );
      assert(file.startsWith(root + path.sep));
      let body;
      try {
        body = await readFile(file);
      } catch {
        unexpected.push(["unrecognized fixture path", req.method()]);
        return req.respond({ status: 404 });
      }
      const types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      return req.respond({
        contentType: types[path.extname(file)] || "application/octet-stream",
        body,
      });
    });
    // Verify FormData while intercepting the actual request in a separate layer.
    await page.evaluateOnNewDocument(() => {
      const send = window.fetch;
      window.fixturePayloads = [];
      window.fetch = function (url, init) {
        if (init?.body instanceof FormData)
          window.fixturePayloads.push(Object.fromEntries(init.body));
        return send.call(this, url, init);
      };
    });
    await page.goto(origin + "/design/" + route);
    assert.equal(
      await page.$eval(
        '[name="data_consent"]',
        (box) => box.defaultChecked || box.checked,
      ),
      false,
      "Inquiry processing consent must start unchecked",
    );
    const run = (fn, ...args) => page.evaluate(fn, ...args);
    const step = () =>
      run(() =>
        Number(
          document.querySelector(".enquiry-step:not([hidden])").dataset.step,
        ),
      );
    const send = () =>
      run(() => document.querySelector("#enquiry-form").requestSubmit());
    const click = (id) => page.click("#enquiry-" + id);
    const set = (name, value) =>
      run(
        (n, v) => {
          document.querySelector("#enquiry-form").elements[n].value = v;
        },
        name,
        value,
      );
    await click("open");
    await send();
    assert.equal(await step(), 0);
    assert.equal(await run(() => document.activeElement.name), "goals");
    assert.equal(
      await run(() => document.activeElement.getAttribute("aria-invalid")),
      "true",
    );
    await set("goals", "Fixture project");
    await send();
    assert.equal(await step(), 1);
    await send();
    assert.equal(await step(), 1);
    await page.click('[name="content_readiness"]');
    await run(() => {
      for (const n of ["hosting_readiness", "domain_readiness"])
        document.querySelector("#enquiry-form").elements[n].selectedIndex = 1;
    });
    await click("next");
    assert.equal(await step(), 2);
    await send();
    await page.click('[name="timing"][value="Desired date"]');
    await click("next");
    assert.equal(await step(), 2);
    await page.click('[name="timing"][value="Flexible"]');
    await set("first_name", "Fixture");
    await set("email", "fixture@example.invalid");
    await page.focus('[name="email"]');
    await page.keyboard.press("Enter");
    assert.equal(await step(), 3);
    assert.equal(
      await run(() => document.activeElement.id),
      "step-review-title",
    );
    await send();
    assert.equal(await run(() => document.activeElement.name), "data_consent");
    assert.match(
      await run(() => document.activeElement.getAttribute("aria-describedby")),
      /enquiry-error/,
    );
    await page.click('[name="data_consent"]');
    await page.click('[name="data_consent"]');
    await run(() =>
      document
        .querySelector("#enquiry-form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(await step(), 3);
    await page.click('[name="data_consent"]');
    await set("goals", "");
    await send();
    assert.equal(await step(), 0);
    assert.equal(await run(() => document.activeElement.name), "goals");
    assert.equal(
      await run(() => document.querySelector('[name="data_consent"]').checked),
      false,
    );
    await set("goals", "Fixture project");
    await click("next");
    await click("next");
    await click("next");
    await page.click('[name="data_consent"]');
    await click("back");
    assert.equal(await step(), 2);
    await click("next");
    assert.equal(
      await run(() => document.querySelector('[name="data_consent"]').checked),
      false,
    );
    assert.equal(posts, 0);
    assert.equal(await run(() => window.fixturePayloads.length), 0);
    await page.click('[name="data_consent"]');
    await click("submit");
    await page.waitForFunction(() =>
      document.querySelector("#enquiry-error").textContent.includes("retry"),
    );
    assert.equal(posts, 1);
    assert.equal(
      await run(() => document.querySelector('[name="goals"]').value),
      "Fixture project",
    );
    mode = "hold";
    await run(() => {
      const f = document.querySelector("#enquiry-form");
      f.requestSubmit();
      f.requestSubmit();
      document.querySelector("#enquiry-submit").click();
    });
    await page.waitForFunction(
      () => document.querySelector("#enquiry-submit").disabled,
    );
    const deadline = Date.now() + 4000;
    while (!release && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(typeof release, "function");
    release();
    await page.waitForSelector(".enquiry-success");
    await send();
    assert.equal(posts, 2);
    const payloads = await run(() => window.fixturePayloads);
    assert.equal(payloads.length, 2);
    assert(
      payloads.every(
        (p) =>
          p.data_consent === "on" &&
          p.email === "fixture@example.invalid" &&
          p.goals === "Fixture project",
      ),
    );
    assert.equal(
      await run(() => document.activeElement.getAttribute("role")),
      "status",
    );
    await click("close");
    await click("open");
    assert.equal(await step(), 0);
    assert.equal(
      await run(() => document.querySelector('[name="goals"]').value),
      "",
    );
    await run(() =>
      HTMLFormElement.prototype.submit.call(
        document.querySelector("#enquiry-form"),
      ),
    );
    await page.waitForFunction(
      () => !document.querySelector("#enquiry-dialog").open,
    );
    assert.equal(posts, 2);
    assert.deepEqual(unexpected, []);
    console.log(
      "PASS",
      route,
      "premature and invalid requests=0, failed mock=1, concurrent retry accepted=1, native dialog requests=0, external analytics requests=0",
    );
    await page.close();
  }
} finally {
  await browser.close();
}
