const directions = {
  "website-development": {
    name: "Website development",
    heading: "A website built around what people need to do.",
    intro:
      "Plan the pages, visitor journeys and practical details of a new website or focused redesign.",
    action: "Discuss your website",
    media: {
      src: "/assets/work/northside-home-cover-1280.webp",
      width: 1280,
      height: 667,
      alt: "Northside heating-services website concept with service navigation and an inquiry starting point",
      caption: "Northside · Fictional website concept",
      href: "/design/northside/",
    },
    starts: [
      [
        "Starting from a blank page?",
        "Define the pages, content and visitor tasks before choosing the implementation details.",
      ],
      [
        "Improving an existing site?",
        "Review where people get stuck, which content needs work and what the current platform can support.",
      ],
    ],
    outputs: [
      "Page & content plan",
      "Responsive implementation",
      "Technical foundations",
      "Release & handoff",
    ],
    process: ["Review", "Agree", "Build & validate"],
  },
  "analytics-tagging": {
    name: "Analytics & tagging",
    heading: "Turn tracking questions into a testable plan.",
    intro:
      "Define what matters, configure the agreed events and document what actually happened in validation.",
    action: "Discuss measurement",
    outputs: [
      "Measurement specification",
      "Configuration & review",
      "Data-handling boundaries",
      "Validation & handoff",
    ],
    process: ["Review the setup", "Define the events", "Validate the journeys"],
    model: [
      ["Business question", "What decision should the measurement support?"],
      [
        "Event definition",
        "Agree the trigger, parameters and sensitive-data exclusions.",
      ],
      [
        "Validation",
        "Compare expected and observed behavior on the agreed journeys.",
      ],
      ["Handoff", "Document configuration, limitations and ongoing ownership."],
    ],
    example: {
      src: "/assets/work/northside-dashboard-demo.png",
      width: 1600,
      height: 1000,
      alt: "Northside reporting demonstration with synthetic acquisition and inquiry data",
      caption: "Northside · Synthetic reporting concept; not client results.",
      href: "/work/#northside",
    },
  },
  "cms-support": {
    name: "CMS support",
    heading: "Make everyday publishing easier to manage.",
    intro:
      "Focused WordPress and Craft CMS improvements, with clear templates, tested workflows and a practical handoff.",
    action: "Discuss CMS support",
    media: {
      src: "/assets/work/uaid-usa-home.png",
      width: 1920,
      height: 1670,
      alt: "Published UAid Direct USA homepage showing regional navigation and reusable content sections",
      caption: "Selected WordPress work · UAid Direct",
      href: "/work/#uaid",
    },
    starts: [
      [
        "Improve a template",
        "Refine a layout or reusable content structure within the existing platform.",
      ],
      [
        "Simplify a content workflow",
        "Review how editors create, update and publish the content they maintain.",
      ],
      [
        "Review a bounded change",
        "Confirm dependencies, review conditions and the journeys affected by the update.",
      ],
    ],
    outputs: [
      "Platform & workflow review",
      "Focused implementation",
      "Editor & visitor testing",
      "Guidance & change record",
    ],
    process: [
      "Confirm the environment",
      "Bound the change",
      "Review & document",
    ],
  },
};

const encode = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const figure = (media, eager = false) =>
  `<figure class="service-detail-media"><a href="${media.href}"><img src="${media.src}" width="${media.width}" height="${media.height}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} alt="${encode(media.alt)}" /></a><figcaption>${encode(media.caption)}</figcaption></figure>`;

export function servicePageContent(service) {
  const d = directions[service.slug];
  const contact = `/?inquiry_type=${encodeURIComponent(service.inquiry)}#contact`;
  const model = d.model
    ? `<ol class="measurement-model">${d.model.map(([title, copy]) => `<li><h2>${encode(title)}</h2><p>${copy}</p></li>`).join("")}</ol>`
    : figure(d.media, true);
  return `<div class="container service-detail">
    <nav class="service-breadcrumb" aria-label="Breadcrumb"><a href="/services/">Services</a><span aria-hidden="true">/</span><span>${encode(d.name)}</span></nav>
    <section class="service-detail-hero" aria-labelledby="service-title"><div><h1 id="service-title">${d.heading}</h1><p class="service-detail-lead">${d.intro}</p><a class="btn" href="${contact}">${d.action}</a></div>${model}</section>
    ${d.starts ? `<section class="service-starts" aria-label="Common starting points">${d.starts.map(([title, copy]) => `<div><h2>${encode(title)}</h2><p>${copy}</p></div>`).join("")}</section>` : ""}
    ${d.example ? `<section class="service-example" aria-labelledby="example-title"><h2 id="example-title">An implementation you can explain.</h2>${figure(d.example)}<p>A reporting example shows how questions can be organized. The implementation still needs an agreed event plan and validation against the actual website.</p><a class="text-link" href="/work/#northside">Review the reporting demonstration</a></section>` : ""}
    <section class="service-deliverables" aria-labelledby="deliverables-title"><div><h2 id="deliverables-title">What the work can include</h2><p>Define the deliverables before implementation begins.</p><p>${encode(service.fit)}</p></div><dl>${service.deliverables.map((item, i) => `<div><dt>${encode(d.outputs[i])}</dt><dd>${encode(item)}</dd></div>`).join("")}</dl></section>
    <section class="service-detail-process" aria-labelledby="process-title"><h2 id="process-title">From first review to a documented release.</h2><ol>${service.process.map((item, i) => `<li><h3>${encode(d.process[i])}</h3><p>${encode(item)}</p></li>`).join("")}</ol></section>
    <section class="service-scope" aria-label="Preparing and agreeing scope"><div><h2>Before we talk</h2><p>${encode(service.prepare)}</p></div><div><h2>Scope, clearly agreed</h2><p>${encode(service.boundary)}</p></div></section>
    <section class="service-detail-next" aria-labelledby="next-title"><h2 id="next-title">Tell me what needs to change.</h2><div><a class="btn" href="${contact}">Start a project conversation</a><a class="text-link" href="/services/responsible-implementation/">Accessibility &amp; measurement approach</a></div></section>
  </div>`;
}
