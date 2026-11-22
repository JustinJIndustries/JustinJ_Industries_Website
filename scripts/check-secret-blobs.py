"""Inspect Git index or reachable history for recognizable credential shapes, with redacted output."""
import argparse
import re
import subprocess
import sys

# Bounded patterns allow safe streaming even across chunk boundaries.
PATTERNS = {
    "private key": rb"-----BEGIN (?:RSA |OPENSSH |EC |DSA |ENCRYPTED )?PRIVATE KEY-----",
    "GitHub token": rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{38,255})",
    "provider token": rb"\b(?:sk_live_[A-Za-z0-9]{16,128}|nfp_[A-Za-z0-9]{25,128}|cf[a-z]_[A-Za-z0-9_-]{24,128})",
}
RULES = {label: re.compile(expr) for label, expr in PATTERNS.items()}


def git(*args):
    return subprocess.check_output(["git", "--no-optional-locks", *args])


def object_ids(history):
    if history:
        revs = git("rev-list", "--all", "--objects", "--no-object-names")
        inventory = subprocess.check_output(
            ["git", "cat-file", "--batch-check=%(objecttype) %(objectname)"], input=revs
        )
        return {oid for kind, oid in (row.split() for row in inventory.splitlines()) if kind == b"blob"}
    ids = set()
    for entry in git("ls-files", "--stage", "-z").split(b"\0"):
        if entry:
            (mode, oid, stage) = entry.split(b"\t", 1)[0].split()
            if stage != b"0":
                raise ValueError("Resolve the conflicted index before scanning")
            if mode != b"160000":
                ids.add(oid)
    return ids


def scan(history):
    ids = sorted(object_ids(history))
    hits = 0
    with subprocess.Popen(["git", "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE) as reader:
        for oid in ids:
            reader.stdin.write(oid + b"\n")
            reader.stdin.flush()
            observed, kind, size = reader.stdout.readline().split()
            if observed != oid or kind != b"blob":
                raise ValueError("Git blob unavailable")
            remaining, tail, matched = int(size), b"", set()
            while remaining:
                chunk = reader.stdout.read(min(1024 * 1024, remaining))
                if not chunk:
                    raise ValueError("Truncated Git response")
                block = tail + chunk
                matched.update(name for name, rule in RULES.items() if rule.search(block))
                remaining -= len(chunk)
                tail = block[-512:]
            if reader.stdout.read(1) != b"\n":
                raise ValueError("Invalid Git response")
            if matched:
                hits += 1
                print("Review", oid.decode(), ", ".join(sorted(matched)))
        reader.stdin.close()
        if reader.wait():
            raise ValueError("Git inventory failed")
    print(f"Checked {len(ids)} unique blobs; {hits} require private review.")
    return int(bool(hits))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", action="store_true", help="all objects reachable from local refs; default checks the staged index")
    sys.exit(scan(parser.parse_args().history))
