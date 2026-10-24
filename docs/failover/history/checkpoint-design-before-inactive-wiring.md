# Historical snapshot — not operative policy

Preserved from 8d9d1e3. Use ../inactive-wiring-20261024.md for current proposed policy. No historical deletion or upload instruction is authorized.

# JJI automatic failover prototype

**Current local revision:** see [lean candidate](lean-candidate-20261024.md).
The older checkpoint-archive sections below describe the preserved prior design;
the lean revision replaces new full-checkpoint CI uploads with small verified
receipts and temporary runner working storage. No production activation occurred.

## Status

Local only, isolated from production commit
`d6574ede41a8620f838b6eafd3e7ba76ea7ebf68`. No production Worker route, token, integration, secret, schedule, commit or push
has been created. An isolated test Worker was subsequently authorized and
deployed on October 24; see the runtime checkpoint below.
The held CMS detail visual and original design checkout are unchanged.

The existing verified backup remains
<https://ac3af448.jji-backup-20261023.pages.dev/>. It does **not** contain the
new immutable asset layout. Do not enable this prototype against that existing
deployment without the reviewed bootstrap described below.

## Local components

- `infrastructure/failover/worker.mjs`: request-level availability handler.
- `prepare-release.mjs`: one verified public build, immutable release assets,
  retained asset generations and a previous-HTML staging package.
- `cloudflare-package.mjs`: identical public bytes plus the existing 52 redirect
  mappings and preview-only noindex header.
- `coordinate-release.mjs`: tested publication phase ordering with injected
  deployment adapters. It makes no network calls itself.
- `worker-config.example.json`: inactive example with no route, disabled public
  development endpoints, disabled observability, and an empty binding.
- `.github/workflows/paired-release.yml.example`: inactive artifact-preparation
  workflow proposal. The production workflow has not changed. Live publication
  adapters exist as disabled code; trusted CI integration is not enabled.

No dependency was added. Tests use Node 24's test runner and Web Fetch APIs;
browser checks use the already installed Playwright and Chrome.

## Request behavior

For public HTTPS GET/HEAD on the www hostname, fetch the incoming request with
its original URL/Host and manual redirects. Do not use the github.io project
URL, which redirects back to JJI. The existing apex-to-www canonical redirect
is handled locally for eligible requests, preserving its path/query.

Fallback occurs only for a network error, an initial-response timeout, or an
explicitly selected 5xx response: 500, 502, 503, 504 and 520–526. Never fall back
for 403, 404, 429, a `cf-mitigated: challenge` response, an authenticated request,
an upgrade, a challenge-platform path, or a write method. Writes get one
original-origin attempt with no application retry or exception replay.

The normal budgets are 2.5 seconds for primary headers and 1.5 seconds for
fallback headers. Bodies stream without buffering. A stalled or broken body
after headers have been sent cannot safely be replaced and is not replayed.
These are header-wait bounds, not a total download deadline.

The backup hostname must match an eight-hex-character immutable deployment of
the existing JJI Pages project. Stable project aliases, foreign hosts, HTTP,
credentials, ports and non-root origins are rejected. Requests retain query
strings but the code logs no URLs, queries, headers or caught provider errors.
Cookies, authorization, referrer and custom headers are not forwarded to Pages.
Range and conditional-request headers are retained.

Fallback redirects are inspected manually. Only HTTPS redirects within the
approved public/backup hosts are accepted, rewritten to the public host, and
checked against a self-loop. Preview-only `noindex` is removed only from a
fallback response served on the public host; other robots directives and HTML
meta tags remain intact. Direct preview responses and primary responses are
unchanged. CSP, MIME, validators and range metadata survive fallback. Fallback
responses are not cached, allowing primary recovery on the next request.

If the backup is unusable, preserve a received primary failure; if neither
origin responded, return a generic no-store 503. Do not show a fabricated
success page or leak a provider exception.

## Release consistency

Query versions do not preserve historical mutable asset bytes. Preparation
therefore derives a 64-hex release identity from the approved source manifest
and tool schema, copies all public assets beneath
`/__jji_releases/<release>/`, and rewrites HTML/CSS/JS asset references.
Navigation, external links, canonicals and form destinations are retained.
The real site's dynamic mobile-preview template references are handled too.

Previous package hashes are verified before reuse. Existing immutable asset
trees are retained unchanged. Preparation is write-once and stops rather than
silently overwriting a generation or pruning assets. The prototype's conservative
limits are 200 MiB, 2,000 files and 16 retained generations; these are local
safety budgets, not claims about a paid platform allowance. Hitting one requires
review of retention and storage; no automatic upgrade is permitted.

For a future approved release B after prepared release A:

