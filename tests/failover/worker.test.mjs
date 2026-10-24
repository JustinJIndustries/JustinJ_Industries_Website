import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHandler } from "../../infrastructure/failover/worker.mjs";

const id = "a".repeat(64),
  previous = "b".repeat(64);
const origin = "https://ac3af448.jji-backup-20261023.pages.dev/";
const env = {
  RELEASE_CONFIG: JSON.stringify({ origin, current: id, retained: [previous] }),
};
const request = (suffix = "/services/?inquiry_type=private#contact", init) =>
  new Request("https://www.justinjindustries.com" + suffix, init);
function setup(steps, options = {}) {
  const calls = [];
  const fetcher = async (r) => {
    calls.push(r);
    const step = steps.shift();
    if (typeof step === "function") return step(r);
    if (step instanceof Error) throw step;
    if (!step) throw new Error("Unexpected fetch");
    return step;
  };
  return {
    handle: createHandler({
      fetcher,
      primaryMs: 15,
      fallbackMs: 15,
      ...options,
    }),
    calls,
  };
}

test("healthy primary preserves URL/Host, response and manual redirects without backup", async () => {
  const expected = new Response("primary", {
    headers: { "content-security-policy": "default-src 'self'" },
  });
  const { handle, calls } = setup([expected]);
  const response = await handle(request(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-jji-source"), "primary");
  assert.equal(
    response.headers.get("content-security-policy"),
    "default-src 'self'",
  );
  assert.equal(await response.text(), "primary");
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).hostname, "www.justinjindustries.com");
  assert.equal(calls[0].redirect, "manual");
});

test("apex keeps the existing HTTPS www canonical redirect without an origin dependency", async () => {
  const { handle, calls } = setup([]);
  const response = await handle(
    new Request("https://justinjindustries.com/services/?check=a%2Fb"),
    env,
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://www.justinjindustries.com/services/?check=a%2Fb",
  );
  assert.equal(calls.length, 0);
});

test("GET and HEAD network errors use allowlisted immutable backup without credentials", async (t) => {
  for (const method of ["GET", "HEAD"])
    await t.test(method, async () => {
      const { handle, calls } = setup([
        new Error("provider error with private URL"),
        new Response(method === "HEAD" ? null : "backup", {
          headers: {
            "x-robots-tag": "noindex, nofollow, nosnippet",
            "set-cookie": "not-forwarded=1",
            "content-security-policy": "default-src 'self'",
            etag: '"version"',
          },
        }),
      ]);
      const r = await handle(
        request("/about/?private=value", {
          method,
          headers: {
            cookie: "sensitive",
            referer: "https://private.example",
            "x-private": "secret",
            range: "bytes=0-7",
          },
        }),
        env,
      );
      assert.equal(r.status, 200);
      assert.equal(calls[1].url, origin + "about/?private=value");
      assert.equal(calls[1].method, method);
      for (const h of ["cookie", "referer", "x-private", "authorization"])
        assert.equal(calls[1].headers.get(h), null);
      assert.equal(calls[1].headers.get("range"), "bytes=0-7");
      assert.equal(r.headers.get("x-robots-tag"), "nofollow, nosnippet");
      assert.equal(r.headers.get("set-cookie"), null);
      assert.equal(
        r.headers.get("content-security-policy"),
        "default-src 'self'",
      );
      assert.equal(r.headers.get("etag"), '"version"');
      assert.equal(r.headers.get("cache-control"), "no-store");
      assert.equal(await r.text(), method === "HEAD" ? "" : "backup");
    });
});

test("only selected 5xx trigger fallback", async (t) => {
  for (const status of [500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526])
    await t.test(String(status), async () => {
      const { handle, calls } = setup([
        new Response("error", { status }),
        new Response("backup"),
      ]);
      assert.equal(await (await handle(request(), env)).text(), "backup");
      assert.equal(calls.length, 2);
    });
});

