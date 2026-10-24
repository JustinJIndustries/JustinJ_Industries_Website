const PUBLIC_HOSTS = new Set([
  "www.justinjindustries.com",
  "justinjindustries.com",
]);
const IMMUTABLE_HOST = /^[a-f0-9]{8}\.jji-backup-20261023\.pages\.dev$/;
const RELEASE_PATH = /^\/__jji_releases\/([a-f0-9]{64})\//;
const RETRY_STATUSES = new Set([
  500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526,
]);
const SAFE_HEADERS = [
  "accept",
  "accept-language",
  "range",
  "if-range",
  "if-none-match",
  "if-modified-since",
];

function configuration(env) {
  try {
    const value = JSON.parse(env.RELEASE_CONFIG);
    const origin = new URL(value.origin);
    const releases = [value.current, ...(value.retained ?? [])];
    if (
      origin.protocol !== "https:" ||
      !IMMUTABLE_HOST.test(origin.hostname) ||
      origin.port ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== "/" ||
      releases.length > 16 ||
      releases.some(
        (id) => typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id),
      )
    )
      return null;
    return { origin, releases: new Set(releases) };
  } catch {
    return null;
  }
}

function challenge(response) {
  return response.headers.get("cf-mitigated")?.toLowerCase() === "challenge";
}

function cancel(response) {
  if (response?.body) void response.body.cancel().catch(() => {});
}

async function boundedFetch(request, fetcher, budget, parentSignal) {
  const controller = new AbortController();
  let timer;
  let abortListener;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("origin_timeout"));
    }, budget);
    abortListener = () => {
      controller.abort();
      reject(new Error("client_aborted"));
    };
    parentSignal?.addEventListener("abort", abortListener, { once: true });
    if (parentSignal?.aborted) abortListener();
  });
  // Race also bounds a non-cooperative fetch. Bodies stream without buffering.
  let expired = false;
  const pending = Promise.resolve()
    .then(() =>
      fetcher(
        new Request(request, {
          signal: controller.signal,
          redirect: "manual",
        }),
      ),
    )
    .then((response) => {
      if (expired) cancel(response);
      return response;
    });
  try {
    return await Promise.race([pending, timeout]);
  } catch (error) {
    expired = true;
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortListener);
  }
}

function unavailable(method) {
  return new Response(
    method === "HEAD"
      ? null
      : "Temporarily unavailable. Please try again shortly.\n",
    {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "30",
      },
    },
  );
}

function cleanPreviewIndexing(headers) {
  // Preserve substantive robots directives, removing only preview qualifiers.
  const robots = headers.get("x-robots-tag");
  if (robots) {
    const kept = robots
      .split(",")
      .map((s) => s.trim())
      .filter((s) => !/^noindex$/i.test(s));
    if (kept.length) headers.set("x-robots-tag", kept.join(", "));
    else headers.delete("x-robots-tag");
  }
}

function fallbackResponse(response, incoming, origin) {
  if (challenge(response)) return null;
  const headers = new Headers(response.headers);
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = headers.get("location");
    if (!location) return null;
    const target = new URL(location, origin);
    if (
      target.protocol !== "https:" ||
      ![origin.hostname, ...PUBLIC_HOSTS].includes(target.hostname) ||
      target.username ||
      target.password ||
      target.port
    )
      return null;
    target.hostname = incoming.hostname;
    // A self redirect would loop through primary failure and fallback again.
    if (
      target.pathname === incoming.pathname &&
      target.search === incoming.search
    )
      return null;
    headers.set("location", target.href);
  } else if (![200, 204, 206, 304].includes(response.status)) return null;
  cleanPreviewIndexing(headers);
  headers.delete("set-cookie");
  headers.set("cache-control", "no-store");
  headers.set("x-jji-source", "fallback");
  // Preserve CSP, MIME, ETag, Content-Range and other content/security headers.
  return new Response(incoming.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createHandler({
  fetcher = globalThis.fetch,
  primaryMs = 2500,
  fallbackMs = 1500,
} = {}) {
  if (!(
    primaryMs > 0 &&
    primaryMs <= 5000 &&
    fallbackMs > 0 &&
    fallbackMs <= 3000
  ))
    throw new Error("Invalid wait budget");
  return async function handle(request, env = {}, ctx = {}) {
    const incoming = new URL(request.url);
    incoming.method = request.method;
    const eligible =
      ["GET", "HEAD"].includes(request.method) &&
      incoming.protocol === "https:" &&
      PUBLIC_HOSTS.has(incoming.hostname) &&
      !request.headers.has("authorization") &&
      !request.headers.has("upgrade") &&
      !incoming.pathname.startsWith("/cdn-cgi/");
    if (!eligible) {
      // No timeout/retry or passThroughOnException for possibly non-idempotent writes.
      try {
        return await fetcher(new Request(request, { redirect: "manual" }));
      } catch {
        return unavailable(request.method);
      }
    }
    // Preserve the established public canonical relationship even if GitHub
    // is unavailable. Edge security still applies before this routed Worker.
    if (incoming.hostname === "justinjindustries.com") {
      incoming.hostname = "www.justinjindustries.com";
      return new Response(null, {
        status: 301,
        headers: { location: incoming.href },
      });
    }
    // Unexpected runtime failure may bypass this availability-only Worker.
    // Daily-quota fail-open is a ROUTE setting and cannot be enabled by this code.
    ctx.passThroughOnException?.();
    let primary;
    try {
      primary = await boundedFetch(request, fetcher, primaryMs, request.signal);
    } catch {
      if (request.signal.aborted) return unavailable(request.method);
    }
    if (
      primary &&
      (challenge(primary) || !RETRY_STATUSES.has(primary.status))
    ) {
      if (challenge(primary)) return primary;
      const headers = new Headers(primary.headers);
      headers.set("x-jji-source", "primary");
      return new Response(primary.body, {
        status: primary.status,
        statusText: primary.statusText,
        headers,
      });
    }
    const config = configuration(env);
    const version = incoming.pathname.match(RELEASE_PATH)?.[1];
    if (!config || (version && !config.releases.has(version)))
      return primary ?? unavailable(request.method);
    const target = new URL(config.origin);
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    const headers = new Headers();
    for (const key of SAFE_HEADERS)
      if (request.headers.has(key)) headers.set(key, request.headers.get(key));
    const fallbackRequest = new Request(target, {
      method: request.method,
      headers,
      redirect: "manual",
    });
    let fallback;
    try {
      fallback = await boundedFetch(
        fallbackRequest,
        fetcher,
        fallbackMs,
        request.signal,
      );
      const result = fallbackResponse(fallback, incoming, target);
      if (result) {
        cancel(primary);
        return result;
      }
    } catch {
      /* Never log a URL, query, header, or provider exception. */
    }
    cancel(fallback);
    return primary ?? unavailable(request.method);
  };
}

export default { fetch: createHandler() };