1. Build B once after the existing source/hold checks.
2. Publish a GitHub asset stage: **A's HTML and root files**, with both A and B
   immutable assets. Verify old HTML hashes and new asset paths.
3. Upload the same prepared B public bytes to Pages, adding only host adapters.
   Verify its immutable deployment and retained assets.
4. Promote the existing Worker binding to that B deployment and its permitted
   release identities. No route rewrite is needed for this promotion.
5. Publish B's final HTML/public package to GitHub and verify both hosts.

This ordering is tested with two different releases and every intermediate
phase. It avoids a new fallback page requesting an asset that the primary would
404, so no exception to the no-fallback-on-404 rule is needed. Cross-host
publication is not atomic. A failed phase stops later phases and requires
reconciliation of the observed remote state before a retry.

The first rollout needs a separately reviewed bootstrap on both hosts and a
cache transition for legacy HTML that still references mutable paths. Do not
attach a live route until that release is paired and verified. The current
backup is a rollback resource, not proof that bootstrap has happened.

## What remains before a live rollout

1. Owner review of this prototype, canonical behavior and publication plan.
2. Approval to integrate/enable the proposed live publication adapters and workflow.
   The draft is preparation-only and requires a prior reviewed paired artifact;
   it does not pretend the first bootstrap already exists.
3. Approve a narrowly scoped Pages deployment credential and GitHub secret
   storage. Approve Worker script/configuration authority for version/binding
   promotion separately. Do not use a global API key. JJI route edit authority
   is needed only for initial route setup/rollback, not every content release.
4. Review existing GitHub Actions artifact storage and a zero-spend guard before
   enabling extra uploads. One-day retention is not durable rollback storage;
   duplicated staging packages must not accumulate. No ongoing CI storage-cost
   guarantee has been established by this local prototype.
5. After separate approval, test a non-production Worker on the actual runtime:
   CPU, abort behavior, original-origin routing, streaming, platform exceptions,
   and fault/recovery cases. Node/loopback tests do not establish those limits.
6. Review existing WAF/Under Attack/measurement behavior and add only the approved
   availability route, with **route fail-open** configured and verified. The
   route policy for quota exhaustion is not settable by this handler. TLS, DNS
   targets, WAF and consent settings remain outside this prototype's changes.

## Cost and availability limits

No paid service or dependency was used locally. Workers Free currently permits
100,000 requests per account per UTC day, 10 ms CPU per request and 50
subrequests. This handler makes at most two origin attempts, with manual
redirect handling. The earlier observed JJI totals were about 14.82k requests
over 24 hours and 37.8k over seven days, with zero existing Worker usage.
Those figures do not bound future traffic or prove CPU fit.

In route fail-open mode, quota exhaustion bypasses the Worker and returns to
the original GitHub path; **failover protection is then unavailable**. This is
a bounded free availability improvement, not an unlimited availability guarantee.
No automatic paid upgrade, health-monitoring subscription, KV, Durable Object,
load balancer or scheduled service is required by this local design.

## Rollout and rollback

Capture the current Worker version/configuration, route assignments, deployment
identities and approved asset manifests before any later change. Start with a
separately approved non-production runtime test and controlled fault injection;
do not break the production origin to demonstrate fallback. Preserve security
responses and never submit a real lead for testing.

For an unexpected route problem, remove only the newly approved route or restore
its previous assignment, leaving the GitHub DNS target and security settings
alone. For a release problem, restore the previously verified Worker binding
and approved HTML package while retaining all immutable asset generations that
may still be referenced. Determine uncertain deployment outcomes before retrying.
An origin certificate problem is a separate task; never weaken TLS as rollback.

## Reproduction

```sh
node --test tests/failover/*.test.mjs
npm run build
node infrastructure/failover/prepare-release.mjs dist /tmp/new-reviewed-package
node infrastructure/failover/cloudflare-package.mjs /tmp/new-reviewed-package /tmp/new-reviewed-cloudflare infrastructure/failover/legacy-redirects.json
```

For a second release, supply its separately verified predecessor as the third
argument to `prepare-release.mjs`. Use fresh output paths: existing outputs are
deliberately refused.

## Primary references

