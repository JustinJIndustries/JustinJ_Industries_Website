import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import { servicePageContent } from "./service-page-content.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const check = process.argv.includes("--check");
const origin = "https://www.justinjindustries.com";
const image = `${origin}/assets/jji-social.png`;
const services = JSON.parse(
  await readFile(path.join(root, "config/service-pages.json"), "utf8"),
);
const pending = [];
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const read = (file) => readFile(path.join(root, file), "utf8");
const scriptVersion = createHash("sha256")
  .update(await read("script.js"))
  .digest("hex")
  .slice(0, 10);
async function save(file, source, parser = "html") {
  const formatted = await format(source, { parser });
  let old = "";
  try {
    old = await read(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (old === formatted) return;
  pending.push(file);
  if (!check) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), formatted);
  }
}
const organization = {
  "@type": "Organization",
  "@id": `${origin}/#organization`,
  name: "JustinJ Industries",
  url: `${origin}/`,
  email: "info@justinjindustries.com",
  telephone: "+1-617-800-9291",
  logo: `${origin}/assets/logos/JJI-Logo-Only-grey.png`,
};
function metadata(source, entry) {
  const url = origin + entry.route;
  const title =
    entry.title.endsWith("JustinJ Industries") ||
    entry.title.startsWith("JustinJ Industries |")
      ? entry.title
      : `${entry.title} | JustinJ Industries`;
  const robots = entry.noindex
    ? "noindex, follow"
    : "index, follow, max-image-preview:large";
  const graph = [
    organization,
    {
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      url: `${origin}/`,
      name: "JustinJ Industries",
      publisher: { "@id": organization["@id"] },
    },
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: title,
      description: entry.description,
      isPartOf: { "@id": `${origin}/#website` },
      about: { "@id": organization["@id"] },
    },
  ];
  if (entry.route !== "/" && !entry.noindex)
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        ...(entry.parent
          ? [
              {
                "@type": "ListItem",
                position: 2,
                name: entry.parent.name,
                item: origin + entry.parent.route,
              },
            ]
          : []),
        {
          "@type": "ListItem",
          position: entry.parent ? 3 : 2,
          name: entry.title,
          item: url,
        },
      ],
    });
  if (entry.service)
    graph.push({
      "@type": "Service",
      "@id": `${url}#service`,
      name: entry.title,
      serviceType: entry.title,
      description: entry.description,
      url,
      provider: { "@id": organization["@id"] },
    });
  if (entry.concept)
    graph.push({
      "@type": "CreativeWork",
      name: `${entry.concept} website concept`,
      description: entry.description,
      url,
      creator: { "@id": organization["@id"] },
      genre: "Fictional website design demonstration",
    });
  // Replace only managed head metadata. Page body, print styles, forms and demos stay intact.
  const head = source.match(/<head>[\s\S]*?<\/head>/)[0];
  const stripped = head
    .replace(/\s*<title>[\s\S]*?<\/title>/gi, "")
    .replace(
      /\s*<meta\b(?=[^>]*(?:name\s*=\s*["'](?:description|robots|twitter:[^"']+)["']|property\s*=\s*["']og:[^"']+["']))[^>]*>/gi,
      "",
    )
    .replace(/\s*<link\b(?=[^>]*rel=["']canonical["'])[^>]*>/gi, "")
    .replace(
      /\s*<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
      "",
    )
    .replace(/\s*<!-- Crawler directives -->/g, "");
  const tags = `
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(entry.description)}" />
    <meta name="robots" content="${robots}" />
    ${entry.noindex ? "" : `<link rel="canonical" href="${url}" />`}
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(entry.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="JustinJ Industries" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="JustinJ Industries — Websites, measurement and digital support" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:description" content="${escape(entry.description)}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:image:alt" content="JustinJ Industries — Websites, measurement and digital support" />
    ${entry.noindex ? "" : `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replaceAll("<", "\\u003c")}</script>`}
  `;
  return source
    .replace(head, stripped.replace("</head>", tags + "</head>"))
    .replace(/\/script\.js\?v=[a-f0-9]+/g, `/script.js?v=${scriptVersion}`);
}
const entries = [
  {
    file: "index.html",
    route: "/",
    title: "JustinJ Industries | Websites, Analytics & Support",
    description:
      "Website builds and redesigns, WordPress and Craft CMS support, GA4 and GTM implementation, analytics QA, and practical handoffs from JustinJ Industries.",
  },
  {
    file: "about.html",
    route: "/about/",
    title: "About",
    description:
      "Meet JustinJ Industries, an independent Boston-based studio for hands-on website development, analytics implementation, QA, and practical handoffs.",
  },
  {
    file: "work.html",
    route: "/work/",
    title: "Selected Work & Website Concepts",
    description:
      "Explore selected website work and clearly labeled demonstration concepts from JustinJ Industries, with implementation context and project inquiry paths.",
  },
  {
    file: "catalogue.html",
    route: "/catalogue/",
    title: "Website Design Catalogue",
    description:
      "Explore five demonstration website designs for service businesses and creative teams. Review sample pages, scope, and a nonbinding project inquiry path.",
  },
  {
    file: "design.html",
    route: "/design/",
    title: "Explore Website Design Concepts",
    description:
      "Compare JustinJ Industries website concepts, explore their example pages, and review the scope before starting a nonbinding project inquiry.",
  },
  {
    file: "government-buyers.html",
    route: "/government-buyers/",
    title: "Government Buyers & Primes",
    description:
      "Review JustinJ Industries web development, analytics implementation, QA, and documentation capabilities for public-sector buyers and prime-contractor teams.",
  },
  {
    file: "capability-statement.html",
    route: "/capability-statement/",
    title: "Capability Statement",
    description:
      "JustinJ Industries LLC: websites, measurement and digital support for public-sector teams and prime contractors. Services, selected examples and contact details.",
  },
  {
    file: "policies.html",
    route: "/policies/",
    title: "Website Policies",
    description:
      "Read the JustinJ Industries website privacy and accessibility statements, including inquiry handling, optional embeds, evaluation status, and contact information.",
  },
];
for (const entry of entries)
  await save(entry.file, metadata(await read(entry.file), entry));

const shell = await read("about.html");
function page(main, bodyClass = "page-services") {
  return shell
    .replace(/<body class="[^"]*">/, `<body class="${bodyClass}">`)
    .replace(/ aria-current="page"/g, "")
    .replace(/^[\s\S]*?(?=<main\b)/, (prefix) =>
      prefix
        .replaceAll('href="/#services"', 'href="/services/"')
        .replace(/<a href="\/services\/"/g, (link) =>
          bodyClass.includes("page-service")
            ? `${link} aria-current="page"`
            : link,
        ),
    )
    .replace(
      /<main\b[\s\S]*?<\/main>/,
      `<main id="main" tabindex="-1">${main}</main>`,
    );
}
const journeyCssVersion = createHash("sha256")
  .update(await read("assets/service-journeys.css"))
  .digest("hex")
  .slice(0, 10);
const withJourneys = (source) =>
  source.replace(
    "</head>",
    `<link rel="stylesheet" href="/assets/service-journeys.css?v=${journeyCssVersion}" /></head>`,
  );
const statementPages = [
  {
    file: "services/responsible-implementation/index.html",
    route: "/services/responsible-implementation/",
    title: "Responsible Implementation",
    description:
      "JustinJ Industries’ approach to accessibility, testable measurement, sensitive-data exclusions, and practical QA for scoped client projects.",
    partial: "partials/responsible-implementation-content.html",
    parent: { name: "Services", route: "/services/" },
  },
];
for (const entry of statementPages) {
  await save(
    entry.file,
    metadata(
      withJourneys(
        page(await read(entry.partial), "page-services page-service-detail"),
      ),
      entry,
    ),
  );
  if (!entries.some((item) => item.file === entry.file)) entries.push(entry);
}

const serviceHub = {
  file: "services.html",
  route: "/services/",
  title: "Website, CMS & Analytics Services",
  description:
    "Review JustinJ Industries website development, WordPress and Craft CMS support, and analytics implementation services, with scope, process, and handoff details.",
};
await save(
  serviceHub.file,
  metadata(
    withJourneys(
      page(
        await read("partials/services-hub-content.html"),
        "page-services page-service-hub",
      ),
    ),
    serviceHub,
  ),
);
entries.push(serviceHub);
for (const service of services) {
  const entry = {
    file: `services/${service.slug}/index.html`,
    route: `/services/${service.slug}/`,
    title: service.title,
    description: service.description,
    service: true,
    parent: { name: "Services", route: "/services/" },
  };
  const main = servicePageContent(service);
  await save(
    entry.file,
    metadata(
      withJourneys(page(main, "page-services page-service-detail")),
      entry,
    ),
  );
  entries.push(entry);
}
const designVersion = createHash("sha256")
  .update(await read("design.js"))
  .digest("hex")
  .slice(0, 10);
const designBase = (await read("design.html")).replace(
  /\/design\.js\?v=[a-f0-9]+/,
  `/design.js?v=${designVersion}`,
);
await save("design.html", designBase);
const conceptSource = await read("design.js");
// Extract the existing data-only declaration; never execute browser behavior.
const concepts = Function(
  `"use strict"; ${conceptSource.split('document.addEventListener("DOMContentLoaded"')[0]}; return designConcepts;`,
)();
const slugs = {
  alder: "alder-lane",
  harbor: "harbor-ledger",
  still: "still-form",
  aer: "aer-field",
  northside: "northside",
};
for (const [key, concept] of Object.entries(concepts)) {
  const slug = slugs[key];
  const entry = {
    file: `design/${slug}/index.html`,
    route: `/design/${slug}/`,
    title: `${key === "northside" ? "Northside" : concept.name} Website Concept`,
    description: `${concept.description} A fictional design demonstration by JustinJ Industries, with scope and inquiry details.`,
    concept: concept.name,
    parent: { name: "Designs", route: "/catalogue/" },
  };
  let source = designBase
    .replace(
      '<body class="page-design">',
      `<body class="page-design" data-design-key="${key}">`,
    )
    .replace(
      /(<h1 id="design-title">)[\s\S]*?(<\/h1>)/,
      `$1${escape(concept.name)}$2`,
    )
    .replace(
      /(<p id="design-description">)[\s\S]*?(<\/p>)/,
      `$1${escape(concept.description)}$2`,
    )
    .replace(
      /(<p class="work-label" id="design-type">)[\s\S]*?(<\/p>)/,
      `$1${escape(concept.type)}$2`,
    )
    .replace(
      /(<p id="design-scope-copy">)[\s\S]*?(<\/p>)/,
      `$1${escape(concept.calloutIntro)}$2`,
    )
    .replace(
      /(<div id="design-scope-details"[^>]*>)[\s\S]*?(<\/div>)/,
      `$1<p>${escape(concept.calloutCopy)}</p>$2`,
    )
    .replace(
      "</section>\n      <section",
      `<p><a href="/previews/${slug}/">Open the ${escape(concept.name)} demonstration</a></p></section>\n      <section`,
    );
  await save(entry.file, metadata(source, entry));
  entries.push(entry);
}
const errorEntry = {
  file: "404.html",
  route: "/404.html",
  title: "Page Not Found",
  description:
    "This page could not be found. Return to JustinJ Industries services, website designs, or the contact form.",
  noindex: true,
};
await save(
  errorEntry.file,
  metadata(
    withJourneys(
      page(await read("partials/not-found-content.html"), "page-not-found"),
    ),
    errorEntry,
  ),
);
await save(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map((entry) => `<url><loc>${origin}${entry.route}</loc></url>`).join("\n")}</urlset>`,
  "html",
);
await save(
  "config/seo-routes.json",
  JSON.stringify([...entries, errorEntry], null, 2),
  "json",
);
// Capability PDF hashes are maintained by its actual renderer.
// Source changes must pass the existing PDF rebuild/hash gate.
if (check && pending.length)
  throw new Error(
    `SEO sources are stale: ${pending.join(", ")}. Run npm run prepare:seo.`,
  );
console.log(
  `${check ? "Verified" : "Prepared"} ${entries.length} indexable business routes and a noindex 404 page; ${pending.length} changed files.`,
);
