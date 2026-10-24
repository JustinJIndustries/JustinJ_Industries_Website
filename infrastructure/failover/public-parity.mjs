// Read-only parity against the exact reviewed artifact. No alternate host/IP,
// TLS override, HTML parser reserialization or generic mismatch tolerance.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { verifyPackage } from "./prepare-release.mjs";
import { readOriginManifestEntry } from "./trusted-inspectors.mjs";
const PUBLIC = "https://www.justinjindustries.com/";
const REPO = "JustinJIndustries/JustinJ_Industries_Website";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Exact observed Cloudflare JS Detection template. Only the constrained Ray ID
// and canonical base64 numeric epoch may vary. This string is compared, never run.
export const CF_JSD_TEMPLATE = `(function(){function c(){var b=a.contentDocument||(a.contentWindow&&a.contentWindow.document);if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'<ray>',t:'<time>'};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();`;

function decodedField(encoded) {
  if (!/^(?:[a-f0-9]{2}){4,512}$/i.test(encoded))
    throw new Error("Unknown email transformation");
  const b = Buffer.from(encoded, "hex"),
    key = b[0];
  const text = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(Buffer.from(b.subarray(1).map((x) => x ^ key)));
  return text;
}
function expectedEmail(encoded, allowed) {
  const text = decodedField(encoded);
  if (!allowed.has(text))
    throw new Error("Obfuscated email differs from reviewed artifact");
  return text;
}

const ANCHOR = /<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const VOID = new Set(
  "area base br col embed hr img input link meta param source track wbr".split(
    " ",
  ),
);
const RAW = new Set(
  "script style textarea title xmp iframe noembed noframes noscript plaintext".split(
    " ",
  ),
);
const INERT = new Set([
  "template",
  "svg",
  "math",
  "select",
  "option",
  "optgroup",
]);

// Conservative lexical boundaries only; no DOM reserialization. Unsupported or
// malformed markup fails closed. Never rewrite strings in comments, attributes,
// raw/RCDATA elements, foreign content or templates as if they were HTML nodes.
function markupTokens(input) {
  const tokens = new Map(),
    stack = [];
  let at = 0;
  while (at < input.length) {
    const start = input.indexOf("<", at);
    if (start < 0) break;
    if (input.startsWith("<!--", start)) {
      const end = /--!?\>/.exec(input.slice(start + 4));
      if (!end) throw new Error("Unsupported HTML comment context");
      at = start + 4 + end.index + end[0].length;
      continue;
    }
    if (/^<!doctype\s+html\s*>/i.test(input.slice(start))) {
      at = input.indexOf(">", start) + 1;
      continue;
    }
    const head = /^<(\/?)([A-Za-z][A-Za-z0-9:-]*)(?=[\t\n\f\r />])/.exec(
      input.slice(start),
    );
    if (!head) {
      if (/^<[!?]/.test(input.slice(start)))
        throw new Error("Unsupported HTML declaration context");
      at = start + 1;
      continue;
    }
    let end = start + head[0].length,
      quote = null;
    for (; end < input.length; end++) {
      const c = input[end];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
    }
    if (end === input.length || quote)
      throw new Error("Unsupported HTML tag context");
    end++;
    const name = head[2].toLowerCase(),
      closing = !!head[1];
    const active = !stack.some((x) => INERT.has(x));
    const token = {
      start,
      end,
      name,
      closing,
      active,
      parent: stack.at(-1),
      raw: input.slice(start, end),
    };
    tokens.set(start, token);
    if (closing) {
      const index = stack.lastIndexOf(name);
      if (index >= 0 && stack.slice(index + 1).some((x) => INERT.has(x)))
        throw new Error("Unsupported HTML context boundary");
      if (index >= 0) stack.length = index;
      at = end;
      continue;
    }
    if (name === "plaintext") break;
    if (RAW.has(name)) {
      const tail = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, "ig");
      tail.lastIndex = end;
      const match = tail.exec(input);
      if (!match) throw new Error("Unsupported unclosed HTML raw-text context");
      const close = new RegExp(`^</${name}[\\t\\n\\f\\r ]*>`, "i").exec(
        input.slice(match.index),
      );
      if (!close) throw new Error("Unsupported HTML raw-text closing context");
      const content = input.slice(end, match.index);
      if (name === "script" && content.includes("<!--"))
        throw new Error("Unsupported HTML script escape context");
      token.nodeEnd = match.index + close[0].length;
      at = token.nodeEnd;
      continue;
    }
    if (!VOID.has(name)) stack.push(name);
    at = end;
  }
  return tokens;
}