- [Workers route configuration](https://developers.cloudflare.com/workers/configuration/routing/routes/)
- [Workers limits and fail-open behavior](https://developers.cloudflare.com/workers/platform/limits/)
- [Request redirect/security behavior](https://developers.cloudflare.com/workers/runtime-apis/request/)
- [Pages direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## October 23 adapter/review checkpoint

The adapters now exist as local code in `deployment-adapters.mjs`, with wiring
in `bind-release-adapters.mjs`. They import without side effects and default to
external writes disabled. All provider tests use injected mocks and fake tokens.
No provider adapter has been invoked against Cloudflare or GitHub.

The proposed interfaces cover existing-project Pages preview upload, Worker
version upload/promotion, GitHub Pages deployment and bounded status polling.
They expose no resource creation, route, DNS, TLS, security, token or secret API.
The Pages runner requires an absolute reviewed Wrangler entry point and its
SHA256; none has been installed or selected. No `npx`, shell execution, login,
inherited credential environment or raw subprocess/provider error output is
used. Each credential is supplied only to its specific provider/client.

A durable local journal records intent before a write, stores sanitized receipt
identifiers only, and binds each key to the exact provider target and code/config,
file inventory, or GitHub artifact digest. Changed intent is rejected. A lost
response leaves an uncertain operation and blocks replay. Reconciliation is
read-only and must match the exact artifact/version; it is not permission to
retry. Persist the small journal/receipts in the approved CI artifact budget;
loss of a journal means inspect remote state, never start blindly again.

The independent review identified and the implementation corrected:

- Stage integrity: its full manifest and predecessor/current asset relationship
  are checked before publication, as well as the final public tree.
- Stale predecessor: full observed primary hashes, current fallback release and
  exclusive publisher checks must pass before the first write. Worker promotion
  also rejects a changed deployment ID. A read followed by write is not a server
  compare-and-swap: the shared `pages` concurrency lock and one publishing path
  are required. Outside dashboard/API edits still require a publication pause.
- Relative backup redirect bases now use the exact fetched path.
- Rollback uses the candidate's old-root staging package, retaining ALL exposed
  asset generations on both hosts. Do not deploy the raw predecessor after new
  HTML exposure. Rollback is explicit, not automatic following an uncertain write.
- Compact checkpoints verify their public manifests independently, so restoring
  the current stage needs only the current and direct predecessor checkpoints,
  not recursively retained ancestors.

### Bounded retention and free-account safeguards

`release-policy.mjs` and `artifact-plan.mjs` implement fail-closed guards. The
inactive workflow now stores one compact public tree plus metadata, not duplicate
stage and Cloudflare trees. One-day artifact retention is the maximum proposed.
A future live workflow must allow at most one transient GitHub Pages artifact at
a time, deleting ONLY its own known completed stage artifact ID before uploading
the final artifact. No artifact-delete API is invoked by this proposal.

Before any upload, calculate actual directories with a 20% archive allowance and
20 MiB additional headroom against ALL account storage usage, including the
existing predecessor. Require a verified snapshot no older than 15 minutes,
known free Workers/Pages plans, public standard GitHub runner and owner-verified
blocked paid usage. These inputs are not facts established by unit tests. If
account storage/billing protection cannot be established, stop uploads. No paid
state store, remote logs, monitoring subscription, account cleanup or automatic
upgrade is introduced. Receipts contain IDs/hashes, never tokens, OIDC values or
private query data.

Asset retention remains bounded at 200 MiB/2,000 files/16 generations. Generations
are never automatically pruned because cached HTML may still reference them.
For this site's large imagery, the byte limit can stop new releases after very
few generations. Thus the prototype is NOT indefinite autonomous $0 publishing.
At the limit, owner-reviewed asset deduplication/cache retirement or another
retention decision is required; do not buy capacity or drop assets silently.
Expired one-day CI checkpoints also STOP automation until a verified compact
predecessor is supplied from an owner-held copy. Immutable Pages deployments
must not be deleted while referenced by the Worker or rollback receipts; the
prototype makes no provider deletion calls. Manual retention review is required
before reaching platform deployment/storage limits.

### Permission gates: test first, production separately

**No permission below has been exercised or granted by this implementation.**

1. **Staged non-production runtime test:** approve creating ONE dedicated free
   `jji-failover-test` Worker and a temporary test-only `workers.dev` endpoint,
   with no JJI production routes/custom domains. Keep observability off and
   `X-Robots-Tag: noindex`. First test controlled fault cases with a separate
   fixed-path test harness; the production handler only accepts JJI hostnames,
   so a plain workers.dev request does not exercise its eligible path. The
   harness must not expose arbitrary URL fetching, credentials, private queries
   or a way to change production. Normal TLS verification remains enabled.
   Test CPU, streaming/abort and timeout behavior, redirects/headers, selected
   errors and recovery. This cannot by itself establish routed original-origin
   Host behavior; that needs the later controlled route test/approval.
2. **Test deployment credential (only if needed):** after the test Worker exists,
   use current Individual Workers Editor permissions scoped to that Worker,
   short expiry, no other Worker, zone, DNS, route, WAF, TLS or token-management
   rights. Verify actual account support before asking; do not silently widen.
   Owner browser upload may avoid a stored token for the first test. No GitHub
   secret storage or Pages edit right is needed merely to use the existing
   immutable backup for fixed public-page harness checks.
3. **Paired bootstrap/CI, separately approved:** verify actual free-account and
   GitHub storage/billing limits; approve an exact trusted workflow commit and
   protected environment, disable/replace the independent old publication path,
   and store two separated credentials only if chosen. Cloudflare's Pages CI
   guide documents Account → Cloudflare Pages → Edit, not a verified per-project
   token restriction. This broader account-level limitation must be disclosed;
   a dedicated account or manual owner upload is an alternative decision, not
   something this task may create. Scope the Worker token to the individual
   production failover Worker. GitHub uses its own short-lived GITHUB_TOKEN with
   contents/actions read, Pages write and OIDC write, not a new PAT. Secret
   storage is a distinct owner approval, with no secrets made available to PRs.
4. **Production activation, separately approved after runtime success:** create
   the dedicated production Worker, publish and verify one paired immutable-asset
   bootstrap from the exact approved source, preserve current backup and capture
   rollback receipts. Approve only exact apex/www availability route assignments
   with fail-open on quota exhaustion, then verify controlled request-level
   original-origin behavior and edge security responses. No DNS target, TLS mode,
   WAF/Under Attack, consent, or held CMS changes are part of this activation.
   Route edit permission is temporary and separate from recurring release tokens.
   Remove/restore only those new routes to roll back Worker routing.

The inactive workflow has no live secret usage, no push/PR trigger and no Pages
write/OIDC permission. Its guards and injected context are code, not proof that
actual environment protection, account billing or remote baseline checks have
already been wired/verified. These trusted CI inspectors remain an activation
gate. A staged runtime test and then an explicitly approved, reviewed workflow
integration are required before describing this as an enabled failover system.

References for these proposed adapters/permission boundaries:

- [Individual Worker authorization scopes](https://developers.cloudflare.com/workers/authorization/workers/)
- [Pages CI permission guidance](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Worker version upload](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/)
- [Worker deployment promotion](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/create/)
- [GitHub Pages deployments and OIDC](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-deployment)

## October 24 isolated runtime checkpoint

The owner separately authorized one free test Worker using existing authenticated
browser access. `jji-failover-test` is deployed at
<https://jji-failover-test.rgqyppqwsw.workers.dev/> with no custom domains or zone
routes. The account plan was verified as Workers Free ($0). Logs and traces are
saved off; responses carry noindex/nofollow and no-store. No credential, secret,
integration, paid plan or production configuration was created or changed.

A test-only fixed-origin harness embeds the reviewed handler unchanged except
its export wrapper. It accepts only named cases and fixed paths; it rejects
query input and arbitrary destinations. Primary failure/challenge cases are
injected fixtures running in Cloudflare, while applicable fallback cases fetch
the existing immutable Pages deployment. The actual-primary case fetched the
fixed public JJI Services URL successfully. This is not production route
verification or a real origin outage.

Twenty-three hosted checks passed (24 requests including index discovery):
healthy/network/timeout/500/503, 403/404/429/challenge pass-through, GET/HEAD,
non-forwarded write fixture and rejection, both origins failing, relative and
real legacy redirects, foreign-redirect rejection, invalid config, recovery,
actual fixed primary fetch, arbitrary-query/unknown-case rejection and outer
HEAD. No real form submission occurred. Real backup noindex was observed and
removed inside eligible fallback responses; the outer test endpoint remains
noindex. Separate logs record provider metrics and their sample/ingestion limits.

The harness and evidence are outside public source at the task's
`docs/failover-runtime-test-20261024/`. Its original source hash and handler hash
are recorded, and the native editor's entire copied source matched before
deployment. The editor reports a TypeScript diagnostic for a custom `method`
property on a URL object; this JavaScript assignment passed the hosted runtime
checks. No code change was made merely to suppress that editor diagnostic.

Remaining gates: independent production-origin routing/fail-open/quota behavior,
paired immutable-asset bootstrap, real storage/billing safeguards, protected
trusted CI integration and separately scoped credential/secret-storage approval,
then exact production activation approval. The completed harness does not enable
automatic failover for JJI visitors and does not establish unlimited $0 operation.

Final isolated runtime dashboard: 26 account requests of 100,000, 9 subrequests,
37.97 ms account CPU total and 0 observability events. The all-version sample showed
CPU P50 1.04 ms, P99 4.09 ms, with zero runtime errors/CPU-limit exceedances.
It includes one initial placeholder/editor-preview invocation and 25 harness
invocations, so it is a bounded test sample, not a production load guarantee.
