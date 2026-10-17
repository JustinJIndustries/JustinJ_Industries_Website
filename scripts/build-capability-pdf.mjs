import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer");
const output = "assets/justinj-industries-capability-statement.pdf";
const sources = [
  "capability-statement.html",
  "assets/logos/JJI-Logo-Only-white.png",
  "assets/site-footer.css",
];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const allowed = new Map([
  [
    "/capability-statement/",
    ["capability-statement.html", "text/html; charset=utf-8"],
  ],
  [
    "/assets/logos/JJI-Logo-Only-white.png",
    ["assets/logos/JJI-Logo-Only-white.png", "image/png"],
  ],
  [
    "/assets/logos/JJI-Logo-Only-grey.png",
    ["assets/logos/JJI-Logo-Only-grey.png", "image/png"],
  ],
  [
    "/assets/site-footer.css",
    ["assets/site-footer.css", "text/css; charset=utf-8"],
  ],
]);
const server = createServer(async (req, res) => {
  const entry = allowed.get(new URL(req.url, "http://localhost").pathname);
  if (!entry) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    res.setHeader("Content-Type", entry[1]);
    res.end(await readFile(path.join(root, entry[0])));
  } catch {
    res.writeHead(500);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 816, height: 1056 });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (
      request.url().startsWith(origin + "/") ||
      request.url().startsWith("data:")
    )
      request.continue();
    else request.abort();
  });
  await page.goto(origin + "/capability-statement/", {
    waitUntil: "networkidle0",
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  await page.emulateMediaType("print");
  const bytes = Buffer.from(
    await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      tagged: true,
      outline: true,
      displayHeaderFooter: false,
    }),
  );
  const raw = bytes.toString("latin1");
  const pages = (raw.match(/\/Type\s*\/Page\b/g) || []).length;
  if (pages !== 1) {
    await writeFile("/tmp/jji-capability-overflow.pdf", bytes);
    throw new Error(
      `Expected one PDF page, found ${pages}. Draft saved to /tmp/jji-capability-overflow.pdf; shorten content or fix print layout.`,
    );
  }
  if (
    !raw.includes("/StructTreeRoot") ||
    !/\/Marked\s+true/.test(raw) ||
    !/\/Lang\s*\(en-US\)/.test(raw)
  )
    throw new Error("PDF language or tagged structure is missing.");
  await writeFile(path.join(root, output), bytes);
  const sourceHashes = {};
  for (const source of sources)
    sourceHashes[source] = digest(await readFile(path.join(root, source)));
  await writeFile(
    path.join(root, "docs/capability-statement-pdf-build.json"),
    JSON.stringify(
      {
        revision: "2026-10-17",
        output,
        sha256: digest(bytes),
        pages,
        sources: sourceHashes,
        renderer: "Puppeteer/Chromium; Letter; tagged:true; outline:true",
        accessibility:
          "Title, en-US language, marked structure and links present. Not a PDF/UA certification.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Built ${output}: ${pages} Letter page, ${bytes.length} bytes; tagged structure and en-US language present.`,
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
