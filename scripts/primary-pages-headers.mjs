// Exact primary Pages _headers bytes expected by the build and forward preflight.
const approvedDigest =
  "3fc4e090f979c0514edd2e4abd124222e2d8ab27c076ddf72ffc32617b589d98";

export function assertPrimaryPagesHeadersDigest(digest) {
  if (digest !== approvedDigest)
    throw new Error("Missing or unapproved primary Pages _headers");
}