test("404/403/429, other statuses and security challenges never trigger fallback", async (t) => {
  for (const status of [301, 302, 304, 400, 401, 403, 404, 408, 429, 501, 505])
    await t.test(String(status), async () => {
      const expected = new Response(null, {
        status,
        headers: { location: "https://www.justinjindustries.com/" },
      });
      const { handle, calls } = setup([expected]);
      const response = await handle(request(), env);
      assert.equal(response.status, status);
      assert.equal(
        response.headers.get("location"),
        expected.headers.get("location"),
      );
      assert.equal(response.headers.get("x-jji-source"), "primary");
      assert.equal(await response.text(), "");
      assert.equal(calls.length, 1);
    });
  const challenged = new Response("challenge", {
    status: 503,
    headers: { "cf-mitigated": "challenge" },
  });
  const { handle, calls } = setup([challenged]);
  assert.equal(await handle(request(), env), challenged);
  assert.equal(calls.length, 1);
});

test("writes, authenticated requests, upgrade and challenge paths never retry or enable exception replay", async (t) => {
  for (const req of [
    request("/contact/", { method: "POST", body: "do-not-replay" }),
    request("/", { method: "PUT", body: "write" }),
    request("/", { method: "DELETE" }),
    request("/", { headers: { authorization: "Bearer private" } }),
    request("/", { headers: { upgrade: "websocket" } }),
    request("/cdn-cgi/challenge-platform/"),
  ])
    await t.test(req.method + new URL(req.url).pathname, async () => {
      const { handle, calls } = setup([new Error("primary failed")]);
      let exceptionReplay = false;
      assert.equal(
        (
          await handle(req, env, {
            passThroughOnException() {
              exceptionReplay = true;
            },
          })
        ).status,
        503,
      );
      assert.equal(calls.length, 1);
      assert.equal(exceptionReplay, false);
    });
});

test("off-host and HTTP requests are passed through, with preview noindex untouched", async () => {
  for (const url of [
    origin,
    "https://other.example/",
    "http://www.justinjindustries.com/",
  ]) {
    const expected = new Response("preview", {
      headers: { "x-robots-tag": "noindex" },
    });
    const { handle, calls } = setup([expected]);
    assert.equal(await handle(new Request(url), env), expected);
    assert.equal(calls.length, 1);
    assert.equal(expected.headers.get("x-robots-tag"), "noindex");
  }
});

test("timeouts are bounded even if a fetch ignores abort, and both failures return generic 503", async () => {
  const { handle, calls } = setup([
    () => new Promise(() => {}),
    () => new Promise(() => {}),
  ]);
  const started = performance.now();
  const result = await handle(request(), env);
  assert.equal(result.status, 503);
  assert.ok(performance.now() - started < 250);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((r) => r.signal.aborted));
  assert.doesNotMatch(await result.text(), /private|provider|inquiry_type/);
});

test("failed or challenged backup preserves the original primary failure", async () => {
  for (const backup of [
    new Response("missing", { status: 404 }),
    new Response("denied", { status: 403 }),
    new Response("error", { status: 502 }),
    new Response("challenge", { headers: { "cf-mitigated": "challenge" } }),
    new Error("network"),
  ]) {
    const primary = new Response("primary failure", { status: 503 });
    const { handle } = setup([primary, backup]);
    assert.equal(await handle(request(), env), primary);
  }
});

test("untrusted/mutable fallback configuration is never fetched", async () => {
  for (const target of [
    "https://evil.example/",
    "https://jji-backup-20261023.pages.dev/",
    "http://ac3af448.jji-backup-20261023.pages.dev/",
    origin + "path",
    origin + "?token=secret",
    "https://user:secret@ac3af448.jji-backup-20261023.pages.dev/",
    "https://ac3af448.jji-backup-20261023.pages.dev:444/",
  ]) {
    const { handle, calls } = setup([
      new Response("primary failure", { status: 503 }),
    ]);
    assert.equal(
      (
        await handle(request(), {
          RELEASE_CONFIG: JSON.stringify({ origin: target, current: id }),
        })
      ).status,
      503,
    );
    assert.equal(calls.length, 1);
  }
});

test("double-slash request paths cannot override the fallback host", async () => {
  const { handle, calls } = setup([
    new Error("offline"),
    new Response("backup"),
  ]);
  await handle(request("//evil.example/private?secret=value"), env);
  assert.equal(new URL(calls[1].url).hostname, new URL(origin).hostname);
});

