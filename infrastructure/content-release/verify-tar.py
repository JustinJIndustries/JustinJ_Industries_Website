"""Verify Pages tar as data without extracting or executing its contents."""
import hashlib
import json
import pathlib
import sys
import tarfile


def digest_stream(stream):
    digest = hashlib.sha256()
    while True:
        chunk = stream.read(1024 * 1024)
        if not chunk:
            return digest.hexdigest()
        digest.update(chunk)


def verify(archive, manifest_file, expected_sha, max_archive=228418247):
    archive = pathlib.Path(archive)
    if archive.is_symlink() or not archive.is_file() or archive.stat().st_size > max_archive:
        raise ValueError('Unsafe or oversized archive')
    with archive.open('rb') as source:
        digest = digest_stream(source)
    if digest != expected_sha:
        raise ValueError('Archive digest mismatch')
    entries = json.loads(pathlib.Path(manifest_file).read_text())
    expected = {e['path']: e for e in entries}
    if len(expected) != len(entries):
        raise ValueError('Duplicate manifest path')
    directories = {'.'}
    for name in expected:
        directories.update(str(p) for p in pathlib.PurePosixPath(name).parents)
    seen = set()
    seen_dirs = set()
    with tarfile.open(archive, 'r:') as tar:
        for member in tar:
            name = member.name
            if name.startswith('./'):
                name = name[2:]
            if member.isdir() and name in ('', '.'):
                name = '.'
            elif (not name or name.startswith('/') or '\\' in name or '%' in name or
                  any(ord(c) < 32 or ord(c) == 127 for c in name) or
                  any(c in ('', '.', '..') for c in name.split('/'))):
                raise ValueError('Unsafe archive path')
            if member.isdir():
                if name not in directories or name in seen_dirs:
                    raise ValueError('Unexpected/duplicate directory')
                seen_dirs.add(name)
                continue
            if not member.isfile() or member.issym() or member.islnk():
                raise ValueError('Links or special entries forbidden')
            if name not in expected or name in seen:
                raise ValueError('Unexpected/duplicate file')
            e = expected[name]
            if member.size != e['bytes']:
                raise ValueError('Member size mismatch')
            content = tar.extractfile(member)
            if digest_stream(content) != e['sha256']:
                raise ValueError('Member digest mismatch')
            seen.add(name)
    if seen != set(expected):
        raise ValueError('Missing file')
    return {'files': len(seen), 'archiveSha256': digest}


if __name__ == '__main__':
    print(json.dumps(verify(*sys.argv[1:4])))
