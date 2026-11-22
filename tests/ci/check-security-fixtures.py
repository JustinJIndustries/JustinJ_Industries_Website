"""Prove the required source checks fail for their intended reasons."""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def check_scanner(directory):
    directory.mkdir()
    # Keep even callers with a custom Git index or worktree inside this fixture.
    env = {"PATH": os.defpath, "HOME": str(directory), "GIT_CONFIG_NOSYSTEM": "1"}
    subprocess.run(["git", "init", "--quiet"], cwd=directory, env=env, check=True)
    marker = "gh" + "p_" + "X" * 36
    (directory / "sample.txt").write_text(marker, encoding="ascii")
    subprocess.run(["git", "add", "sample.txt"], cwd=directory, env=env, check=True)
    blob = subprocess.check_output(
        ["git", "rev-parse", ":sample.txt"], cwd=directory, env=env, text=True
    ).strip()
    result = subprocess.run(
        [sys.executable, ROOT / "scripts/check-secret-blobs.py"],
        cwd=directory, env=env, capture_output=True, text=True, check=False,
    )
    expected = [
        f"Review {blob} GitHub token",
        "Checked 1 unique blobs; 1 require private review.",
    ]
    if result.returncode != 1 or result.stdout.splitlines() != expected or result.stderr:
        raise RuntimeError("Scanner did not reject the synthetic blob with redacted output")
    print("PASS: disposable Git index rejected, exit 1, only blob ID and type reported")


def check_consent(directory):
    output = directory / "dist"
    shutil.copytree(ROOT / "dist", output)
    page = output / "design/index.html"
    html = page.read_text(encoding="utf-8")
    field = 'name="data_consent"'
    if html.count(field) != 1:
        raise RuntimeError("Cannot identify the inquiry consent fixture unambiguously")
    page.write_text(html.replace(field, field + " checked"), encoding="utf-8")
    result = subprocess.run(
        ["node", ROOT / "scripts/check-design-consent.mjs", "--require-pinned-browser"],
        cwd=directory, capture_output=True, text=True, timeout=90, check=False,
    )
    reason = "Inquiry processing consent must start unchecked"
    if result.returncode != 1 or f"AssertionError [ERR_ASSERTION]: {reason}" not in result.stderr:
        raise RuntimeError("Browser check did not reject the preselected consent fixture as expected")
    print("PASS: disposable HTML with preselected consent rejected, exit 1, before submission")


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as temporary:
        check_scanner(Path(temporary) / "index")
        check_consent(Path(temporary) / "website")
