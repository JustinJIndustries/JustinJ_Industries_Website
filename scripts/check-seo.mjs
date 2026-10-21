import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { campaignUrl } from "./campaign-url.mjs";
import { checkReleaseHolds } from "./check-release-holds.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const routes = JSON.parse(
  await readFile(path.join(root, "config/seo-routes.json"), "utf8"),
);
const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const sitemapUrls = [
  ...sitemap.matchAll(/<loc[^>]*>\s*([^<]*)<\/loc\s*>/g),
].map((match) => match[1].trim());
const seen = new Set();
for (const entry of routes) {
  const source = await readFile(path.join(root, entry.file), "utf8");
  const head = source.split("</head>")[0];
  assert.equal([...head.matchAll(/<title>/g)].length, 1, entry.file);
  const title = head.match(/<title>([\s\S]*?)<\/title>/)[1];
  assert(!seen.has(title), `Duplicate title: ${entry.file}`);
  seen.add(title);
  for (const field of [
    "description",
    "robots",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
    "twitter:image:alt",
  ])
    assert(head.includes(`name="${field}"`), `${entry.file}: ${field}`);
  for (const field of [
    "title",
    "description",
    "type",
    "url",
    "site_name",
    "image",
    "image:width",
    "image:height",
    "image:alt",
  ])
    assert(
      head.includes(`property="og:${field}"`),
      `${entry.file}: og:${field}`,
    );
  if (entry.noindex) {
    assert(head.includes('content="noindex, follow"'));
    assert(!head.includes('rel="canonical"'));
    assert(
      !sitemapUrls.includes(`https://www.justinjindustries.com${entry.route}`),
    );
  } else {
    assert(
      head.includes(`href="https://www.justinjindustries.com${entry.route}"`),
      entry.file,
    );
    assert(
      sitemapUrls.includes(`https://www.justinjindustries.com${entry.route}`),
      entry.file,
    );
    const schema = JSON.parse(
      head.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )[1],
    );
    assert.equal(schema["@context"], "https://schema.org");
    assert(schema["@graph"].some((item) => item["@type"] === "WebPage"));
    if (entry.service)
      assert(schema["@graph"].some((item) => item["@type"] === "Service"));
    if (entry.concept)
      assert(schema["@graph"].some((item) => item["@type"] === "CreativeWork"));
  }
}
assert(
  sitemapUrls.every((url) => !url.includes("/previews/") && !url.includes("?")),
);
assert.equal(
  sitemapUrls.length,
  routes.filter((entry) => !entry.noindex).length,
);
const png = await readFile(path.join(root, "assets/jji-social.png"));
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);
const plan = JSON.parse(
  await readFile(path.join(root, "config/measurement-plan.json"), "utf8"),
);
assert.equal(plan.runtimeCollectionAdded, false);
assert.equal(plan.status, "inactive_planning_only");
for (const file of ["index.html", "script.js", "design.js"]) {
  const source = await readFile(path.join(root, file), "utf8");
  assert(
    !/googletagmanager\.com|google-analytics\.com|gtag\s*\(|dataLayer\s*\.\s*push|fbq\s*\(/i.test(
      source,
    ),
    `${file}: unexpected analytics activation`,
  );
}
assert(
  campaignUrl({
    service: "analytics-tagging",
    campaign: "jji-analytics-qa-boston-review",
  }).startsWith(
    "https://www.justinjindustries.com/services/analytics-tagging/?utm_source=google&utm_medium=cpc&",
  ),
);
for (const data of [
  { service: "https://example.org", campaign: "test" },
  { service: "cms-support", campaign: "name@example.org" },
  { service: "cms-support", campaign: "phone-6178009291" },
  { service: "cms-support", campaign: "valid", content: "<script>" },
])
  assert.throws(() => campaignUrl(data));
await access(path.join(root, "404.html"));
// Owner-selected process labels are shared across Home and Services.
const processLabels = [
  "Define the need",
  "Build and Validate",
  "Document and Handoff",
];
for (const [file, selector] of [
  ["index.html", /<ol class="home-method__steps">([\s\S]*?)<\/ol>/],
  [
    "partials/services-hub-content.html",
    /id="service-process-title"[\s\S]*?<ol>([\s\S]*?)<\/ol>/,
  ],
  ["services.html", /id="service-process-title"[\s\S]*?<ol>([\s\S]*?)<\/ol>/],
]) {
  const source = await readFile(path.join(root, file), "utf8");
  const section = source.match(selector);
  assert(section, `${file}: shared process section missing`);
  assert.deepEqual(
    [...section[1].matchAll(/<h3>(.*?)<\/h3>/g)].map((match) => match[1]),
    processLabels,
    `${file}: preserve owner-selected process labels`,
  );
}
await checkReleaseHolds(root);
console.log(
  `Verified metadata/schema for ${routes.length} routes, sitemap exclusions, social card size, inactive measurement plan and campaign URL validation.`,
);