function hrefOffset(tag) {
  const input = tag.slice(2, -1);
  const token =
    /\s+([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/y;
  let at = 0,
    found = null;
  while (input.slice(at).trim()) {
    token.lastIndex = at;
    const m = token.exec(input);
    if (!m) return null;
    if (m[1].toLowerCase() === "href") {
      if (found !== null) return null;
      found = 2 + m.index + m[0].indexOf(m[1]);
    }
    at = token.lastIndex;
  }
  return found;
}

function anchorAttributes(tag) {
  const input = tag.slice(2, -1),
    result = [],
    seen = new Set();
  const token =
    /\s+([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/y;
  let at = 0;
  while (input.slice(at).trim()) {
    token.lastIndex = at;
    const match = token.exec(input);
    if (!match) return null;
    const name = match[1].toLowerCase();
    if (seen.has(name)) return null;
    seen.add(name);
    result.push([name, match[2] ?? match[3] ?? null]);
    at = token.lastIndex;
  }
  return result.sort((a, b) => a[0].localeCompare(b[0]));
}

export function comparePublicBytes(
  expected,
  received,
  html = false,
  filePath = "",
) {
  expected = Buffer.from(expected);
  received = Buffer.from(received);
  const counts = {
    hiddenCanary: 0,
    emailHref: 0,
    emailText: 0,
    emailMarkup: 0,
    emailDecoder: 0,
    jsDetection: 0,
    managedRobots: 0,
  };
  if (expected.equals(received)) return { exact: true, transforms: counts };
  // Cloudflare documents prepending managed directives to an existing robots
  // file. Accept ONLY the exact 2026-10-24 observed prefix, on this one path,
  // followed by unchanged owner bytes. Changed policies require fresh review.
  // https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/
  if (
    filePath === "robots.txt" &&
    !html &&
    received.length === expected.length + 2676
  ) {
    const prefix = received.subarray(0, 2676);
    if (
      hash(prefix) ===
        "3073d1e371afb3271c7666148766fedc5145f7d8440f7114062db79b7bd58add" &&
      received.subarray(2676).equals(expected)
    ) {
      counts.managedRobots = 1;
      return { exact: false, transforms: counts };
    }
  }
  if (!html)
    throw new Error("Public asset bytes differ from reviewed artifact");
  if (received.length > expected.length + 160 * 1024)
    throw new Error("Excessive public HTML growth");
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const source = decoder.decode(expected);
  let actual = decoder.decode(received);
  // Recompute boundaries after each edit; offsets never refer to stale text.
  const replaceMarkup = (pattern, kind, transform) => {
    const tokens = markupTokens(actual);
    actual = actual.replace(pattern, (all, ...args) => {
      const offset = args.at(-2),
        token = tokens.get(offset);
      let allowed;
      if (kind === "href") {
        allowed = [...tokens.values()].some(
          (t) =>
            t.active &&
            !t.closing &&
            t.name === "a" &&
            hrefOffset(t.raw) !== null &&
            t.start + hrefOffset(t.raw) === offset,
        );
      } else {
        allowed = token?.active && !token.closing && token.name === kind;
        if (kind === "body")
          allowed &&= token.parent === "html" && token.raw === args[0];
        if (kind === "script")
          allowed &&=
            token.parent === "body" && token.nodeEnd === offset + all.length;
      }
      if (!allowed)
        throw new Error(
          "Cloudflare transformation outside permitted HTML context",
        );
      return transform(all, ...args);
    });
  };
  const emails = new Set(
    source.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g) ?? [],
  );
  const emailTargets = new Set(
    [...source.matchAll(/href="mailto:([^"]*)"/g)].map((m) => m[1]),
  );
  const decodedHrefs = new Set();
  // Only an empty, hidden, same-origin Cloudflare canary immediately after BODY.
  replaceMarkup(
    /(<body\b[^>]*>)<a href="([^"]+)" aria-hidden="true" rel="nofollow noopener" style="display: none !important; visibility: hidden !important"><\/a>/g,
    "body",
    (_all, body, href) => {
      const u = new URL(href, PUBLIC);
      if (
        u.origin !== new URL(PUBLIC).origin ||
        u.pathname !== "/cdn-cgi/content" ||
        u.username ||
        u.password ||
        u.hash ||
        [...u.searchParams.keys()].join() !== "id" ||
        !/^[A-Za-z0-9_.-]{32,1024}$/.test(u.searchParams.get("id") ?? "")
      )
        throw new Error("Unknown hidden-link transformation");
      counts.hiddenCanary++;
      return body;
    },
  );
  replaceMarkup(
    /href="\/cdn-cgi\/l\/email-protection#([a-f0-9]+)([^"]*)"/gi,
    "href",
    (_all, encoded, tail) => {
      if (tail && !tail.startsWith("?"))
        throw new Error("Unknown email link suffix");
      const target = decodedField(encoded) + tail;
      if (!emailTargets.has(target))
        throw new Error(
          "Obfuscated email target differs from reviewed artifact",
        );
      const href = `mailto:${target}`;
      decodedHrefs.add(href);
      counts.emailHref++;
      return `href="${href}"`;
    },
  );
  replaceMarkup(
    /<span class="__cf_email__" data-cfemail="([a-f0-9]+)">\[email&#160;protected\]<\/span>/gi,
    "span",
    (_all, encoded) => {
      counts.emailText++;
      return expectedEmail(encoded, emails);
    },
  );
  // An unlinked literal email can be wrapped in this exact helper anchor.
  replaceMarkup(
    /<a href="\/cdn-cgi\/l\/email-protection" class="__cf_email__" data-cfemail="([a-f0-9]+)">\[email&#160;protected\]<\/a>/gi,
    "a",
    (_all, encoded) => {
      counts.emailText++;
      return expectedEmail(encoded, emails);
    },
  );
  // Cloudflare reserializes modified mailto opening tags. Restore only a tag
  // whose COMPLETE attribute names/values match an obfuscated reviewed anchor.
  // No whitespace elsewhere, attribute values, added attributes or body text
  // are normalized. Extra/reordered anchors still fail final full-byte parity.
  const reviewedAnchors = new Map();
  const sourceTokens = markupTokens(source);
  for (const match of source.matchAll(ANCHOR)) {
    const node = sourceTokens.get(match.index);
    if (!node?.active || node.closing || node.name !== "a") continue;
    const attrs = anchorAttributes(match[0]);
    if (!attrs || !attrs.some(([k, v]) => k === "href" && decodedHrefs.has(v)))
      continue;
    const key = JSON.stringify(attrs);
    const list = reviewedAnchors.get(key) ?? [];
    list.push(match[0]);
    reviewedAnchors.set(key, list);
  }
  const actualTokens = markupTokens(actual);
  actual = actual.replace(ANCHOR, (tag, offset) => {
    const node = actualTokens.get(offset);
    if (!node?.active || node.closing || node.name !== "a") return tag;
    const attrs = anchorAttributes(tag);
    if (!attrs) return tag;
    const replacement = reviewedAnchors.get(JSON.stringify(attrs))?.shift();
    if (replacement === undefined) return tag;
    if (replacement !== tag) counts.emailMarkup++;
    return replacement;
  });
  replaceMarkup(
    /<script data-cfasync="false" src="\/cdn-cgi\/scripts\/5c5dd728\/cloudflare-static\/email-decode\.min\.js"><\/script>/g,
    "script",
    () => {
      counts.emailDecoder++;
      return "";
    },
  );
  const scriptTokens = markupTokens(actual);
  actual = actual.replace(
    /<script>([\s\S]*?)<\/script>/g,
    (all, code, offset) => {
      if (!code.includes("/cdn-cgi/challenge-platform/scripts/jsd/main.js"))
        return all;
      const node = scriptTokens.get(offset);
      if (
        !node?.active ||
        node.name !== "script" ||
        node.parent !== "body" ||
        node.nodeEnd !== offset + all.length ||
        !/^\s*<\/body\s*>/.test(actual.slice(node.nodeEnd))
      )
        throw new Error(
          "Cloudflare transformation outside permitted HTML context",
        );
      const fields = code.match(
        /r:'([a-f0-9]{16})',t:'([A-Za-z0-9+/=]{8,80})'/,
      );
      if (!fields) throw new Error("Unknown security-script parameters");
      const time = Buffer.from(fields[2], "base64");
      if (
        time.toString("base64") !== fields[2] ||
        time.length !== 10 ||
        !time.every((b) => b >= 48 && b <= 57)
      )
        throw new Error("Unknown security-script time format");
      const normalized = code.replace(fields[0], "r:'<ray>',t:'<time>'");
      if (normalized !== CF_JSD_TEMPLATE)
        throw new Error("Unknown security-script template");
      counts.jsDetection++;
      return "";
    },
  );
  if (
    counts.hiddenCanary > 1 ||
    counts.emailDecoder > 1 ||
    counts.jsDetection > 1 ||
    counts.emailText > 64 ||
    counts.emailHref > 64
  )
    throw new Error("Excessive Cloudflare transformations");
  if (!Buffer.from(actual, "utf8").equals(expected)) {
    const error = new Error(
      "Public HTML differs beyond the pinned Cloudflare transformations",
    );
    error.transforms = counts;
    let at = 0;
    while (
      at < Math.min(source.length, actual.length) &&
      source[at] === actual[at]
    )
      at++;
    error.diffOffset = at;
    error.expectedLength = source.length;
    error.actualLength = actual.length;
    throw error;
  }
  return { exact: false, transforms: counts };
}

export function assertPublishedSourceRun(run, sourceCommit) {
  if (
    !/^[a-f0-9]{40}$/.test(sourceCommit ?? "") ||
    run?.repository?.full_name !== REPO ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    run.head_branch !== "main" ||
    run.head_sha !== sourceCommit ||
    run.path !== ".github/workflows/jekyll-gh-pages.yml" ||
    !Number.isSafeInteger(run.id) ||
    run.id < 1
  )
    throw new Error(
      "Successful approved-source production provenance required",
    );
  return { repository: REPO, runId: String(run.id), sourceCommit };
}

export async function createPublicArtifactVerifier({
  packageRoot,
  provenance,
  approvedSourceCommit,
  approvedWorkflowCommit,
  approvedRelease,
  fetcher = globalThis.fetch,
  requirePrimaryMarker = false,
  origin = PUBLIC,
}) {
  if (
    origin !== PUBLIC ||
    provenance?.repository !== REPO ||
    !/^[a-f0-9]{40}$/.test(approvedSourceCommit ?? "") ||
    provenance.sourceCommit !== approvedSourceCommit ||
    !/^[a-f0-9]{40}$/.test(approvedWorkflowCommit ?? "") ||
    provenance.workflowCommit !== approvedWorkflowCommit ||
    !/^\d+$/.test(provenance.workflowRunId ?? "")
  )
    throw new Error(
      "Reviewed build provenance or public verification host mismatch",
    );
  const metadata = await verifyPackage(packageRoot);
  if (metadata.release !== approvedRelease)
    throw new Error("Reviewed artifact identity mismatch");
  const inventories = [
    { entries: metadata.previousFiles, root: path.join(packageRoot, "stage") },
    { entries: metadata.stageFiles, root: path.join(packageRoot, "stage") },
    { entries: metadata.files, root: path.join(packageRoot, "public") },
  ];
  return async function verifyPublic(entries) {
    const bound = inventories.find((x) => same(x.entries, entries));
    if (!bound)
      throw new Error(
        "Verification inventory is not bound to reviewed artifact",
      );
    const aggregate = {
      hiddenCanary: 0,
      emailHref: 0,
      emailText: 0,
      emailMarkup: 0,
      emailDecoder: 0,
      jsDetection: 0,
      managedRobots: 0,
    };
    for (const entry of entries) {
      const expected = await readFile(path.join(bound.root, entry.path));
      if (hash(expected) !== entry.sha256)
        throw new Error("Local reviewed artifact bytes changed");
      const observed = await readOriginManifestEntry(PUBLIC, entry, {
        fetcher,
        requirePrimaryMarker,
      });
      const html = entry.path.endsWith(".html");
      if (html && !/^text\/html\b/i.test(observed.contentType))
        throw new Error("Public HTML MIME type mismatch");
      const result = comparePublicBytes(
        expected,
        observed.bytes,
        html,
        entry.path,
      );
      for (const k of Object.keys(aggregate))
        aggregate[k] += result.transforms[k];
    }
    return {
      policy: "reviewed-artifact-and-pinned-cf-parity-1",
      origin: PUBLIC,
      sourceCommit: provenance.sourceCommit,
      artifactRelease: metadata.release,
      workflowCommit: provenance.workflowCommit,
      verifiedFiles: entries.length,
      transforms: aggregate,
    };
  };
}
