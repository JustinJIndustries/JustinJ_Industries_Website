import prettier from "prettier";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "previews/harbor-ledger");
const d = JSON.parse(fs.readFileSync(path.join(dir, "content.json"), "utf8"));
const e = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const hash = (p) =>
  createHash("sha256")
    .update(fs.readFileSync(path.join(root, p)))
    .digest("hex")
    .slice(0, 10);
const base = "/previews/harbor-ledger";
const arrow =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h16m-7-7 7 7-7 7"/></svg>';
const link = (href, text, cls = "hl-text-link") =>
  `<a class="${cls}" href="${href}"><span>${e(text)}</span>${arrow}</a>`;
const contact = (s) =>
  base + "/contact/" + (s ? "?service=" + encodeURIComponent(s) : "");
const services = () =>
  d.services
    .map(
      (s, i) =>
        `<a class="hl-service-row" href="${base}/services/#${s.id}"><span class="hl-service-number">0${i + 1}</span><div><h3>${e(s.name)}</h3><p>${e(s.summary)}</p></div>${arrow}</a>`,
    )
    .join("");
const industries = () =>
  d.industries
    .map(
      (s) =>
        `<a class="hl-industry" href="${base}/services/#${s.id}"><div><h3>${e(s.name)}</h3><p>${e(s.summary)}</p></div>${arrow}</a>`,
    )
    .join("");
const process = () =>
  `<ol class="hl-process-list">${d.process.map((s, i) => `<li><span aria-hidden="true">0${i + 1}</span><div><h3>${e(s.title)}</h3><p>${e(s.body)}</p></div></li>`).join("")}</ol>`;
const faqs = (items = d.faq) =>
  `<div class="hl-faq-list">${items.map((s) => `<details><summary><span>${e(s.q)}</span><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 10h14M10 3v14"/></svg></summary><p>${e(s.a)}</p></details>`).join("")}</div>`;
const cta = () =>
  `<section class="hl-closing hl-wrap"><div><h2>What needs a clearer view?</h2><p>Bring the question. We’ll help you frame the next conversation.</p></div>${link(contact(), "Start a conversation", "hl-button")}</section>`;
const nav = [
  ["services", "Services", base + "/services/"],
  ["industries", "Industries", base + "/services/#industries"],
  ["about", "Approach", base + "/about/"],
  ["faq", "FAQs", base + "/faq/"],
  ["contact", "Let’s talk", base + "/contact/"],
];
const art = `<svg class="hl-architecture" viewBox="0 0 660 640" aria-hidden="true" focusable="false"><g fill="none" stroke="#b9d0c9" stroke-width="1" opacity=".65">${Array.from({ length: 8 }, (_, i) => `<path d="M${140 + i * 14} 35v510M20 ${500 + i * 12} 630 ${440 + i * 12}"/>`).join("")}<path d="m390 360 245-78v318l-245-70Z"/>${Array.from({ length: 5 }, (_, i) => `<path d="M${570 + i * 13} ${305 - i * 4}v305"/>`).join("")}</g><path d="M250 80 470 174v386l-220-94Zm25 42v326l171 74V194Z" fill="#dceae3" fill-rule="evenodd"/><path d="M530 44 650 96v470l-120-51Zm22 40v416l76 32V112Z" fill="#327c70" fill-rule="evenodd"/><path d="M75 225 280 321v292L75 525Zm23 36v248l160 73V337Z" fill="#19766b" fill-rule="evenodd"/></svg>`;
const intro = (key) =>
  `<section class="hl-page-intro hl-wrap"><h1>${e(d.pages[key].title)}</h1><p class="hl-lead">${e(d.pages[key].lead)}</p></section>`;
