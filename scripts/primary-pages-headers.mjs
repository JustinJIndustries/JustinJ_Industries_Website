// Exact _headers bytes from approved primary Pages deployment 484d4ab3.
const approvedDigest =
  "578679797ff71b614199c5d052efff257c208fde83f35e5d442973977bfe0b7e";

export function assertPrimaryPagesHeadersDigest(digest) {
  if (digest !== approvedDigest)
    throw new Error("Missing or unapproved primary Pages _headers");
}
