const directions = {
  advertising: {
    name: "Digital advertising",
    heading: "Advertising with a clear next step.",
    intro:
      "Connect the offer, audience, landing page and measurement before a campaign goes live.",
    action: "Discuss advertising",
    advertising: true,
    outputs: [
      "Campaign plan",
      "Setup & review",
      "Journey & measurement checks",
      "Optimization & reporting",
    ],
    process: ["Define the campaign", "Prepare & review", "Measure & improve"],
  },
  "website-development": {
    name: "Website development",
    heading: "A better website, built around your business.",
    intro:
      "Plan the pages, visitor journeys and practical details of a new website or focused redesign.",
    action: "Discuss your website",
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
      "Connect business questions to Google Analytics (GA4) and Google Tag Manager (GTM) implementation, or Adobe Analytics and Tags (Adobe Launch) specification review and QA.",
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
        "Agree on the trigger, parameters and sensitive-data exclusions.",
      ],
      [
        "Validation",
        "Compare expected and observed behavior on the agreed journeys.",
      ],
      ["Handoff", "Document configuration, limitations and ongoing ownership."],
    ],
    instrumentation: true,
  },
  "cms-support": {
    name: "CMS support",
    heading: "Make everyday publishing easier to manage.",
    intro:
      "Focused WordPress and Craft CMS improvements, with clear templates, tested workflows and a practical handoff.",
    action: "Discuss CMS support",
    editorDemo: true,
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
const advertisingCreative =
  '<figure class="campaign-visual" aria-label="Illustrative campaign brief connecting a home-cleaning offer, audience, landing page and confirmed inquiry measurement">\n <div class="campaign-visual__title"><span>Campaign brief</span><strong>One offer. A connected journey.</strong></div>\n <div class="campaign-visual__body"><div class="campaign-creative"><span>Recurring home cleaning</span><strong>Your weekend.<br />Yours again.</strong><p>Find a cleaning plan that fits your home.</p><span class="campaign-creative__action">Request a quote</span></div>\n <dl class="campaign-brief"><div><dt>Audience</dt><dd>People in the agreed service area</dd></div><div><dt>Placement</dt><dd>Display / paid social creative</dd></div><div><dt>Landing page</dt><dd>A focused quote-request journey</dd></div><div><dt>Measurement</dt><dd>Confirmed inquiries, with agreed definitions</dd></div></dl></div>\n <figcaption>Offer, audience, landing page and measurement, planned together.</figcaption>\n</figure>';
const websiteShowcase = `<figure class="service-device-showcase"><a href="/design/aer-field/" aria-label="Explore the AER / FIELD desktop and mobile website demo"><div class="service-device-showcase__desktop"><img src="/assets/service-previews/aer-field-desktop.jpg" width="1280" height="900" alt="Actual AER / FIELD desktop demo with its aerial-film introduction and film navigation" fetchpriority="high" /></div><div class="service-device-showcase__mobile"><img src="/assets/service-previews/aer-field-mobile.jpg" width="780" height="1688" alt="Actual AER / FIELD mobile demo with its responsive menu and stacked introduction" /></div></a><figcaption>AER / FIELD · Desktop and mobile demo</figcaption></figure>`;
const instrumentationChecks = [
  ["event", "generate_lead"],
  ["form_id", "quote_request"],
  ["service_interest", "recurring_cleaning"],
  ["lead_type", "service_quote"],
  ["page_path", "/services/home-cleaning/"],
  ["inquiry_source", "service_page"],
  ["submission_status", "success"],
]
  .map(
    ([key, value]) =>
      `<div><dt><code>${encode(key)}</code></dt><dd><span class="instrumentation-checks__values"><span><span class="instrumentation-checks__label">Expected</span><code data-expected>${encode(value)}</code></span><span><span class="instrumentation-checks__label">Observed</span><code data-observed>${encode(value)}</code></span></span><span class="instrumentation-checks__status">Matched</span></dd></div>`,
  )
  .join("");
const instrumentationDemo = `<figure class="instrumentation-demo" aria-labelledby="example-title">
  <div class="instrumentation-demo__header"><strong>From quote request to confirmed inquiry</strong></div>
  <ol class="instrumentation-flow">
    <li><h3>Quote request success</h3><p>Confirmation after the server accepts the inquiry.</p><div class="instrumentation-success"><div class="instrumentation-success__body"><svg class="instrumentation-success__icon" viewBox="0 0 32 32" width="48" height="48" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="m9 16 5 5 9-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg><h4>Thanks!</h4><p>Your quote request has been received.</p><div class="instrumentation-action"><span>Requested service</span><strong>Recurring home cleaning</strong></div></div></div><code class="instrumentation-route">/services/home-cleaning/</code></li>
    <li><h3>Data layer</h3><p>Queue the confirmed-success event.</p><pre><code>if (submissionConfirmed === true) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "generate_lead",
    form_id: "quote_request",
    service_interest: "recurring_cleaning",
    lead_type: "service_quote",
    page_path: "/services/home-cleaning/",
    inquiry_source: "service_page",
    submission_status: "success"
  });
}</code></pre></li>
    <li><h3>Validation</h3><p>Compare every field in the completion event.</p><dl class="instrumentation-checks">${instrumentationChecks}</dl></li>
  </ol>
</figure>`;
const cmsEditorDemo = `<figure class="cms-editing-demo">
  <div class="cms-editing-demo__header"><strong>Page editor</strong><span>Demo</span></div>
  <div class="cms-editing-demo__workspace">
    <div class="cms-editing-demo__editor"><p class="cms-editing-demo__label">Page title</p><div class="cms-editing-demo__title">Service overview</div><p class="cms-editing-demo__label">Content blocks</p><ol class="cms-editing-demo__blocks"><li><strong>Introduction</strong><span>Heading and summary</span></li><li><strong>Service details</strong><span>Reusable content layout</span></li><li><strong>Next step</strong><span>Contact link and guidance</span></li></ol></div>
    <div class="cms-editing-demo__outline"><strong>Page structure</strong><ul><li>Introduction</li><li>Service details</li><li>Next step</li></ul><div class="cms-editing-demo__review"><strong>Review workflow</strong><p>Edit content<br />Preview the page<br />Agree the release</p></div></div>
  </div>
  <figcaption>CMS editing demo · Content structure and review workflow</figcaption>
</figure>`;

const channelPreviews = {
  search: `<div class="ad-channel-preview ad-channel-preview--search"><span class="ad-preview-label">Sponsored · cleaning.example</span><strong>Home cleaning, on your schedule</strong><p>Explore recurring cleaning and request a quote for your home.</p><span class="ad-preview-destination">Service page → Quote request</span></div>`,
  display: `<div class="ad-channel-preview ad-channel-preview--display"><span class="ad-preview-label">Display creative</span><strong>A little more room<br />for your weekend.</strong><span class="ad-preview-action">Explore home cleaning</span></div>`,
  social: `<div class="ad-channel-preview ad-channel-preview--social"><span class="ad-preview-label">Home-cleaning service · Sponsored</span><p>Make space for the things you enjoy. Find a cleaning plan that fits your home.</p><div class="ad-preview-social-art"><strong>Your home.<br />Your time.</strong></div><span class="ad-preview-destination">Recurring cleaning <span class="ad-preview-action">Request a quote</span></span></div>`,
};
const advertisingChannels = (channels) =>
  `<section class="ad-channels" aria-labelledby="ad-channels-title"><div class="ad-channels__intro"><h2 id="ad-channels-title">Different channels. A clear role for each.</h2><p>Choose the channel around the objective, audience and available creative. Each needs its own setup, review and reporting plan.</p></div><div class="ad-channels__grid">${channels
    .map(
      (channel) =>
        `<article class="ad-channel" aria-labelledby="ad-channel-${channel.key}"><h3 id="ad-channel-${channel.key}">${encode(channel.title)}</h3><p class="ad-channel__intro">${encode(channel.intro)}</p>${channelPreviews[channel.key]}<dl>${[
          ["Set up", channel.setup],
          ["Review & improve", channel.review],
          ["Report", channel.report],
        ]
          .map(
            ([label, copy]) =>
              `<div><dt>${encode(label)}</dt><dd>${encode(copy)}</dd></div>`,
          )
          .join("")}</dl></article>`,
    )
    .join("")}</div></section>`;

export function servicePageContent(service) {
  const d = directions[service.slug];
  const contact = `/?inquiry_type=${encodeURIComponent(service.inquiry)}#contact`;
  const model = d.model
    ? `<ol class="measurement-model">${d.model.map(([title, copy]) => `<li><h2>${encode(title)}</h2><p>${copy}</p></li>`).join("")}</ol>`
    : d.advertising
      ? advertisingCreative
      : d.editorDemo
        ? cmsEditorDemo
        : websiteShowcase;
  return `<div class="container service-detail">
    <section class="service-detail-hero" aria-labelledby="service-title"><div><p class="eyebrow">${encode(d.name)}</p><h1 id="service-title">${d.heading}</h1><p class="service-detail-lead">${d.intro}</p><a class="btn" href="${contact}">${d.action}</a></div>${model}</section>
    ${service.channels ? advertisingChannels(service.channels) : ""}
    ${d.starts ? `<section class="service-starts" aria-label="Common starting points">${d.starts.map(([title, copy]) => `<div><h2>${encode(title)}</h2><p>${copy}</p></div>`).join("")}</section>` : ""}
    ${d.instrumentation ? `<section class="service-example" aria-labelledby="example-title"><h2 id="example-title">See which services bring in quote requests.</h2><p>For a home-cleaning business, connect each quote request to the service a customer wants and the page where the inquiry began. Count confirmed completions after the server accepts the request.</p>${instrumentationDemo}<p><code>inquiry_source: service_page</code> identifies the on-site entry point. The <code>submissionConfirmed</code> flag comes from server-confirmed acceptance. The push queues data for Google Tag Manager; a configured GA4 tag maps the agreed fields according to its consent settings.</p></section>` : ""}
    <section class="service-deliverables" aria-labelledby="deliverables-title"><div><h2 id="deliverables-title">What the work can include</h2><p>Define the deliverables before implementation begins.</p><p>${encode(service.fit)}</p>${d.instrumentation ? `<p>Campaign setup and optimization have their own <a href="/services/advertising/">advertising scope</a>.</p>` : ""}</div><dl>${service.deliverables.map((item, i) => `<div><dt>${encode(d.outputs[i])}</dt><dd>${encode(item)}</dd></div>`).join("")}</dl></section>
    <section class="service-detail-process" aria-labelledby="process-title"><h2 id="process-title">From first review to a documented release.</h2><ol>${service.process.map((item, i) => `<li><h3>${encode(d.process[i])}</h3><p>${encode(item)}</p></li>`).join("")}</ol></section>
    <section class="service-scope" aria-label="Preparing and agreeing scope"><div><h2>Before we talk</h2><p>${encode(service.prepare)}</p></div><div><h2>Scope, clearly agreed</h2><p>${encode(service.boundary)}</p></div></section>
    <section class="service-detail-next" aria-labelledby="next-title"><h2 id="next-title">Tell us what needs to change.</h2><div><a class="btn" href="${contact}">Start a project conversation</a><a class="text-link" href="/services/responsible-implementation/">Accessibility &amp; measurement approach</a></div></section>
    <aside class="service-page-disclosure" aria-label="Service demo notes"><p>${d.advertising ? "Illustrative campaign brief and channel layouts. Platform approval and campaign outcomes vary; no outcome is guaranteed." : d.instrumentation ? "Illustrative workflow: the success screen, event and validation values are illustrative; no form is submitted." : d.editorDemo ? "Generic CMS editing demo; editing and publishing actions are illustrative." : "AER / FIELD is a demonstration brand; the desktop and mobile views are demo screenshots."}</p></aside>
  </div>`;
}