const pages = {
  home: `<section class="hl-hero"><div class="hl-wrap hl-hero-inner"><div class="hl-hero-copy"><h1>${d.home.title
    .split("\n")
    .map((line) => `<span>${e(line)}</span>`)
    .join(
      "",
    )}</h1><p class="hl-lead">${e(d.home.lead)}</p><div class="hl-actions">${link(contact(), "Start a conversation", "hl-button hl-button--light")}${link(base + "/services/", "Explore services")}</div></div>${art}</div></section><nav class="hl-service-rail hl-wrap" aria-label="Areas of support">${d.services.map((s) => link(base + "/services/#" + s.id, s.name)).join("")}</nav><section class="hl-expertise hl-wrap hl-split"><div><h2>${e(d.home.expertiseTitle)}</h2><p>${e(d.home.expertiseLead)}</p></div><div>${services()}</div></section><section class="hl-industries"><div class="hl-wrap hl-split"><div><h2>${e(d.home.industryTitle)}</h2><p>${e(d.home.industryLead)}</p></div><div class="hl-industry-grid">${industries()}</div></div></section><section class="hl-approach hl-wrap hl-split"><div><h2>A more connected way to work.</h2><p>A clear question, a considered process and a practical handover.</p>${link(base + "/about/", "Our approach")}</div>${process()}</section>${cta()}`,
  services: `${intro("services")}<nav class="hl-jump hl-wrap" aria-label="On this page">${d.services.map((s) => `<a href="#${s.id}">${e(s.name)}</a>`).join("")}<a href="#industries">Industries</a></nav><section class="hl-service-details hl-wrap" aria-label="Our services">${d.services.map((s, i) => `<article id="${s.id}" class="hl-service-detail"><div><span class="hl-index">0${i + 1}</span><h2>${e(s.name)}</h2></div><div><h3>${e(s.headline)}</h3><p>${e(s.body)}</p><h4>A focused engagement can cover</h4><ul>${s.outputs.map((x) => `<li>${e(x)}</li>`).join("")}</ul><p class="hl-prompt">${e(s.starting)}</p>${link(contact(s.name), "Discuss " + s.name.toLowerCase())}</div></article>`).join("")}</section><section class="hl-industries" id="industries"><div class="hl-wrap hl-split"><div><h2>${e(d.home.industryTitle)}</h2><p>${e(d.home.industryLead)}</p></div><div class="hl-industry-details">${d.industries.map((s, i) => `<details id="${s.id}"${i === 0 ? " open" : ""}><summary><span>${e(s.name)}</span>${arrow}</summary><p>${e(s.body)}</p><ul>${s.questions.map((x) => `<li>${e(x)}</li>`).join("")}</ul>${link(contact(), "Start with your business context")}</details>`).join("")}</div></div></section>${cta()}`,
  about: `${intro("about")}<section class="hl-about-panel hl-wrap"><img src="${base}/assets/quiet-workspace.jpg" alt="A quiet worktable with paper, books and a green cup" width="1536" height="1024" loading="lazy"><div><h2>Perspective before prescription.</h2><p>Every engagement starts with the operating context: how your business works, who needs the information and which decision it will support.</p><p>From the detail of the close to a broader business question, the aim is the same: a clear view, a considered conversation and a practical next step.</p></div></section><section class="hl-approach hl-wrap hl-split"><div><h2>Clear from the outset.</h2><p>Useful work needs a shared question and a way to judge whether it has been answered.</p></div>${process()}</section><section class="hl-principles"><div class="hl-wrap"><h2>How we keep the work useful.</h2><div class="hl-principle-grid"><article><h3>Understand the context</h3><p>Start with how the business operates, not a preset answer or a longer list of reports.</p></article><article><h3>Make assumptions visible</h3><p>Distinguish what is known, what needs checking and what could change the decision.</p></article><article><h3>Leave a clear handover</h3><p>Document the work, ownership and review points so the next step is easier to follow.</p></article></div></div></section>${cta()}`,
  faq: `${intro("faq")}<section class="hl-faq-section hl-wrap">${faqs()}</section>${cta()}`,
  contact: `<section class="hl-contact hl-wrap"><div class="hl-contact-copy"><h1>${e(d.pages.contact.title)}</h1><p class="hl-lead">${e(d.pages.contact.lead)}</p><ol class="hl-preparation"><li><h2>Your business context</h2><p>What is changing, who is involved and what needs attention?</p></li><li><h2>The support you need</h2><p>Where would more capacity, perspective or clarity help?</p></li><li><h2>Your preferred next step</h2><p>What would a useful conversation make possible?</p></li></ol></div><div><form id="hl-inquiry" class="hl-form" novalidate aria-label="Consultation inquiry"><div class="hl-errors" tabindex="-1" hidden><h2>Please check the following</h2><ul></ul></div><div class="hl-form-grid">${[
    ["name", "Your name", "text", true],
    ["email", "Work email", "email", true],
    ["organization", "Organization", "text", false],
  ]
    .map(
      ([id, label, type, req]) =>
        `<div class="hl-field"><label for="hl-${id}">${label}${req ? " <span>(required)</span>" : ""}</label><input id="hl-${id}" type="${type}" autocomplete="${id}" maxlength="160"${req ? " required" : ""} aria-describedby="hl-${id}-error"><span class="hl-error" id="hl-${id}-error" hidden></span></div>`,
    )
    .join(
      "",
    )}<div class="hl-field"><label for="hl-service">Area of support <span>(required)</span></label><select id="hl-service" required aria-describedby="hl-service-error"><option value="">Select an area</option>${d.services.map((s) => `<option>${e(s.name)}</option>`).join("")}<option>Not sure yet</option></select><span class="hl-error" id="hl-service-error" hidden></span></div><div class="hl-field hl-field--full"><label for="hl-industry">Industry</label><select id="hl-industry"><option value="">Select an industry</option>${d.industries.map((s) => `<option>${e(s.name)}</option>`).join("")}<option>Another industry / not sure</option></select></div><div class="hl-field hl-field--full"><label for="hl-message">What would you like to discuss? <span>(required)</span></label><textarea id="hl-message" rows="5" required minlength="10" maxlength="1500" aria-describedby="hl-message-help hl-message-error"></textarea><span id="hl-message-help" class="hl-help">Please leave out sensitive financial or account information.</span><span class="hl-error" id="hl-message-error" hidden></span></div></div><button id="hl-review" class="hl-button" type="submit" disabled>Review inquiry ${arrow}</button><noscript><p>JavaScript enables the local inquiry review. Nothing can be sent from this page.</p></noscript><div class="hl-review" tabindex="-1" role="status" hidden><h2>Ready for a conversation.</h2><p>No information has been sent or stored. This review happens only in your browser.</p><p>${link("/design/?design=harbor", "Discuss this direction with JJI")}</p><button class="hl-edit" type="button">Edit details</button></div></form>${faqs(d.faq.slice(0, 2))}</div></section>`,
};
for (const [key, body] of Object.entries(pages)) {
  const title =
    key === "home"
      ? "Harbor Ledger — Accounting & advisory"
      : `${key === "about" ? "Our approach" : key === "faq" ? "Questions & answers" : key === "contact" ? "Start a conversation" : "Services"} — Harbor Ledger`;
  const out = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow, noimageindex"><meta name="description" content="${e(key === "home" ? d.home.lead : d.pages[key].lead)}"><title>${e(title)}</title><link rel="stylesheet" href="${base}/source.css?v=${hash("previews/harbor-ledger/source.css")}"><link rel="stylesheet" href="${base}/preview.css?v=${hash("previews/harbor-ledger/preview.css")}"><link rel="stylesheet" href="/assets/demo-return.css?v=${hash("assets/demo-return.css")}"><script src="/assets/demo-return.js?v=${hash("assets/demo-return.js")}"></script><script src="${base}/site.js?v=${hash("previews/harbor-ledger/site.js")}" defer></script><link rel="icon" href="${base}/favicon-32.png?v=${hash("previews/harbor-ledger/favicon-32.png")}" type="image/png" sizes="32x32"><link rel="icon" href="${base}/favicon.svg?v=${hash("previews/harbor-ledger/favicon.svg")}" type="image/svg+xml" sizes="any"></head><body><a class="hl-skip" href="#main">Skip to content</a><nav class="jji-demo-bar" aria-label="Demo return"><a class="jji-demo-bar__back" href="/design/?design=harbor"><svg class="jji-demo-bar__arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 12H4m7-7-7 7 7 7"/></svg><span>Back to JJI</span></a><span class="jji-demo-bar__label">Demo</span></nav><header class="hl-header hl-wrap"><a class="hl-brand" href="${base}/">${e(d.brand)}</a><button type="button" class="hl-menu" aria-controls="hl-navigation" aria-expanded="false" hidden><span>Menu</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 8h18M3 16h18"/></svg></button><nav class="hl-nav" id="hl-navigation" aria-label="Main navigation">${nav.map(([id, label, href]) => `<a href="${href}"${id === key ? ' aria-current="page"' : ""}${id === "contact" ? ' class="hl-button"' : ""}>${e(label)}</a>`).join("")}</nav></header><main id="main" tabindex="-1">${body}</main><aside class="demo-disclosures hl-wrap" aria-label="Demo notes"><p id="demo-note-1" tabindex="-1"><strong>About this demo:</strong> ${e(d.disclosure)}</p></aside><footer class="hl-footer"><div class="hl-wrap hl-footer-inner"><div><a class="hl-brand" href="${base}/">${e(d.brand)}</a><p>${e(d.tagline)}</p></div><nav aria-label="Footer navigation"><a href="${base}/">Home</a>${nav.map(([, label, href]) => `<a href="${href}">${e(label)}</a>`).join("")}</nav><div>${link(contact(), "Start a conversation", "hl-button hl-button--light")}<a class="hl-footer-back" href="/design/?design=harbor">Back to JustinJ Industries</a></div></div></footer></body></html>`;
  fs.writeFileSync(
    path.join(dir, key === "home" ? "index.html" : key + ".html"),
    await prettier.format(out, { parser: "html" }),
  );
}
console.log(
  "Rendered five Harbor Ledger pages from shared structured content.",
);
