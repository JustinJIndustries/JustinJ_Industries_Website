import hashlib
import importlib.util
import io
import json
import pathlib
import tarfile
import tempfile
import unittest

import sys
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('verifier', pathlib.Path(__file__).with_name('verify-tar.py'))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class TarTests(unittest.TestCase):
    def check_case(self, names, valid=False):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            manifest = root / 'manifest.json'
            manifest.write_text(json.dumps([{'path': 'ok', 'bytes': 2, 'sha256': hashlib.sha256(b'ok').hexdigest()}]))
            archive = root / 'artifact.tar'
            with tarfile.open(archive, 'w') as tar:
                for name, kind, body in names:
                    entry = tarfile.TarInfo(name)
                    entry.type = kind
                    entry.size = len(body) if kind == tarfile.REGTYPE else 0
                    entry.linkname = 'ok' if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE) else ''
                    tar.addfile(entry, io.BytesIO(body))
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            if valid:
                self.assertEqual(verifier.verify(archive, manifest, digest)['files'], 1)
                with self.assertRaises(ValueError):
                    verifier.verify(archive, manifest, '0' * 64)
                with self.assertRaises(ValueError):
                    verifier.verify(archive, manifest, digest, max_archive=1)
            else:
                with self.assertRaises(ValueError):
                    verifier.verify(archive, manifest, digest)

    def test_valid(self):
        self.check_case([('./', tarfile.DIRTYPE, b''), ('./ok', tarfile.REGTYPE, b'ok')], True)

    def test_adverse(self):
        for name in ['/ok', '../ok', './a/../ok', 'ok\\bad', '%2e%2e/ok', 'other']:
            with self.subTest(name=name):
                self.check_case([(name, tarfile.REGTYPE, b'ok')])
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE]:
            self.check_case([('ok', kind, b'')])
        self.check_case([])
        self.check_case([('ok', tarfile.REGTYPE, b'no')])
        self.check_case([('ok', tarfile.REGTYPE, b'ok')] * 2)


if __name__ == '__main__':
    unittest.main()