test("backup redirects remain on public host; self-loops, foreign hosts and HTTP are rejected", async () => {
  const { handle, calls } = setup([
    new Response("failure", { status: 503 }),
    new Response(null, {
      status: 301,
      headers: { location: origin + "about/?x=1#section" },
    }),
  ]);
  const r = await handle(request("/about.html?x=1"), env);
  assert.equal(r.status, 301);
  assert.equal(
    r.headers.get("location"),
    "https://www.justinjindustries.com/about/?x=1#section",
  );
  assert.equal(calls.length, 2);
  for (const location of [
    origin + "about/?x=1",
    "https://evil.example/",
    "http://www.justinjindustries.com/about/",
    "https://www.justinjindustries.com/about/?x=1",
  ]) {
    const primary = new Response("failure", { status: 503 });
    const x = setup([
      primary,
      new Response(null, { status: 301, headers: { location } }),
    ]);
    assert.equal(await x.handle(request("/about/?x=1"), env), primary);
  }
});

test("retained immutable asset release is eligible, unknown version fails safely", async () => {
  const { handle } = setup([
    new Error("offline"),
    new Response("previous asset"),
  ]);
  assert.equal(
    await (
      await handle(request(`/__jji_releases/${previous}/styles.css`), env)
    ).text(),
    "previous asset",
  );
  const x = setup([new Response("failure", { status: 503 })]);
  assert.equal(
    (
      await x.handle(
        request(`/__jji_releases/${"c".repeat(64)}/styles.css`),
        env,
      )
    ).status,
    503,
  );
  assert.equal(x.calls.length, 1);
});

test("range metadata, CSP and HEAD semantics survive fallback", async () => {
  const { handle } = setup([
    new Error("offline"),
    new Response("part", {
      status: 206,
      headers: {
        "content-range": "bytes 0-3/100",
        "accept-ranges": "bytes",
        "content-type": "video/mp4",
      },
    }),
  ]);
  const r = await handle(
    request("/film.mp4", { headers: { range: "bytes=0-3" } }),
    env,
  );
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), "bytes 0-3/100");
  assert.equal(await r.text(), "part");
});

test("recovery uses primary on the next request, without sticky failure state", async () => {
  const { handle, calls } = setup([
    new Error("outage"),
    new Response("backup"),
    new Response("recovered"),
  ]);
  assert.equal(await (await handle(request(), env)).text(), "backup");
  assert.equal(await (await handle(request(), env)).text(), "recovered");
  assert.equal(calls.length, 3);
});

test("client cancellation does not trigger fallback", async () => {
  const controller = new AbortController();
  controller.abort();
  const { handle, calls } = setup([() => new Promise(() => {})]);
  assert.equal(
    (await handle(request("/", { signal: controller.signal }), env)).status,
    503,
  );
  assert.ok(calls.length <= 1);
});

test("safe requests request exception fail-open; quota bypass itself remains a platform setting", async () => {
  let called = 0;
  const { handle } = setup([new Response("ok")]);
  await handle(request(), env, {
    passThroughOnException() {
      called++;
    },
  });
  assert.equal(called, 1);
});

test("loopback integration: actual network 503/200, headers and query preservation", async () => {
  let seen;
  const server = createServer((req, res) => {
    seen = req.url;
    if (req.url.startsWith("/primary")) {
      res.writeHead(503);
      res.end("unavailable");
    } else {
      res.setHeader("x-robots-tag", "noindex");
      res.end("loopback fallback");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    const handle = createHandler({
      primaryMs: 1000,
      fallbackMs: 1000,
      fetcher: (r) => {
        const u = new URL(r.url);
        return fetch(
          `http://127.0.0.1:${port}/${u.hostname.endsWith("pages.dev") ? "fallback" : "primary"}${u.pathname}${u.search}`,
          { method: r.method, signal: r.signal, redirect: r.redirect },
        );
      },
    });
    const r = await handle(request("/services/?preserve=a%2Fb"), env);
    assert.equal(await r.text(), "loopback fallback");
    assert.equal(seen, "/fallback/services/?preserve=a%2Fb");
    assert.equal(r.headers.get("x-robots-tag"), null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("nested relative fallback redirect resolves from fetched request path", async () => {
  const { handle } = setup([
    new Response("bad", { status: 503 }),
    new Response(null, {
      status: 301,
      headers: { location: "../?from=service#details" },
    }),
  ]);
  const response = await handle(request("/services/cms-support/"), env);
  assert.equal(
    response.headers.get("location"),
    "https://www.justinjindustries.com/services/?from=service#details",
  );
});
