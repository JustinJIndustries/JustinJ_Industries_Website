# Manual Cloudflare Pages folder preflight

The manual dashboard upload route uses Cloudflare's documented limits of **1,000 selected files** and **25 MiB (26,214,400 bytes) per file**, inclusive. The selected-file count includes `_headers` and `_redirects`; preserve both when they are in the reviewed manifest. The dashboard may display a separate asset count after parsing those controls.

Sources, checked November 19, 2026: [Direct Upload limits and methods](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Pages platform limits](https://developers.cloudflare.com/pages/platform/limits/), [headers](https://developers.cloudflare.com/pages/configuration/headers/), and [redirects](https://developers.cloudflare.com/pages/configuration/redirects/). The broader platform file-count limit does not replace the dashboard-specific 1,000-file limit. Neither limits page establishes a separate total archive cap.

For this manual route, these provider limits replace the former local 200 MiB aggregate rule and proposed 256 MiB exception. The cited dashboard documentation does not specify an aggregate package-byte ceiling. The checker reports total bytes without inventing such a ceiling; this is not a promise of unlimited capacity or provider acceptance. GitHub content-release, paired-release, recovery and backup-test budgets remain unchanged.

## Run against the reviewed folder

Supply the manifest's exact SHA-256 from the independently reviewed release record, not a digest calculated from an unreviewed candidate during this command. The manifest is a JSON array of exact `{ "path", "bytes", "sha256" }` entries. Keep it and all review records outside the upload folder.

```sh
node infrastructure/cloudflare-manual/preflight.mjs \
  cloudflare-pages-manual jji-primary-20261027 capability-pdf-forward \
  /path/to/reviewed-public-folder \
  /path/to/private-records/manifest.json \
  EXPECTED_REVIEWED_MANIFEST_SHA256
```

This checker is deliberately bound to the existing project's `capability-pdf-forward` role. A matching role string is a scope check, not evidence of owner approval. It reads local files only and makes no network requests or filesystem changes. It rejects archive files: although Cloudflare also supports ZIP uploads, this checker verifies folders only and makes no claim about ZIP contents, ZIP size or extraction.

The preflight checks the external manifest hash, complete file inventory, every file's size and SHA-256, and the two dashboard limits. It rejects symlinks, non-regular files, unsafe paths, private-record/source directories, Word documents, Markdown work records, Functions and `_worker.js`. These filename checks do not replace the independent public-content review of the exact manifest and its bytes. Static JavaScript, approved PDFs and existing immutable assets remain eligible.

The successful JSON result says `local-preflight-passed`, reports selected files, total bytes and the largest file, and leaves `providerAdmission`, `billingAdmission` and `publication` false. It is a local observation, not a seal against subsequent edits: use an unchanged reviewed folder and recheck it immediately before any separately authorized upload.

## Publication remains separate

This source change authorizes no upload, deployment, rollback, workflow dispatch, settings change or spend. Any future publication still needs its exact release authority, current account/project/predecessor and competing-publication check, preserved rollback identity, and the applicable $0/provider acceptance checks. Daily Workers counters do not establish monthly Pages deployment quota. Stop on payment, upgrade, quota or capacity rejection; a passing local check does not override provider refusal.

Only select the reviewed public folder, never its parent directory or the repository. Preserve the previous successful deployment and private recovery evidence. After an authorized publication, record the production identity and verify the actual PDF bytes, download links, site health and retained assets. These steps are not performed by the checker.

## Offline verification

```sh
node --test infrastructure/cloudflare-manual/preflight.test.mjs
```

The tests cover both limit boundaries, an actual hashed folder larger than 256 MiB, exact identity/inventory failures, unsafe paths and symlinks, static-only exclusions, and folder-only CLI behavior. They use disposable local fixtures and perform no provider actions.
